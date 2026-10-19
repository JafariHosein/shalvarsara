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

	// OrderExpiry is how long an unpaid order keeps its reserved stock before
	// the background sweeper cancels it. Zero disables the sweeper.
	OrderExpiry time.Duration

	// Hosting dashboards, CDNs and load balancers terminate TLS on their own
	// proxy, so the socket peer is the proxy, not the visitor. Without this the
	// rate limiter would count every visitor as one client. ProxyHeader names
	// the header carrying the real address; reverse proxies append
	// X-Forwarded-For by default.
	//
	// TrustedProxies is what makes that header trustworthy. Fiber reads the
	// header only when the immediate peer is in this list; otherwise it falls
	// back to the socket address. Without it the header is attacker-controlled
	// and a fresh value per request would hand out a fresh rate-limit bucket.
	TrustProxyHeader bool
	ProxyHeader      string
	TrustedProxies   []string
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
		AppEnv: getEnv("APP_ENV", "development"),
		// HTTP_PORT wins locally (docker compose, .env); hosts such as Render
		// only inject PORT, so fall back to it before defaulting.
		HTTPPort:    getEnv("HTTP_PORT", getEnv("PORT", "8080")),
		CORSOrigins: normalizeOrigins(splitAndTrim(getEnv("CORS_ORIGINS", "http://localhost:5173"))),
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
			Name:  getEnv("ADMIN_NAME", "مدیر فروشگاه"),
			Email: getEnv("ADMIN_EMAIL", "admin@example.com"),
			// No default password: see seeder.seedUsers. An empty value means
			// "do not create an admin account" in development and a startup
			// error when SEED_ON_START is on in production.
			Password: getEnv("ADMIN_PASSWORD", ""),
		},

		Shipping: ShippingConfig{
			FlatCost: getInt64("SHIPPING_FLAT_COST", 65000),
			FreeFrom: getInt64("SHIPPING_FREE_FROM", 2_000_000),
		},

		SMS: SMSConfig{
			// Fail closed: returning the verification code in the API response
			// is a development convenience, so an unset variable must not turn
			// it on for a deployment that never thought about it.
			TestMode:    getBool("SMS_TEST_MODE", false),
			CodeTTL:     getDuration("SMS_CODE_TTL", 2*time.Minute),
			ResendAfter: getDuration("SMS_RESEND_AFTER", 60*time.Second),
		},

		RunMigrations: getBool("RUN_MIGRATIONS", true),
		SeedOnStart:   getBool("SEED_ON_START", false),
		// 30 minutes is long enough for a real checkout and short enough that an
		// abandoned basket does not hold the last unit of a SKU for a day.
		OrderExpiry: getDuration("ORDER_EXPIRY", 30*time.Minute),

		// Off locally (nothing sits in front of the API), on behind a host's
		// proxy. PROXY_HEADER only matters when TRUST_PROXY_HEADER is true.
		TrustProxyHeader: getBool("TRUST_PROXY_HEADER", false),
		ProxyHeader:      getEnv("PROXY_HEADER", "X-Forwarded-For"),
		// Loopback and the private ranges cover the usual arrangements (a
		// reverse proxy on the same host, docker compose, a VPC-internal load
		// balancer). A platform with public proxy addresses must list them.
		TrustedProxies: splitAndTrim(getEnv("TRUSTED_PROXIES",
			"127.0.0.1/8,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")),
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
	// The length rule is not gated on APP_ENV any more: APP_ENV defaults to
	// "development", so a production host that forgot to set it would otherwise
	// accept a one-character signing key while serving real traffic.
	if len(c.JWT.AccessSecret) < 32 || len(c.JWT.RefreshSecret) < 32 {
		return fmt.Errorf("config: JWT secrets must be at least 32 characters")
	}
	// A copied template is not a secret. These values are published in the
	// repository, so accepting them would mean anyone could mint an admin token.
	for name, value := range map[string]string{
		"JWT_ACCESS_SECRET":  c.JWT.AccessSecret,
		"JWT_REFRESH_SECRET": c.JWT.RefreshSecret,
	} {
		if isTemplateSecret(value) {
			return fmt.Errorf("config: %s still holds the example value from .env.example", name)
		}
	}
	// Trusting a forwarded header without pinning who may send it is worse than
	// not trusting it: the rate limiter would key on a value the client picks.
	if c.TrustProxyHeader && len(c.TrustedProxies) == 0 {
		return fmt.Errorf("config: TRUST_PROXY_HEADER is on but TRUSTED_PROXIES is empty")
	}
	if c.IsProduction() {
		if c.ZarinPal.MerchantID == "" {
			return fmt.Errorf("config: ZARINPAL_MERCHANT_ID is required in production")
		}
		// Live gateway plus a placeholder merchant id means every payment fails
		// at the gateway, which customers discover before the shop does.
		if !c.ZarinPal.Sandbox && isPlaceholder(c.ZarinPal.MerchantID) {
			return fmt.Errorf("config: ZARINPAL_MERCHANT_ID is still a placeholder value")
		}
		// Handing the verification code back in the response defeats the whole
		// point of verifying the number.
		if c.SMS.TestMode {
			return fmt.Errorf("config: SMS_TEST_MODE must be false in production")
		}
	}
	return nil
}

// isTemplateSecret reports whether a value is one of the published examples
// rather than a real secret.
func isTemplateSecret(value string) bool {
	v := strings.ToLower(value)
	for _, marker := range []string{"change-me", "changeme", "change_me", "dev-access", "dev-refresh", "please", "example", "placeholder", "your-secret"} {
		if strings.Contains(v, marker) {
			return true
		}
	}
	return false
}

// isPlaceholder reports whether a configured value is obviously not real.
func isPlaceholder(value string) bool {
	v := strings.ToUpper(strings.TrimSpace(value))
	if v == "" {
		return true
	}
	if strings.Contains(v, "XXXX") || strings.Contains(v, "YYYY") {
		return true
	}
	return strings.Trim(v, "-0") == ""
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

// normalizeOrigins makes CORS entries comparable with the browser's Origin
// header. Full origins pass through untouched; a bare host (as pasted from a
// hosting dashboard, e.g. "shop.example.com") becomes "https://shop.example.com".
// A trailing slash is dropped because the Origin header never carries one.
func normalizeOrigins(origins []string) []string {
	out := make([]string, 0, len(origins))
	for _, o := range origins {
		o = strings.TrimRight(o, "/")
		if o == "" {
			continue
		}
		if o != "*" && !strings.Contains(o, "://") {
			o = "https://" + o
		}
		out = append(out, o)
	}
	return out
}
