package service

import (
	"errors"
	"strings"
	"testing"

	"github.com/shalvarsara/backend/internal/model"
)

// ASCII slug assertions use the literal Persian in the input and the translit
// output the implementation produces. The values were read off the real
// translit table, not guessed.

func TestSlugify(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"persian title with ZWNJ", "\u0634\u0644\u0648\u0627\u0631 \u067E\u0627\u0631\u0686\u0647\u200C\u0627\u06CC \u0645\u0631\u062F\u0627\u0646\u0647", "shlvar-parchhay-mrdanh"},
		{"short persian title", "\u0634\u0644\u0648\u0627\u0631 \u062C\u06CC\u0646", "shlvar-jyn"},
		{"mixed latin and persian", "\u0634\u0644\u0648\u0627\u0631 Slim-Fit \u06A9\u062F 42", "shlvar-slim-fit-kd-42"},
		{"latin title is lowercased", "Hello, World!!", "hello-world"},
		{"uppercase latin", "SLIM FIT", "slim-fit"},
		{"punctuation is dropped", "shalvar (slim) #1!", "shalvar-slim-1"},
		{"runs of dashes collapse", "a---b", "a-b"},
		{"qualified case", "shalvar-fabric-women-slim-fit-749", "shalvar-fabric-women-slim-fit-749"},
		{"repeated spaces collapse", "  spaced  out  ", "spaced-out"},
		{"underscore behaves like a separator", "slim_fit", "slim-fit"},
		{"persian underscore", "\u0633\u0644\u0627\u0645_\u062F\u0646\u06CC\u0627", "slam-dnya"},
		{"leading and trailing dashes are trimmed", "--already-dashed--", "already-dashed"},
		{"persian digits become ascii", "\u06F1\u06F2\u06F3 \u0639\u062F\u062F", "123-add"},
		{"arabic-indic digits become ascii", "\u0661\u0662\u0663", "123"},
		{"no usable characters", "!!!", ""},
		{"underscores only", "___", ""},
		{"empty input", "", ""},
		{"whitespace only", "   ", ""},
		{"a single letter", "a", "a"},
		{"a single digit", "7", "7"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := slugify(tt.in); got != tt.want {
				t.Fatalf("slugify(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

// A slug goes into a URL and into the database, so it must be ASCII, lowercase
// and free of separators at either end.
func TestSlugifyIsURLSafe(t *testing.T) {
	inputs := []string{
		"\u0634\u0644\u0648\u0627\u0631 \u067E\u0627\u0631\u0686\u0647\u200C\u0627\u06CC \u0645\u0631\u062F\u0627\u0646\u0647",
		"\u062A\u06CC\u200C\u0634\u0631\u062A \u0646\u062E\u06CC \u0645\u0631\u062F\u0627\u0646\u0647 \u0632\u0645\u0633\u062A\u0627\u0646\u06CC \u0641\u0648\u0642\u200C\u0627\u0644\u0639\u0627\u062F\u0647 \u06AF\u0631\u0645",
		"  Mixed_Input -- With  Junk!! ",
		"\u06F1\u06F2\u06F3",
	}

	for _, in := range inputs {
		t.Run(in, func(t *testing.T) {
			got := slugify(in)

			for i := 0; i < len(got); i++ {
				c := got[i]
				switch {
				case c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '-':
				default:
					t.Fatalf("slugify(%q) = %q, contains the unsafe byte %q", in, got, c)
				}
			}
			if strings.HasPrefix(got, "-") || strings.HasSuffix(got, "-") {
				t.Fatalf("slugify(%q) = %q, must not start or end with a dash", in, got)
			}
			if strings.Contains(got, "--") {
				t.Fatalf("slugify(%q) = %q, must not contain a double dash", in, got)
			}
			if got != strings.ToLower(got) {
				t.Fatalf("slugify(%q) = %q, must be lowercase", in, got)
			}
		})
	}
}

// uniqueSlug caps the base at 90 runes; slugify itself has no cap, so this
// documents where the truncation actually happens.
func TestSlugifyDoesNotTruncate(t *testing.T) {
	in := strings.Repeat("a", 150)
	if got := slugify(in); len(got) != 150 {
		t.Fatalf("len(slugify(150 a's)) = %d, want 150 (the 90-rune cap lives in uniqueSlug)", len(got))
	}
}

func TestPersianToLatin(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"a full persian phrase", "\u0634\u0644\u0648\u0627\u0631 \u067E\u0627\u0631\u0686\u0647\u200C\u0627\u06CC \u0645\u0631\u062F\u0627\u0646\u0647", "shlvar parchhay mrdanh"},
		{"ZWNJ is removed, not transliterated", "a\u200Cb", "ab"},
		{"right-to-left mark is removed", "a\u200Fb", "ab"},
		{"left-to-right mark is removed", "a\u200Eb", "ab"},
		{"ZWNJ inside a word", "\u067E\u0627\u0631\u0686\u0647\u200C\u0627\u06CC", "parchhay"},
		{"persian digits", "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9", "0123456789"},
		{"arabic-indic digits", "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669", "0123456789"},
		{"multi-letter mappings", "\u0686\u0698\u062E\u063A\u0642", "chzhkhghgh"},
		{"hamza maps to nothing", "\u0621", ""},
		{"latin passes through", "Hello 123", "Hello 123"},
		{"punctuation passes through", "a-b_c!", "a-b_c!"},
		{"an unmapped symbol is preserved", "\u20AC", "\u20AC"},
		{"empty input", "", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := persianToLatin(tt.in); got != tt.want {
				t.Fatalf("persianToLatin(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestColorHex(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{"empty becomes black", "", "#000000"},
		{"whitespace becomes black", "   ", "#000000"},
		{"three digits get a hash", "fff", "#fff"},
		{"three digits keep their hash", "#fff", "#fff"},
		{"case is preserved", "#FFF", "#FFF"},
		{"six digits get a hash", "ffffff", "#ffffff"},
		{"six digits keep their hash", "#ffffff", "#ffffff"},
		{"eight digits are allowed", "#12345678", "#12345678"},
		{"eight digits without a hash", "12345678", "#12345678"},
		{"surrounding spaces are trimmed", "  #abc  ", "#abc"},
		{"a bare hash is rejected", "#", "#000000"},
		{"two characters are rejected", "ff", "#000000"},
		{"two characters with a hash are rejected", "#ff", "#000000"},
		{"five characters are rejected", "12345", "#000000"},
		{"seven characters with a hash are rejected", "#1234567", "#000000"},
		{"black survives", "000000", "#000000"},
		// colorHex checks the shape only; the browser ignores a bad hex, so
		// this is a documentation test rather than a bug.
		{"non-hex characters of a valid length are kept", "zzzzzz", "#zzzzzz"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := colorHex(tt.in)
			if got != tt.want {
				t.Fatalf("colorHex(%q) = %q, want %q", tt.in, got, tt.want)
			}
			if !strings.HasPrefix(got, "#") {
				t.Fatalf("colorHex(%q) = %q, want a leading #", tt.in, got)
			}
		})
	}
}

func TestNormalizeAdminPaging(t *testing.T) {
	tests := []struct {
		name      string
		page, lim int
		wantPage  int
		wantLim   int
	}{
		{"values pass through", 3, 50, 3, 50},
		{"page zero becomes one", 0, 50, 1, 50},
		{"negative page becomes one", -2, 50, 1, 50},
		{"limit zero becomes the admin default", 2, 0, 2, adminPageSize},
		{"negative limit becomes the admin default", 2, -1, 2, adminPageSize},
		{"limit above the cap is clamped", 2, 1000, 2, adminMaxPageSize},
		{"limit exactly at the cap is kept", 2, adminMaxPageSize, 2, adminMaxPageSize},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			page, limit := normalizeAdminPaging(tt.page, tt.lim)
			if page != tt.wantPage || limit != tt.wantLim {
				t.Fatalf("normalizeAdminPaging(%d, %d) = (%d, %d), want (%d, %d)",
					tt.page, tt.lim, page, limit, tt.wantPage, tt.wantLim)
			}
		})
	}
}

// validateImageURL is the only guard between an admin form and a stored image
// URL, so the shapes it accepts are pinned here.
func TestValidateImageURL(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    string
		wantErr bool
	}{
		{"app-relative path", "/products/shalvar.webp", "/products/shalvar.webp", false},
		{"http url", "http://cdn.example.com/a.png", "http://cdn.example.com/a.png", false},
		{"https url", "https://cdn.example.com/a.png", "https://cdn.example.com/a.png", false},
		{"surrounding spaces are trimmed", "  /products/a.webp  ", "/products/a.webp", false},
		{"empty is rejected", "", "", true},
		{"whitespace is rejected", "   ", "", true},
		{"protocol-relative is rejected", "//evil.example/x.png", "", true},
		{"a bare relative path is rejected", "products/a.webp", "", true},
		{"javascript scheme is rejected", "javascript:alert(1)", "", true},
		{"data scheme is rejected", "data:image/png;base64,AAAA", "", true},
		{"scheme without a host is rejected", "http://", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := validateImageURL(tt.in)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("validateImageURL(%q) = %q, want an error", tt.in, got)
				}
				if !errors.Is(err, model.ErrValidation) {
					t.Fatalf("errors.Is(%v, model.ErrValidation) = false, want true", err)
				}
				if got != "" {
					t.Fatalf("validateImageURL(%q) = %q, want an empty string on failure", tt.in, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("validateImageURL(%q) error = %v, want nil", tt.in, err)
			}
			if got != tt.want {
				t.Fatalf("validateImageURL(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestValidateCoupon(t *testing.T) {
	tests := []struct {
		name    string
		coupon  model.Coupon
		wantErr bool
	}{
		{"valid percent", model.Coupon{Code: "OFF10", Type: model.CouponPercent, Amount: 10}, false},
		{"percent of one hundred", model.Coupon{Code: "FREE", Type: model.CouponPercent, Amount: 100}, false},
		{"percent above one hundred is rejected", model.Coupon{Code: "TOOMUCH", Type: model.CouponPercent, Amount: 101}, true},
		{"zero percent is rejected", model.Coupon{Code: "ZERO", Type: model.CouponPercent, Amount: 0}, true},
		{"valid fixed", model.Coupon{Code: "SAVE", Type: model.CouponFixed, Amount: 50_000}, false},
		{"zero fixed is rejected", model.Coupon{Code: "ZERO", Type: model.CouponFixed, Amount: 0}, true},
		{"negative fixed is rejected", model.Coupon{Code: "NEG", Type: model.CouponFixed, Amount: -1}, true},
		{"unknown type is rejected", model.Coupon{Code: "ODD", Type: "bogus", Amount: 10}, true},
		{"empty type is rejected", model.Coupon{Code: "ODD", Amount: 10}, true},
		{"empty code is rejected", model.Coupon{Code: "", Type: model.CouponPercent, Amount: 10}, true},
		{"negative minimum order is rejected", model.Coupon{Code: "OFF10", Type: model.CouponPercent, Amount: 10, MinOrder: -1}, true},
		{"negative max uses is rejected", model.Coupon{Code: "OFF10", Type: model.CouponPercent, Amount: 10, MaxUses: -1}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateCoupon(&tt.coupon)
			if tt.wantErr {
				if err == nil {
					t.Fatal("validateCoupon() = nil, want a validation failure")
				}
				if !errors.Is(err, model.ErrValidation) {
					t.Fatalf("errors.Is(%v, model.ErrValidation) = false, want true", err)
				}
				return
			}
			if err != nil {
				t.Fatalf("validateCoupon() = %v, want nil", err)
			}
		})
	}
}
