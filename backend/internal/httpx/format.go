package httpx

import (
	"strconv"
	"strings"
)

// PersianDigits renders n with Persian digits and the Persian thousands
// separator (U+066C), e.g. 2000000 -> "۲٬۰۰۰٬۰۰۰".
//
// Money in this project is an integer Toman everywhere; only the presentation
// differs, and server-side error messages should read like the storefront.
func PersianDigits(n int64) string {
	digits := [...]rune{'۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'}

	var b strings.Builder
	if n < 0 {
		b.WriteRune('−')
		n = -n
	}

	s := strconv.FormatInt(n, 10)
	lead := len(s) % 3
	if lead == 0 {
		lead = 3
	}
	for i := 0; i < len(s); i++ {
		if i > 0 && (i-lead)%3 == 0 {
			b.WriteRune('٬')
		}
		b.WriteRune(digits[s[i]-'0'])
	}
	return b.String()
}
