// Package router wires middleware and routes into a Fiber application.
package router

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/handler"
	"github.com/shalvarsara/backend/internal/middleware"
)

// Deps are the wired handlers and middleware the router needs.
type Deps struct {
	Config *config.Config

	Health   *handler.HealthHandler
	Auth     *handler.AuthHandler
	User     *handler.UserHandler
	Address  *handler.AddressHandler
	Cart     *handler.CartHandler
	Order    *handler.OrderHandler
	Payment  *handler.PaymentHandler
	Category *handler.CategoryHandler
	Product  *handler.ProductHandler
	Review   *handler.ReviewHandler
	Wishlist *handler.WishlistHandler
	Admin    *handler.AdminHandler

	AuthMW *middleware.Auth
}

// New builds the Fiber app.
func New(d Deps) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:               "ShalvarSara API",
		DisableStartupMessage: true,
		ReadTimeout:           10 * time.Second,
		WriteTimeout:          20 * time.Second,
		ProxyHeader:           proxyHeader(d.Config),
		// EnableTrustedProxyCheck is what makes ProxyHeader safe to honour:
		// Fiber then reads the header only when the immediate peer is in
		// TrustedProxies, and ignores it otherwise. Without this, c.IP() returns
		// whatever the client sent and the limiter below is trivially bypassed
		// by rotating X-Forwarded-For.
		EnableTrustedProxyCheck: d.Config.TrustProxyHeader,
		TrustedProxies:          d.Config.TrustedProxies,
		EnableIPValidation:      true,
		ErrorHandler:            errorHandler,
	})

	app.Use(requestid.New())
	app.Use(middleware.Logger())
	app.Use(recover.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     strings.Join(d.Config.CORSOrigins, ","),
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, X-Request-ID",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowCredentials: true,
	}))

	// Brute-force protection on the credential endpoints.
	//
	// Two limiters run together, because each covers the other's blind spot:
	// the per-IP one stops one host spraying many accounts, and the per-identity
	// one stops a distributed or proxy-rotating attacker from getting a fresh
	// budget per address. The account key comes from the request body, which the
	// client cannot forge into a *different* identity than the one it is
	// attacking.
	ipLimiter := limiter.New(limiter.Config{
		Max:        20,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: rateLimited,
	})

	identityLimiter := limiter.New(limiter.Config{
		Max:        10,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return identityKey(c)
		},
		LimitReached: rateLimited,
	})

	// guarded builds the middleware chain for a credential endpoint: both
	// limiters, then the handler.
	guarded := func(h fiber.Handler) []fiber.Handler {
		return []fiber.Handler{ipLimiter, identityLimiter, h}
	}

	api := app.Group("/api/v1")

	// ---- health ----
	api.Get("/health", d.Health.Live)
	api.Get("/health/ready", d.Health.Ready)

	// ---- auth ----
	auth := api.Group("/auth")
	auth.Post("/register", guarded(d.Auth.Register)...)
	// The code request is limited like the credential endpoints: it is the one
	// route that will cost money the moment a real SMS panel is connected.
	auth.Post("/register/code", guarded(d.Auth.RegisterCode)...)
	auth.Post("/login", guarded(d.Auth.Login)...)
	auth.Post("/refresh", guarded(d.Auth.Refresh)...)
	auth.Post("/logout", d.AuthMW.RequireAuth, d.Auth.Logout)
	auth.Get("/me", d.AuthMW.RequireAuth, d.Auth.Me)
	auth.Patch("/password", d.AuthMW.RequireAuth, d.Auth.ChangePassword)

	// ---- profile ----
	users := api.Group("/users", d.AuthMW.RequireAuth)
	users.Get("/me", d.User.Me)
	users.Patch("/me", d.User.UpdateMe)

	// ---- addresses ----
	addresses := api.Group("/addresses", d.AuthMW.RequireAuth)
	addresses.Get("/", d.Address.List)
	addresses.Post("/", d.Address.Create)
	addresses.Patch("/:id", d.Address.Update)
	addresses.Delete("/:id", d.Address.Delete)

	// ---- cart ----
	// The authoritative cart belongs to an account; guests keep theirs in the
	// browser and hand it over through /cart/merge right after signing in.
	cart := api.Group("/cart", d.AuthMW.RequireAuth)
	cart.Get("/", d.Cart.Get)
	cart.Delete("/", d.Cart.Clear)
	cart.Post("/items", d.Cart.AddItem)
	cart.Patch("/items/:id", d.Cart.UpdateItem)
	cart.Delete("/items/:id", d.Cart.DeleteItem)
	cart.Post("/merge", d.Cart.Merge)

	// ---- orders ----
	// Everything under /orders is scoped to the signed-in user: an order id from
	// someone else's account reads as a 404, not as a leak.
	orders := api.Group("/orders", d.AuthMW.RequireAuth)
	orders.Post("/preview", d.Order.Preview)
	orders.Post("/", d.Order.Create)
	orders.Get("/", d.Order.List)
	orders.Get("/:id", d.Order.Get)

	// ---- payments ----
	// The callback is the one route the gateway's browser redirect reaches, so it
	// stays public and answers with a redirect of its own. Starting a payment and
	// reading a payment's status are user-scoped like the rest of /orders.
	payments := api.Group("/payments")
	payments.Get("/callback", d.Payment.Callback)
	payments.Post("/request", d.AuthMW.RequireAuth, d.Payment.Start)
	api.Get("/orders/:id/payment", d.AuthMW.RequireAuth, d.Payment.Status)

	// ---- catalogue (public) ----
	api.Get("/categories", d.Category.List)

	products := api.Group("/products")
	products.Get("/", d.Product.List)
	// Register the literal route before the ":slug" one so it is not swallowed.
	products.Get("/suggest", d.Product.Suggest)
	products.Get("/:slug", d.Product.Get)
	products.Get("/:slug/related", d.Product.Related)

	// Published reviews are public; writing one belongs to a signed-in buyer who
	// the product already reached (see ReviewService.Create).
	products.Get("/:slug/reviews", d.Review.List)
	api.Get("/products/:slug/reviews/mine", d.AuthMW.RequireAuth, d.Review.Mine)
	api.Post("/products/:slug/reviews", d.AuthMW.RequireAuth, d.Review.Create)

	// ---- wishlist ----
	// Every write answers with the whole list, exactly like the cart.
	wishlist := api.Group("/wishlist", d.AuthMW.RequireAuth)
	wishlist.Get("/", d.Wishlist.List)
	wishlist.Post("/", d.Wishlist.Add)
	wishlist.Delete("/:productId", d.Wishlist.Remove)

	// ---- admin ----
	// Everything under /admin needs a valid token whose user still holds the
	// admin role — RequireAuth reloads the user, so a revoked role takes effect
	// immediately rather than at token expiry.
	admin := api.Group("/admin", d.AuthMW.RequireAuth, d.AuthMW.RequireAdmin)

	admin.Get("/stats", d.Admin.Stats)

	admin.Get("/products", d.Admin.ListProducts)
	admin.Post("/products", d.Admin.CreateProduct)
	admin.Get("/products/:id", d.Admin.GetProduct)
	admin.Patch("/products/:id", d.Admin.UpdateProduct)
	admin.Delete("/products/:id", d.Admin.DeleteProduct)
	admin.Post("/products/:id/variants", d.Admin.CreateVariant)
	admin.Post("/products/:id/images", d.Admin.CreateImage)
	admin.Patch("/variants/:id", d.Admin.UpdateVariant)
	admin.Delete("/variants/:id", d.Admin.DeleteVariant)
	admin.Patch("/images/:id", d.Admin.UpdateImage)
	admin.Delete("/images/:id", d.Admin.DeleteImage)

	admin.Post("/categories", d.Admin.CreateCategory)
	admin.Patch("/categories/:id", d.Admin.UpdateCategory)
	admin.Delete("/categories/:id", d.Admin.DeleteCategory)

	admin.Get("/orders", d.Admin.ListOrders)
	admin.Get("/orders/:id", d.Admin.GetOrder)
	admin.Patch("/orders/:id/status", d.Admin.SetOrderStatus)
	admin.Post("/orders/:id/shipment", d.Admin.SaveShipment)

	// Payment attempts across every order — one row per gateway call.
	admin.Get("/payments", d.Admin.ListPayments)

	admin.Get("/users", d.Admin.ListUsers)
	admin.Patch("/users/:id", d.Admin.UpdateUser)

	admin.Get("/coupons", d.Admin.ListCoupons)
	admin.Post("/coupons", d.Admin.CreateCoupon)
	admin.Patch("/coupons/:id", d.Admin.UpdateCoupon)

	// Review moderation: approving or rejecting a review also refreshes the
	// product's public rating.
	admin.Get("/reviews", d.Admin.ListReviews)
	admin.Patch("/reviews/:id", d.Admin.SetReviewStatus)

	// ---- fallback ----
	app.Use(func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": fiber.Map{
				"code":    "not_found",
				"message": "مسیر مورد نظر یافت نشد.",
			},
		})
	})

	return app
}

