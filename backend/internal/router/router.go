// Package router wires middleware and routes into a Fiber application.
package router

import (
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
		ErrorHandler:          errorHandler,
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
	authLimiter := limiter.New(limiter.Config{
		Max:        20,
		Expiration: time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": fiber.Map{
					"code":    "too_many_requests",
					"message": "تلاش‌های بیش از حد. لطفاً کمی بعد دوباره امتحان کنید.",
				},
			})
		},
	})

	api := app.Group("/api/v1")

	// ---- health ----
	api.Get("/health", d.Health.Live)
	api.Get("/health/ready", d.Health.Ready)

	// ---- auth ----
	auth := api.Group("/auth")
	auth.Post("/register", authLimiter, d.Auth.Register)
	// The code request is limited like the credential endpoints: it is the one
	// route that will cost money the moment a real SMS panel is connected.
	auth.Post("/register/code", authLimiter, d.Auth.RegisterCode)
	auth.Post("/login", authLimiter, d.Auth.Login)
	auth.Post("/refresh", authLimiter, d.Auth.Refresh)
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
