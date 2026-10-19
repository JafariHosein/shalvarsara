package httpx

import "github.com/shalvarsara/backend/internal/model"

// PersianDigits renders n with Persian digits and the Persian thousands
// separator (U+066C), e.g. 2000000 -> "۲٬۰۰۰٬۰۰۰".
//
// The implementation lives in model so services can use it too; this is a
// re-export kept so the HTTP layer's existing call sites stay unchanged.
func PersianDigits(n int64) string { return model.PersianDigits(n) }
