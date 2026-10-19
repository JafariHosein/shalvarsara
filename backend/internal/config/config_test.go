package config

import (
	"strings"
	"testing"
	"time"
)

// The two secrets published in .env.example. They are longer than the 32-char
// minimum on purpose: the length rule alone would accept them, so only the
// template check can reject them.
const (
	templateAccessSecret  = "dev-access-secret-change-me-please-32-chars-min"
	templateRefreshSecret = "dev-refresh-secret-change-me-please-32-chars-min"
)

func TestShippingCost(t *testing.T) {
	const (
		flat = int64(65_000)
		free = int64(2_000_000)
	)

	tests := []struct {
		name     string
		shipping ShippingConfig
		subtotal int64
		want     int64
	}{
		{"empty basket is free", ShippingConfig{FlatCost: flat, FreeFrom: free}, 0, 0},
		{"negative subtotal is free", ShippingConfig{FlatCost: flat, FreeFrom: free}, -1, 0},
		{"one Toman is charged", ShippingConfig{FlatCost: flat, FreeFrom: free}, 1, flat},
		{"just below the threshold is charged", ShippingConfig{FlatCost: flat, FreeFrom: free}, free - 1, flat},
		{"exactly at the threshold is free", ShippingConfig{FlatCost: flat, FreeFrom: free}, free, 0},
		{"above the threshold is free", ShippingConfig{FlatCost: flat, FreeFrom: free}, free + 1, 0},
		{"free delivery configured from zero", ShippingConfig{FlatCost: flat, FreeFrom: 0}, 1, 0},
		{"zero flat cost is always free", ShippingConfig{FlatCost: 0, FreeFrom: free}, 1, 0},
		{"unconfigured shipping is free", ShippingConfig{}, 1_000_000, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.shipping.Cost(tt.subtotal); got != tt.want {
				t.Fatalf("Cost(%d) = %d, want %d", tt.subtotal, got, tt.want)
			}
		})
	}
}

func TestZarinPalURLs(t *testing.T) {
	const authority = "A00000000000000000000000000000123456"

	tests := []struct {
		name      string
		sandbox   bool
		wantBase  string
		wantStart string
	}{
		{
			name:      "sandbox",
			sandbox:   true,
			wantBase:  "https://sandbox.zarinpal.com",
			wantStart: "https://sandbox.zarinpal.com/pg/StartPay/" + authority,
		},
		{
			name:      "live",
			sandbox:   false,
			wantBase:  "https://payment.zarinpal.com",
			wantStart: "https://payment.zarinpal.com/pg/StartPay/" + authority,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			z := ZarinPalConfig{Sandbox: tt.sandbox}

			if got := z.BaseURL(); got != tt.wantBase {
				t.Fatalf("BaseURL() = %q, want %q", got, tt.wantBase)
			}
			if got := z.StartPayURL(authority); got != tt.wantStart {
				t.Fatalf("StartPayURL(%q) = %q, want %q", authority, got, tt.wantStart)
			}
			// The redirect page must live on the same host as the API.
			if !strings.HasPrefix(z.StartPayURL(authority), z.BaseURL()) {
				t.Fatalf("StartPayURL is not on BaseURL host: %q vs %q", z.StartPayURL(authority), z.BaseURL())
			}
		})
	}

	t.Run("empty authority still yields the redirect prefix", func(t *testing.T) {
		z := ZarinPalConfig{Sandbox: false}
		if got, want := z.StartPayURL(""), "https://payment.zarinpal.com/pg/StartPay/"; got != want {
			t.Fatalf("StartPayURL(\"\") = %q, want %q", got, want)
		}
	})
}