// proxyHeader returns the header carrying the real client address. It is empty
// unless the host puts a proxy in front of the API (Render, Arvan, ...): read
// from the socket instead, so a spoofed header cannot dodge the rate limiter on
// a bare deployment.
func proxyHeader(cfg *config.Config) string {
	if !cfg.TrustProxyHeader {
		return ""
	}
	return cfg.ProxyHeader
}

// rateLimited renders the shared 429 body.
func rateLimited(c *fiber.Ctx) error {
	return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
		"error": fiber.Map{
			"code":    "too_many_requests",
			"message": "تلاش‌های بیش از حد. لطفاً کمی بعد دوباره امتحان کنید.",
		},
	})
}

// identityKey derives a rate-limit bucket from the credential the request is
// aimed at — the email being logged into, the phone being registered or the
// token being refreshed — so the budget follows the target account rather than
// the caller's address.
//
// It deliberately never returns the raw value: the key is a hash, so the
// limiter's in-memory store does not become a list of the emails and phone
// numbers that were tried.
func identityKey(c *fiber.Ctx) string {
	var body struct {
		Email        string `json:"email"`
		Phone        string `json:"phone"`
		RefreshToken string `json:"refreshToken"`
	}
	// A body that will not parse is the validator's problem, not the limiter's;
	// fall back to the caller's address so the request is still counted.
	if err := json.Unmarshal(c.Body(), &body); err != nil {
		return "ip:" + c.IP()
	}

	identity := strings.ToLower(strings.TrimSpace(firstNonEmpty(body.Email, body.Phone)))
	if identity == "" && body.RefreshToken != "" {
		// Refresh has no email; key on the token itself so replaying one stolen
		// token cannot outrun the limit by changing address.
		sum := sha256.Sum256([]byte(body.RefreshToken))
		return "rt:" + hex.EncodeToString(sum[:8])
	}
	if identity == "" {
		return "ip:" + c.IP()
	}
	sum := sha256.Sum256([]byte(identity))
	return "id:" + hex.EncodeToString(sum[:8])
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// errorHandler renders Fiber-level errors (e.g. bad JSON) in the shared shape.
func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "خطای داخلی سرور."

	if fe, ok := err.(*fiber.Error); ok {
		code = fe.Code
		switch code {
		case fiber.StatusBadRequest:
			message = "درخواست نامعتبر است."
		case fiber.StatusNotFound:
			message = "مسیر مورد نظر یافت نشد."
		case fiber.StatusMethodNotAllowed:
			message = "این متد مجاز نیست."
		case fiber.StatusRequestEntityTooLarge:
			message = "حجم درخواست بیش از حد مجاز است."
		}
	}

	return c.Status(code).JSON(fiber.Map{
		"error": fiber.Map{"code": "request_error", "message": message},
	})
}
