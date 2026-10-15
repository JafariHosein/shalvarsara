// Package config loads and validates application configuration from the
// environment. Secrets are never hard-coded: everything comes from env vars,
// optionally seeded from a local .env file during development.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config is the fully resolved application configuration.
type Config struct {
	AppEnv      string
	HTTPPort    string
	CORSOrigins []string
	DatabaseURL string

	JWT      JWTConfig
	ZarinPal ZarinPalConfig
	Admin    AdminConfig
	Shipping ShippingConfig
	SMS      SMSConfig

	RunMigrations bool
	SeedOnStart   bool
}

// JWTConfig holds token signing material and lifetimes.
type JWTConfig struct {
	AccessSecret  string
	RefreshSecret string
	AccessTTL     time.Duration
	RefreshTTL    time.Duration
}

// ZarinPalConfig controls the payment gateway integration.
type ZarinPalConfig struct {
	Sandbox     bool
	MerchantID  string
	CallbackURL string
	ResultURL   string
}

// AdminConfig describes the bootstrap administrator created by the seeder.
type AdminConfig struct {
	Name     string
	Email    string
	Password string
}

// ShippingConfig prices delivery. It lives on the server so the cart, the
// checkout preview and the stored order can never disagree.
type ShippingConfig struct {
	// FlatCost is the delivery fee in Toman for orders below FreeFrom.
	FlatCost int64
	// FreeFrom is the goods subtotal at or above which delivery is free. It is
	// taken before any coupon discount, so using a coupon never costs the
	// customer a delivery fee.
	FreeFrom int64
}

// SMSConfig describes how phone verification codes are delivered.
//
// TestMode is the honest name for "no SMS panel is connected yet": the API
// then returns the code alongside the response so the sign-up flow stays
// testable. Turning it off is the only change needed once a real panel is
// wired in — nothing else in the flow depends on it.
type SMSConfig struct {
	TestMode    bool
	CodeTTL     time.Duration
	ResendAfter time.Duration
}

// Cost returns the delivery fee in Toman for a cart subtotal.
func (s ShippingConfig) Cost(subtotal int64) int64 {
	if subtotal <= 0 || subtotal >= s.FreeFrom {
		return 0
	}
	return s.FlatCost
}

// IsProduction reports whether the app runs with production settings.
func (c *Config) IsProduction() bool {
	return strings.EqualFold(c.AppEnv, "production")
}

// BaseURL returns the ZarinPal API base for the configured environment.
func (z ZarinPalConfig) BaseURL() string {
	if z.Sandbox {
		return "https://sandbox.zarinpal.com"
	}
	return "https://payment.zarinpal.com"
}

// StartPayURL returns the page a user is redirected to in order to pay.
func (z ZarinPalConfig) StartPayURL(authority string) string {
	if z.Sandbox {
		return "https://sandbox.zarinpal.com/pg/StartPay/" + authority
	}
	return "https://payment.zarinpal.com/pg/StartPay/" + authority
}

// Load reads configuration, loading a local .env file first when present.
func Load() (*Config, error) {
	// A missing .env is fine (containers receive real env vars).
	_ = godotenv.Load(".env")

	cfg := &Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		HTTPPort:    getEnv("HTTP_PORT", "8080"),
		CORSOrigins: splitAndTrim(getEnv("CORS_ORIGINS", "http://localhost:5173")),
		DatabaseURL: getEnv("DATABASE_URL", ""),

		JWT: JWTConfig{
			AccessSecret:  getEnv("JWT_ACCESS_SECRET", ""),
			RefreshSecret: getEnv("JWT_REFRESH_SECRET", ""),
			AccessTTL:     getDuration("JWT_ACCESS_TTL", 15*time.Minute),
			RefreshTTL:    getDuration("JWT_REFRESH_TTL", 30*24*time.Hour),
		},

		ZarinPal: ZarinPalConfig{
			Sandbox:     getBool("ZARINPAL_SANDBOX", true),
			MerchantID:  getEnv("ZARINPAL_MERCHANT_ID", ""),
			CallbackURL: getEnv("ZARINPAL_CALLBACK_URL", "http://localhost:5173/payment/callback"),
			ResultURL:   getEnv("ZARINPAL_RESULT_URL", "http://localhost:5173/payment/result"),
		},

		Admin: AdminConfig{
			Name:     getEnv("ADMIN_NAME", "مدیر فروشگاه"),
			Email:    getEnv("ADMIN_EMAIL", "admin@example.com"),
			Password: getEnv("ADMIN_PASSWORD", ""),
		},

		Shipping: ShippingConfig{
			FlatCost: getInt64("SHIPPING_FLAT_COST", 65000),
			FreeFrom: getInt64("SHIPPING_FREE_FROM", 2_000_000),
		},

		SMS: SMSConfig{
			TestMode:    getBool("SMS_TEST_MODE", true),
			CodeTTL:     getDuration("SMS_CODE_TTL", 2*time.Minute),
			ResendAfter: getDuration("SMS_RESEND_AFTER", 60*time.Second),
		},

		RunMigrations: getBool("RUN_MIGRATIONS", true),
		SeedOnStart:   getBool("SEED_ON_START", false),
	}

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) validate() error {
	if strings.TrimSpace(c.DatabaseURL) == "" {
		return fmt.Errorf("config: DATABASE_URL is required")
	}
	if strings.TrimSpace(c.JWT.AccessSecret) == "" {
		return fmt.Errorf("config: JWT_ACCESS_SECRET is required")
	}
	if strings.TrimSpace(c.JWT.RefreshSecret) == "" {
		return fmt.Errorf("config: JWT_REFRESH_SECRET is required")
	}
	if c.JWT.AccessSecret == c.JWT.RefreshSecret {
		return fmt.Errorf("config: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ")
	}
	// In production, weak secrets are a real vulnerability, not a warning.
	if c.IsProduction() {
		if len(c.JWT.AccessSecret) < 32 || len(c.JWT.RefreshSecret) < 32 {
			return fmt.Errorf("config: JWT secrets must be at least 32 characters in production")
		}
		if c.ZarinPal.MerchantID == "" {
			return fmt.Errorf("config: ZARINPAL_MERCHANT_ID is required in production")
		}
	}
	return nil
}

// ---- env helpers ----------------------------------------------------------

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return fallback
}

func getBool(key string, fallback bool) bool {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	b, err := strconv.ParseBool(strings.TrimSpace(v))
	if err != nil {
		return fallback
	}
	return b
}

// getInt64 reads a positive integer in Toman, falling back when unset/invalid.
func getInt64(key string, fallback int64) int64 {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	n, err := strconv.ParseInt(strings.TrimSpace(v), 10, 64)
	if err != nil || n < 0 {
		return fallback
	}
	return n
}

func getDuration(key string, fallback time.Duration) time.Duration {
	v, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(v) == "" {
		return fallback
	}
	d, err := time.ParseDuration(strings.TrimSpace(v))
	if err != nil {
		return fallback
	}
	return d
}

func splitAndTrim(csv string) []string {
	parts := strings.Split(csv, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