func TestNormalizeOrigins(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{"empty input", nil, []string{}},
		{"full origin is kept", []string{"http://localhost:5173"}, []string{"http://localhost:5173"}},
		{"trailing slash is dropped", []string{"http://localhost:5173/"}, []string{"http://localhost:5173"}},
		{"several trailing slashes are dropped", []string{"https://shop.example.com///"}, []string{"https://shop.example.com"}},
		{"bare host becomes https", []string{"shop.example.com"}, []string{"https://shop.example.com"}},
		{"bare host with a port becomes https", []string{"shop.example.com:8443"}, []string{"https://shop.example.com:8443"}},
		{"wildcard is preserved", []string{"*"}, []string{"*"}},
		{"wildcard with a trailing slash is preserved", []string{"*/"}, []string{"*"}},
		{"empty entries are dropped", []string{"", "https://a.example.com"}, []string{"https://a.example.com"}},
		{"a lone slash is dropped", []string{"/"}, []string{}},
		{"mixed list keeps its order", []string{"https://a.example.com/", "b.example.com", "*"}, []string{"https://a.example.com", "https://b.example.com", "*"}},
		{"http origin is not upgraded", []string{"http://127.0.0.1:5173"}, []string{"http://127.0.0.1:5173"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeOrigins(tt.in)
			if len(got) != len(tt.want) {
				t.Fatalf("normalizeOrigins(%q) = %q, want %q", tt.in, got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("normalizeOrigins(%q)[%d] = %q, want %q", tt.in, i, got[i], tt.want[i])
				}
			}
		})
	}
}

