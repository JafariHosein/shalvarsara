package service

import (
	"errors"
	"testing"
	"unicode"

	"github.com/shalvarsara/backend/internal/model"
)

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"already canonical", "09123456789", "09123456789"},
		{"Persian digits", "\u06F0\u06F9\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9", "09123456789"},
		{"Arabic-Indic digits", "\u0660\u0669\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669", "09123456789"},
		{"spaces are dropped", "0912 345 6789", "09123456789"},
		{"dashes are dropped", "0912-345-6789", "09123456789"},
		{"Persian digits with spaces", "\u06F0\u06F9\u06F1\u06F2 \u06F3\u06F4\u06F5 \u06F6\u06F7\u06F8\u06F9", "09123456789"},
		{"parentheses are dropped", "(0912) 345-6789", "09123456789"},
		{"a country code prefix becomes extra digits", "+98 912 345 6789", "989123456789"},
		{"letters are stripped", "tel:0912abc3456789", "09123456789"},
		{"no digits at all", "not a phone", ""},
		{"empty", "", ""},
		{"junk only", "!!!", ""},
		{"mixed scripts", "09\u06F1\u06F2-\u0663\u0664", "091234"},
		{"leading zeros are preserved", "0000", "0000"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizePhone(tt.in); got != tt.want {
				t.Fatalf("normalizePhone(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

// The canonical form must contain ASCII digits only: the database stores it and
// isIranianMobile compares against ASCII prefixes.
func TestNormalizePhoneEmitsASCIIDigitsOnly(t *testing.T) {
	inputs := []string{
		"\u06F0\u06F9\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9",
		"\u0660\u0669\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669",
		"0912 345 6789",
	}

	for _, in := range inputs {
		t.Run(in, func(t *testing.T) {
			got := normalizePhone(in)
			for _, r := range got {
				if r < '0' || r > '9' {
					t.Fatalf("normalizePhone(%q) = %q, contains the non-ASCII digit %q", in, got, r)
				}
			}
		})
	}
}

func TestIsIranianMobile(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want bool
	}{
		{"canonical mobile", "09123456789", true},
		{"another operator prefix", "09901234567", true},
		{"ten digits", "0912345678", false},
		{"twelve digits", "091234567890", false},
		{"landline prefix", "08123456789", false},
		{"country code form", "989123456789", false},
		{"empty", "", false},
		{"Persian digits are not normalized yet", "\u06F0\u06F9\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9", false},
		// isIranianMobile is only a shape check (length + "09" prefix); the
		// digit-only guarantee comes from normalizePhone, which always runs
		// first in the sign-up and login paths.
		{"eleven characters with a 09 prefix is accepted by shape", "09abcdefghi", true},
		{"a trailing space breaks the length", "09123456789 ", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isIranianMobile(tt.in); got != tt.want {
				t.Fatalf("isIranianMobile(%q) = %v, want %v", tt.in, got, tt.want)
			}
		})
	}
}

// normalizePhone then isIranianMobile is the real pipeline used at sign-up.
func TestNormalizeThenValidatePipeline(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		wantOK  bool
		wantNum string
	}{
		{"Persian digits pass", "\u06F0\u06F9\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9", true, "09123456789"},
		{"dashed latin passes", "0912-345-6789", true, "09123456789"},
		{"too short fails", "0912345678", false, "0912345678"},
		{"country code fails", "+989123456789", false, "989123456789"},
		{"empty fails", "", false, ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizePhone(tt.in)
			if got != tt.wantNum {
				t.Fatalf("normalizePhone(%q) = %q, want %q", tt.in, got, tt.wantNum)
			}
			if ok := isIranianMobile(got); ok != tt.wantOK {
				t.Fatalf("isIranianMobile(%q) = %v, want %v", got, ok, tt.wantOK)
			}
		})
	}
}

// validatedPhone is the wrapper the service actually calls; it must reject a
// bad number with a message the customer can act on.
func TestValidatedPhone(t *testing.T) {
	t.Run("accepts and normalizes a Persian-digit number", func(t *testing.T) {
		got, err := validatedPhone("\u06F0\u06F9\u06F1\u06F2 \u06F3\u06F4\u06F5 \u06F6\u06F7\u06F8\u06F9")
		if err != nil {
			t.Fatalf("validatedPhone() error = %v, want nil", err)
		}
		if got != "09123456789" {
			t.Fatalf("validatedPhone() = %q, want %q", got, "09123456789")
		}
	})

	t.Run("rejects a non-mobile with ErrValidation", func(t *testing.T) {
		got, err := validatedPhone("12345")
		if err == nil {
			t.Fatal("validatedPhone() = nil error, want a validation failure")
		}
		if got != "" {
			t.Fatalf("validatedPhone() = %q, want an empty string on failure", got)
		}
		if !errors.Is(err, model.ErrValidation) {
			t.Fatalf("errors.Is(%v, model.ErrValidation) = false, want true", err)
		}

		var user *model.UserFacingError
		if !errors.As(err, &user) {
			t.Fatalf("error %v is not a *model.UserFacingError", err)
		}
		if user.Text == "" {
			t.Fatal("UserFacingError.Text is empty, want a message for the customer")
		}
	})
}

func TestRandomCode(t *testing.T) {
	tests := []struct {
		name   string
		digits int
	}{
		{"sign-up code length", codeDigits},
		{"one digit", 1},
		{"long code", 12},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			code, err := randomCode(tt.digits)
			if err != nil {
				t.Fatalf("randomCode(%d) error = %v, want nil", tt.digits, err)
			}
			if len(code) != tt.digits {
				t.Fatalf("len(randomCode(%d)) = %d, want %d (code %q)", tt.digits, len(code), tt.digits, code)
			}
			for _, r := range code {
				if r < '0' || r > '9' || !unicode.IsDigit(r) {
					t.Fatalf("randomCode(%d) = %q, contains the non-digit %q", tt.digits, code, r)
				}
			}
		})
	}

	t.Run("zero digits yields an empty code", func(t *testing.T) {
		code, err := randomCode(0)
		if err != nil {
			t.Fatalf("randomCode(0) error = %v, want nil", err)
		}
		if code != "" {
			t.Fatalf("randomCode(0) = %q, want an empty string", code)
		}
	})

	// The code is drawn from crypto/rand, so two calls colliding on every digit
	// is not a realistic outcome; a fixed code would be a real defect.
	t.Run("codes vary between calls", func(t *testing.T) {
		const runs = 50
		seen := make(map[string]struct{}, runs)

		for i := 0; i < runs; i++ {
			code, err := randomCode(codeDigits)
			if err != nil {
				t.Fatalf("randomCode(%d) on run %d error = %v", codeDigits, i, err)
			}
			if len(code) != codeDigits {
				t.Fatalf("run %d: len = %d, want %d", i, len(code), codeDigits)
			}
			seen[code] = struct{}{}
		}

		if len(seen) < 2 {
			t.Fatalf("%d calls to randomCode(%d) produced a single value; it is not random", runs, codeDigits)
		}
	})
}
