package model

import "testing"

func TestPersianDigits(t *testing.T) {
	tests := []struct {
		name string
		in   int64
		want string
	}{
		{"zero", 0, "۰"},
		{"single digit", 7, "۷"},
		{"two digits", 42, "۴۲"},
		{"three digits", 999, "۹۹۹"},
		{"four digits groups once", 1000, "۱٬۰۰۰"},
		{"four digits uneven lead", 1234, "۱٬۲۳۴"},
		{"five digits", 12345, "۱۲٬۳۴۵"},
		{"six digits", 123456, "۱۲۳٬۴۵۶"},
		{"seven digits groups twice", 1_000_000, "۱٬۰۰۰٬۰۰۰"},
		{"seven digits uneven lead", 1_234_567, "۱٬۲۳۴٬۵۶۷"},
		{"eight digits", 20_000_000, "۲۰٬۰۰۰٬۰۰۰"},
		{"price with trailing zeros", 2_000_000, "۲٬۰۰۰٬۰۰۰"},
		{"negative small", -42, "−۴۲"},
		{"negative grouped", -1_234_567, "−۱٬۲۳۴٬۵۶۷"},
		{"min positive threshold", 100, "۱۰۰"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := PersianDigits(tt.in); got != tt.want {
				t.Fatalf("PersianDigits(%d) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

// PersianDigits is the only formatter used to build customer-facing money
// strings, so its separators must stay the Persian ones (U+066C thousands,
// U+2212 minus) rather than ASCII look-alikes.
func TestPersianDigitsSeparatorCodepoints(t *testing.T) {
	const (
		persianThousands = '\u066C'
		persianMinus     = '\u2212'
	)

	grouped := PersianDigits(1234567)
	separators := 0
	for _, r := range grouped {
		switch r {
		case persianThousands:
			separators++
		case ',':
			t.Errorf("PersianDigits(1234567) = %q, contains an ASCII comma", grouped)
		}
	}
	if separators != 2 {
		t.Errorf("PersianDigits(1234567) = %q, want 2 thousands separators, got %d", grouped, separators)
	}

	negative := PersianDigits(-1234567)
	if r := []rune(negative)[0]; r != persianMinus {
		t.Errorf("PersianDigits(-1234567) starts with %q, want the U+2212 minus", r)
	}
}

func containsRune(s string, want rune) bool {
	for _, r := range s {
		if r == want {
			return true
		}
	}
	return false
}
