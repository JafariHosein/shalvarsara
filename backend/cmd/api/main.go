// Command api is the HTTP entrypoint for the ShalvarSara backend.
package main

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/handler"
	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/repository"
	"github.com/shalvarsara/backend/internal/router"
	"github.com/shalvarsara/backend/internal/seeder"
	"github.com/shalvarsara/backend/internal/service"
	"github.com/shalvarsara/backend/internal/zarinpal"
)

func main() {
	configureLogging()

	if err := run(); err != nil {
		log.Fatal().Err(err).Msg("server stopped")
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// ---- database ----
	db, err := connectWithRetry(ctx, cfg.DatabaseURL, 15)
	if err != nil {
		return err
	}
	defer db.Close()
	log.Info().Msg("connected to database")

	if cfg.RunMigrations {
		if err := db.Migrate(ctx); err != nil {
			return err
		}
		log.Info().Msg("migrations up to date")
	}

	if cfg.SeedOnStart {
		if err := seeder.Seed(ctx, db, cfg.Admin, cfg.AppEnv); err != nil {
			return err
		}
	}

	// ---- wiring ----
	userRepo := repository.NewUserRepository(db)
	addressRepo := repository.NewAddressRepository(db)
	cartRepo := repository.NewCartRepository(db)
	categoryRepo := repository.NewCategoryRepository(db)
	productRepo := repository.NewProductRepository(db)
	couponRepo := repository.NewCouponRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	paymentRepo := repository.NewPaymentRepository(db)
	statsRepo := repository.NewStatsRepository(db)
	verificationRepo := repository.NewPhoneVerificationRepository(db)
	reviewRepo := repository.NewReviewRepository(db)
	wishlistRepo := repository.NewWishlistRepository(db)

	tokens := service.NewTokenService(cfg.JWT)
	gateway := zarinpal.New(cfg.ZarinPal)

	authService := service.NewAuthService(userRepo, verificationRepo, tokens, cfg.SMS)
	userService := service.NewUserService(userRepo)
	addressService := service.NewAddressService(addressRepo)
	cartService := service.NewCartService(cartRepo, productRepo)
	categoryService := service.NewCategoryService(categoryRepo)
	productService := service.NewProductService(productRepo)
	couponService := service.NewCouponService(couponRepo)
	orderService := service.NewOrderService(cartRepo, orderRepo, addressRepo, couponService, cfg.Shipping)
	paymentService := service.NewPaymentService(orderRepo, paymentRepo, userRepo, gateway, cfg.ZarinPal)
	reviewService := service.NewReviewService(reviewRepo, productRepo)
	wishlistService := service.NewWishlistService(wishlistRepo, productRepo)
	adminService := service.NewAdminService(
		productRepo, categoryRepo, orderRepo, userRepo, couponRepo, statsRepo, paymentRepo, reviewRepo,
	)

	app := router.New(router.Deps{
		Config:   cfg,
		Health:   handler.NewHealthHandler(db),
		Auth:     handler.NewAuthHandler(authService, cfg.SMS),
		User:     handler.NewUserHandler(userService),
		Address:  handler.NewAddressHandler(addressService),
		Cart:     handler.NewCartHandler(cartService),
		Order:    handler.NewOrderHandler(orderService),
		Payment:  handler.NewPaymentHandler(paymentService, cfg.ZarinPal),
		Category: handler.NewCategoryHandler(categoryService),
		Product:  handler.NewProductHandler(productService),
		Review:   handler.NewReviewHandler(reviewService),
		Wishlist: handler.NewWishlistHandler(wishlistService),
		Admin:    handler.NewAdminHandler(adminService),
		AuthMW:   middleware.NewAuth(tokens, userRepo),
	})

	// ---- background jobs ----
	//
	// Unpaid orders hold the stock they reserved. The sweeper is what stops an
	// abandoned checkout from taking a product off sale indefinitely; it shares
	// the cancellation path with the admin panel, so stock and coupon
	// bookkeeping are identical.
	stopSweeper := startOrderExpirySweeper(ctx, orderRepo, cfg.OrderExpiry)
	defer stopSweeper()

	// ---- serve ----
	serveErr := make(chan error, 1)
	go func() {
		addr := ":" + cfg.HTTPPort
		log.Info().Str("addr", addr).Str("env", cfg.AppEnv).Msg("API listening")
		serveErr <- app.Listen(addr)
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
		log.Info().Msg("shutdown signal received")
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return app.ShutdownWithContext(shutdownCtx)
}

// startOrderExpirySweeper cancels unpaid orders in the background and returns a
// function that stops it.
//
// It is a plain ticker rather than an external scheduler so a single-instance
// deployment needs no extra infrastructure. The work is idempotent, so running
// several instances side by side is harmless: whichever one gets there first
// performs the cancel and the others see a no-longer-pending order.
func startOrderExpirySweeper(
	ctx context.Context, orders *repository.OrderRepository, expiry time.Duration,
) func() {
	if expiry <= 0 {
		log.Info().Msg("order expiry sweeper disabled")
		return func() {}
	}

	// Sweep every five minutes, or every `expiry` if that is shorter, so a
	// short expiry is still honoured promptly.
	interval := 5 * time.Minute
	if expiry < interval {
		interval = expiry
	}

	sweepCtx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})

	go func() {
		defer close(done)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-sweepCtx.Done():
				return
			case <-ticker.C:
				expired, err := orders.ExpirePendingOrders(sweepCtx, expiry, 200)
				if err != nil {
					log.Error().Err(err).Msg("order expiry sweep failed")
					continue
				}
				if expired > 0 {
					log.Info().Int("orders", expired).Msg("expired unpaid orders")
				}
			}
		}
	}()

	return func() {
		cancel()
		<-done
	}
}

// connectWithRetry waits for the database to accept connections. This makes the
// container start reliably even before PostgreSQL is fully ready.
func connectWithRetry(ctx context.Context, url string, attempts int) (*database.Pool, error) {
	var lastErr error
	for attempt := 1; attempt <= attempts; attempt++ {
		pool, err := database.Connect(ctx, url)
		if err == nil {
			return pool, nil
		}
		lastErr = err
		log.Warn().Err(err).Int("attempt", attempt).Msg("database not ready; retrying in 2s")

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
	return nil, errors.Join(errors.New("database unreachable"), lastErr)
}

// configureLogging sets up human-friendly console logs in development.
func configureLogging() {
	zerolog.TimeFieldFormat = time.RFC3339
	log.Logger = log.Output(zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: "15:04:05",
	})
}