// The real call path is splitAndTrim then normalizeOrigins; together they make
// a comma-separated dashboard paste usable.
func TestSplitAndTrimThenNormalize(t *testing.T) {
	tests := []struct {
		name string
		csv  string
		want []string
	}{
		{"single value", "http://localhost:5173", []string{"http://localhost:5173"}},
		{"spaces around entries are trimmed", " a.example.com , b.example.com ", []string{"https://a.example.com", "https://b.example.com"}},
		{"empty entries are skipped", "a.example.com,,b.example.com", []string{"https://a.example.com", "https://b.example.com"}},
		{"empty csv yields nothing", "", []string{}},
		{"only commas yields nothing", ",,,", []string{}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeOrigins(splitAndTrim(tt.csv))
			if len(got) != len(tt.want) {
				t.Fatalf("normalizeOrigins(splitAndTrim(%q)) = %q, want %q", tt.csv, got, tt.want)
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Fatalf("entry %d = %q, want %q", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestIsTemplateSecret(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{"the published access secret", templateAccessSecret, true},
		{"the published refresh secret", templateRefreshSecret, true},
		{"uppercased template", strings.ToUpper(templateAccessSecret), true},
		{"mixed case template", "Dev-Access-Secret-Change-Me-Please-32-Chars-Min", true},
		{"change-me", "change-me", true},
		{"camel case change me", "ChangeMe", true},
		{"underscore change me", "change_me", true},
		{"please marker", "please-rotate-this-secret-value-1234", true},
		{"your secret marker", "your-secret-goes-here-0123456789abcd", true},
		{"placeholder marker", "this-is-a-placeholder-value-12345678", true},
		{"example marker", "an-example-value-that-is-long-enough", true},
		{"a real random secret", "Kf8sL2mQ9vX4pR7tY1uZ6wB3nD5hJ0aC", false},
		{"a hex secret", "9f2b7c1d4e6a8b0c2d4f6a8b0c2d4f6a", false},
		{"empty value is not a template match", "", false},
		{"a secret that merely mentions dev", "dev9f2b7c1d4e6a8b0c2d4f6a8b0c2d4f", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isTemplateSecret(tt.value); got != tt.want {
				t.Fatalf("isTemplateSecret(%q) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

func TestIsPlaceholder(t *testing.T) {
	tests := []struct {
		name  string
		value string
		want  bool
	}{
		{"empty", "", true},
		{"whitespace only", "   ", true},
		{"the example merchant id", "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX", true},
		{"lowercase x", "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", true},
		{"y marker", "YYYY-YYYY", true},
		{"dashes only", "---", true},
		{"zeros only", "0000", true},
		{"dashes and zeros", "000-000", true},
		{"a real merchant uuid", "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d", false},
		{"a random secret", "Kf8sL2mQ9vX4pR7tY1uZ6wB3nD5hJ0aC", false},
		{"zero then a letter", "0a", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isPlaceholder(tt.value); got != tt.want {
				t.Fatalf("isPlaceholder(%q) = %v, want %v", tt.value, got, tt.want)
			}
		})
	}
}

// validConfig is a Config that every rule accepts, so each case below can flip
// exactly one field and attribute the failure to that rule.
func validConfig() *Config {
	return &Config{
		AppEnv:      "development",
		DatabaseURL: "postgres://shalvarsara:secret@localhost:5432/shalvarsara?sslmode=disable",
		JWT: JWTConfig{
			AccessSecret:  "Kf8sL2mQ9vX4pR7tY1uZ6wB3nD5hJ0aC",
			RefreshSecret: "Qw3eR5tY7uI9oP1aS2dF4gH6jK8lZ0xC",
			AccessTTL:     15 * time.Minute,
			RefreshTTL:    30 * 24 * time.Hour,
		},
		ZarinPal:       ZarinPalConfig{Sandbox: true, MerchantID: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"},
		Shipping:       ShippingConfig{FlatCost: 65_000, FreeFrom: 2_000_000},
		SMS:            SMSConfig{TestMode: true},
		TrustedProxies: []string{"127.0.0.1/8", "::1"},
	}
}

// TestValidateRejectsTemplateSecrets is the regression test for the security
// fix: the secrets shipped in .env.example are long enough to pass the length
// rule, so a deployment that copied the template used to start with signing
// keys that are published in the repository.
func TestValidateRejectsTemplateSecrets(t *testing.T) {
	if len(templateAccessSecret) < 32 || len(templateRefreshSecret) < 32 {
		t.Fatalf("this test only proves anything while the template secrets pass the 32-char rule "+
			"(got %d and %d)", len(templateAccessSecret), len(templateRefreshSecret))
	}

	tests := []struct {
		name         string
		mutate       func(*Config)
		wantContains string
	}{
		{
			name: "template access secret is rejected",
			mutate: func(c *Config) {
				c.JWT.AccessSecret = templateAccessSecret
			},
			wantContains: "JWT_ACCESS_SECRET",
		},
		{
			name: "template refresh secret is rejected",
			mutate: func(c *Config) {
				c.JWT.RefreshSecret = templateRefreshSecret
			},
			wantContains: "JWT_REFRESH_SECRET",
		},
		{
			name: "both template secrets are rejected",
			mutate: func(c *Config) {
				c.JWT.AccessSecret = templateAccessSecret
				c.JWT.RefreshSecret = templateRefreshSecret
			},
			wantContains: "example value",
		},
		{
			// Any long-enough value carrying a template marker is caught too,
			// not just the two exact strings from the template.
			name: "another long template-style secret is rejected",
			mutate: func(c *Config) {
				c.JWT.AccessSecret = "please-change-me-to-a-real-secret-value"
			},
			wantContains: "JWT_ACCESS_SECRET",
		},
		{
			// A short template value fails the length rule first; either way it
			// must never be accepted.
			name: "a short template secret is still rejected",
			mutate: func(c *Config) {
				c.JWT.AccessSecret = "your-secret-change-me"
			},
			wantContains: "at least 32 characters",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := validConfig()
			tt.mutate(cfg)

			err := cfg.validate()
			if err == nil {
				t.Fatal("validate() = nil, want the template secret to be rejected")
			}
			if !strings.Contains(err.Error(), tt.wantContains) {
				t.Fatalf("validate() error = %q, want it to mention %q", err.Error(), tt.wantContains)
			}
		})
	}
}

func TestValidate(t *testing.T) {
	tests := []struct {
		name string
		// mutate flips fields on top of validConfig.
		mutate func(*Config)
		// wantErr is the substring the error must contain, "" means no error.
		wantErr string
	}{
		{
			name:   "the baseline config is valid",
			mutate: func(*Config) {},
		},
		{
			name:    "DATABASE_URL is required",
			mutate:  func(c *Config) { c.DatabaseURL = "" },
			wantErr: "DATABASE_URL is required",
		},
		{
			name:    "a whitespace DATABASE_URL counts as missing",
			mutate:  func(c *Config) { c.DatabaseURL = "   " },
			wantErr: "DATABASE_URL is required",
		},
		{
			name:    "JWT_ACCESS_SECRET is required",
			mutate:  func(c *Config) { c.JWT.AccessSecret = "" },
			wantErr: "JWT_ACCESS_SECRET is required",
		},
		{
			name:    "JWT_REFRESH_SECRET is required",
			mutate:  func(c *Config) { c.JWT.RefreshSecret = "  " },
			wantErr: "JWT_REFRESH_SECRET is required",
		},
		{
			name: "the two secrets must differ",
			mutate: func(c *Config) {
				c.JWT.AccessSecret = "Kf8sL2mQ9vX4pR7tY1uZ6wB3nD5hJ0aC"
				c.JWT.RefreshSecret = "Kf8sL2mQ9vX4pR7tY1uZ6wB3nD5hJ0aC"
			},
			wantErr: "must differ",
		},
		{
			name:    "a short access secret is rejected",
			mutate:  func(c *Config) { c.JWT.AccessSecret = strings.Repeat("a", 31) },
			wantErr: "at least 32 characters",
		},
		{
			name:    "a short refresh secret is rejected",
			mutate:  func(c *Config) { c.JWT.RefreshSecret = strings.Repeat("b", 31) },
			wantErr: "at least 32 characters",
		},
		{
			name: "exactly 32 characters is accepted",
			mutate: func(c *Config) {
				c.JWT.AccessSecret = strings.Repeat("a", 32)
				c.JWT.RefreshSecret = strings.Repeat("b", 32)
			},
		},
		{
			// The length rule is not gated on APP_ENV: a host that forgot to set
			// it must not accept a one-character signing key.
			name: "a one-character secret is rejected in production too",
			mutate: func(c *Config) {
				c.AppEnv = "production"
				c.JWT.AccessSecret = "x"
				c.ZarinPal.Sandbox = false
				c.ZarinPal.MerchantID = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
				c.SMS.TestMode = false
			},
			wantErr: "at least 32 characters",
		},
		{
			name:    "trusting the proxy header without pinned proxies is rejected",
			mutate:  func(c *Config) { c.TrustProxyHeader = true; c.TrustedProxies = nil },
			wantErr: "TRUSTED_PROXIES is empty",
		},
		{
			name: "trusting the proxy header with pinned proxies is accepted",
			mutate: func(c *Config) {
				c.TrustProxyHeader = true
				c.TrustedProxies = []string{"10.0.0.0/8"}
			},
		},
		{
			name: "production requires a merchant id",
			mutate: func(c *Config) {
				c.AppEnv = "production"
				c.ZarinPal.MerchantID = ""
				c.SMS.TestMode = false
			},
			wantErr: "ZARINPAL_MERCHANT_ID is required in production",
		},
		{
			name: "production rejects a placeholder merchant id on the live gateway",
			mutate: func(c *Config) {
				c.AppEnv = "production"
				c.ZarinPal.Sandbox = false
				c.ZarinPal.MerchantID = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
				c.SMS.TestMode = false
			},
			wantErr: "placeholder value",
		},
		{
			// The sandbox accepts any UUID, including the template one, so the
			// placeholder rule must not block a sandbox deployment.
			name: "the sandbox tolerates a placeholder merchant id",
			mutate: func(c *Config) {
				c.AppEnv = "production"
				c.ZarinPal.Sandbox = true
				c.ZarinPal.MerchantID = "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
				c.SMS.TestMode = false
			},
		},
		{
			name: "production rejects SMS test mode",
			mutate: func(c *Config) {
				c.AppEnv = "production"
				c.ZarinPal.Sandbox = false
				c.ZarinPal.MerchantID = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
				c.SMS.TestMode = true
			},
			wantErr: "SMS_TEST_MODE must be false in production",
		},
		{
			name: "a complete production config is accepted",
			mutate: func(c *Config) {
				c.AppEnv = "production"
				c.ZarinPal.Sandbox = false
				c.ZarinPal.MerchantID = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
				c.SMS.TestMode = false
			},
		},
		{
			// APP_ENV is compared case-insensitively.
			name: "PRODUCTION in capitals is treated as production",
			mutate: func(c *Config) {
				c.AppEnv = "PRODUCTION"
				c.ZarinPal.MerchantID = ""
			},
			wantErr: "ZARINPAL_MERCHANT_ID is required in production",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := validConfig()
			tt.mutate(cfg)

			err := cfg.validate()
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("validate() = %v, want nil", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("validate() = nil, want an error containing %q", tt.wantErr)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Fatalf("validate() error = %q, want it to contain %q", err.Error(), tt.wantErr)
			}
		})
	}
}

func TestIsProduction(t *testing.T) {
	tests := []struct {
		appEnv string
		want   bool
	}{
		{"production", true},
		{"Production", true},
		{"PRODUCTION", true},
		{"development", false},
		{"staging", false},
		{"", false},
		{"production ", false},
	}

	for _, tt := range tests {
		t.Run("appEnv="+tt.appEnv, func(t *testing.T) {
			cfg := &Config{AppEnv: tt.appEnv}
			if got := cfg.IsProduction(); got != tt.want {
				t.Fatalf("IsProduction() with AppEnv %q = %v, want %v", tt.appEnv, got, tt.want)
			}
		})
	}
}

func TestEnvHelpers(t *testing.T) {
	t.Run("getEnv", func(t *testing.T) {
		t.Setenv("DSH_TEST_PRESENT", "  value  ")
		t.Setenv("DSH_TEST_BLANK", "   ")

		if got := getEnv("DSH_TEST_PRESENT", "fallback"); got != "value" {
			t.Fatalf("getEnv trimmed value = %q, want %q", got, "value")
		}
		if got := getEnv("DSH_TEST_BLANK", "fallback"); got != "fallback" {
			t.Fatalf("getEnv on a blank value = %q, want the fallback", got)
		}
		if got := getEnv("DSH_TEST_ABSENT", "fallback"); got != "fallback" {
			t.Fatalf("getEnv on a missing key = %q, want the fallback", got)
		}
	})

	t.Run("getBool", func(t *testing.T) {
		t.Setenv("DSH_TEST_TRUE", "true")
		t.Setenv("DSH_TEST_FALSE", "false")
		t.Setenv("DSH_TEST_GARBAGE", "yes please")

		if !getBool("DSH_TEST_TRUE", false) {
			t.Fatal("getBool did not read true")
		}
		if getBool("DSH_TEST_FALSE", true) {
			t.Fatal("getBool did not read false")
		}
		// An unparsable value must fail closed onto the caller's default.
		if !getBool("DSH_TEST_GARBAGE", true) {
			t.Fatal("getBool did not fall back on an invalid value")
		}
		if getBool("DSH_TEST_ABSENT", false) {
			t.Fatal("getBool did not fall back on a missing key")
		}
	})

	t.Run("getInt64", func(t *testing.T) {
		t.Setenv("DSH_TEST_NUM", "65000")
		t.Setenv("DSH_TEST_NEG", "-1")
		t.Setenv("DSH_TEST_WORD", "lots")

		if got := getInt64("DSH_TEST_NUM", 1); got != 65_000 {
			t.Fatalf("getInt64 = %d, want 65000", got)
		}
		// Shipping money may not be negative, so the fallback wins.
		if got := getInt64("DSH_TEST_NEG", 7); got != 7 {
			t.Fatalf("getInt64 on a negative value = %d, want the fallback 7", got)
		}
		if got := getInt64("DSH_TEST_WORD", 7); got != 7 {
			t.Fatalf("getInt64 on a non-numeric value = %d, want the fallback 7", got)
		}
		if got := getInt64("DSH_TEST_ABSENT", 7); got != 7 {
			t.Fatalf("getInt64 on a missing key = %d, want the fallback 7", got)
		}
	})

	t.Run("getDuration", func(t *testing.T) {
		t.Setenv("DSH_TEST_DUR", "15m")
		t.Setenv("DSH_TEST_BAD_DUR", "fifteen minutes")

		if got := getDuration("DSH_TEST_DUR", time.Second); got != 15*time.Minute {
			t.Fatalf("getDuration = %s, want 15m", got)
		}
		if got := getDuration("DSH_TEST_BAD_DUR", time.Second); got != time.Second {
			t.Fatalf("getDuration on an invalid value = %s, want the fallback", got)
		}
		if got := getDuration("DSH_TEST_ABSENT", time.Second); got != time.Second {
			t.Fatalf("getDuration on a missing key = %s, want the fallback", got)
		}
	})
}
