package httpx

import (
	"errors"
	"fmt"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/model"
)

// sentinelStatus is the full mapping table from domain error to HTTP status.
func TestMapErrorSentinels(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   string
	}{
		{"not found", model.ErrNotFound, fiber.StatusNotFound, "not_found"},
		{"conflict", model.ErrConflict, fiber.StatusConflict, "conflict"},
		{"invalid credential", model.ErrInvalidCredential, fiber.StatusUnauthorized, "invalid_credentials"},
		{"unauthorized", model.ErrUnauthorized, fiber.StatusUnauthorized, "unauthorized"},
		{"forbidden", model.ErrForbidden, fiber.StatusForbidden, "forbidden"},
		{"validation", model.ErrValidation, fiber.StatusUnprocessableEntity, "validation_error"},
		{"out of stock", model.ErrOutOfStock, fiber.StatusConflict, "out_of_stock"},
		{"empty cart", model.ErrEmptyCart, fiber.StatusBadRequest, "empty_cart"},
		{"invalid coupon", model.ErrInvalidCoupon, fiber.StatusBadRequest, "invalid_coupon"},
		{"invalid code", model.ErrInvalidCode, fiber.StatusUnprocessableEntity, "invalid_verification_code"},
		{"too many requests", model.ErrTooManyRequests, fiber.StatusTooManyRequests, "too_many_requests"},
		{"review not allowed", model.ErrReviewNotAllowed, fiber.StatusUnprocessableEntity, "review_not_allowed"},
		{"payment failed", model.ErrPaymentFailed, fiber.StatusPaymentRequired, "payment_failed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, apiErr := MapError(tt.err)

			if status != tt.wantStatus {
				t.Errorf("status = %d, want %d", status, tt.wantStatus)
			}
			if apiErr.Code != tt.wantCode {
				t.Errorf("code = %q, want %q", apiErr.Code, tt.wantCode)
			}
			if apiErr.Message == "" {
				t.Error("message is empty, want a customer-facing message")
			}
			if apiErr.Details != nil {
				t.Errorf("details = %v, want nil for a sentinel", apiErr.Details)
			}
		})
	}
}

func TestMapErrorUnknown(t *testing.T) {
	tests := []struct {
		name string
		err  error
	}{
		{"a plain error", errors.New("database is on fire")},
		{"a wrapped unknown error", fmt.Errorf("query failed: %w", errors.New("boom"))},
		{"nil", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, apiErr := MapError(tt.err)

			if status != fiber.StatusInternalServerError {
				t.Fatalf("status = %d, want 500", status)
			}
			if apiErr.Code != "internal_error" {
				t.Fatalf("code = %q, want %q", apiErr.Code, "internal_error")
			}
			// The internal detail must never reach the client.
			if tt.err != nil && strings.Contains(apiErr.Message, tt.err.Error()) {
				t.Fatalf("message %q leaks the internal error %q", apiErr.Message, tt.err.Error())
			}
		})
	}
}

func TestMapErrorUserFacingError(t *testing.T) {
	const text = "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود."

	tests := []struct {
		name       string
		err        *model.UserFacingError
		wantStatus int
		wantCode   string
	}{
		{
			name:       "overrides the message and keeps the validation status",
			err:        &model.UserFacingError{Err: model.ErrValidation, Text: text},
			wantStatus: fiber.StatusUnprocessableEntity,
			wantCode:   "validation_error",
		},
		{
			name:       "keeps the payment status",
			err:        &model.UserFacingError{Err: model.ErrPaymentFailed, Text: "درگاه پاسخ نداد."},
			wantStatus: fiber.StatusPaymentRequired,
			wantCode:   "payment_failed",
		},
		{
			name:       "keeps the conflict status",
			err:        &model.UserFacingError{Err: model.ErrConflict, Text: "این شماره قبلاً ثبت شده است."},
			wantStatus: fiber.StatusConflict,
			wantCode:   "conflict",
		},
		{
			name:       "keeps the not-found status",
			err:        &model.UserFacingError{Err: model.ErrNotFound, Text: "تراکنشی پیدا نشد."},
			wantStatus: fiber.StatusNotFound,
			wantCode:   "not_found",
		},
		{
			name:       "keeps the too-many-requests status",
			err:        &model.UserFacingError{Err: model.ErrTooManyRequests, Text: "کمی بعد تلاش کنید."},
			wantStatus: fiber.StatusTooManyRequests,
			wantCode:   "too_many_requests",
		},
		{
			name:       "keeps the forbidden status",
			err:        &model.UserFacingError{Err: model.ErrForbidden, Text: "حساب غیرفعال است."},
			wantStatus: fiber.StatusForbidden,
			wantCode:   "forbidden",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, apiErr := MapError(tt.err)

			if status != tt.wantStatus {
				t.Fatalf("status = %d, want %d", status, tt.wantStatus)
			}
			if apiErr.Code != tt.wantCode {
				t.Fatalf("code = %q, want %q", apiErr.Code, tt.wantCode)
			}
			if apiErr.Message != tt.err.Text {
				t.Fatalf("message = %q, want the UserFacingError text %q", apiErr.Message, tt.err.Text)
			}
		})
	}
}

// The wrapper must survive errors.As and keep errors.Is working, because the
// services return it straight from repository results.
func TestUserFacingErrorUnwraps(t *testing.T) {
	err := &model.UserFacingError{Err: model.ErrForbidden, Text: "no"}

	if !errors.Is(err, model.ErrForbidden) {
		t.Fatal("errors.Is through *UserFacingError = false, want true")
	}
	if !strings.Contains(err.Error(), "no") {
		t.Fatalf("Error() = %q, want it to contain the text", err.Error())
	}
	// Mapping the wrapper matches mapping the inner sentinel.
	wrappedStatus, wrappedErr := MapError(err)
	innerStatus, innerErr := MapError(model.ErrForbidden)
	if wrappedStatus != innerStatus || wrappedErr.Code != innerErr.Code {
		t.Fatalf("wrapper maps to (%d, %q), inner maps to (%d, %q)",
			wrappedStatus, wrappedErr.Code, innerStatus, innerErr.Code)
	}
}

// The recursion guard: a UserFacingError wrapping another UserFacingError (or
// nothing at all) must not recurse forever.
func TestMapErrorUserFacingErrorWithNilInner(t *testing.T) {
	status, apiErr := MapError(&model.UserFacingError{Err: nil, Text: "custom"})

	if status != fiber.StatusPaymentRequired {
		t.Fatalf("status = %d, want the payment-required fallback", status)
	}
	if apiErr.Code != "payment_failed" {
		t.Fatalf("code = %q, want %q", apiErr.Code, "payment_failed")
	}
	if apiErr.Message != "custom" {
		t.Fatalf("message = %q, want %q", apiErr.Message, "custom")
	}
}

func TestMapErrorNestedUserFacingError(t *testing.T) {
	inner := &model.UserFacingError{Err: model.ErrForbidden, Text: "inner"}
	outer := &model.UserFacingError{Err: inner, Text: "outer"}

	status, apiErr := MapError(outer)

	if status != fiber.StatusPaymentRequired {
		t.Fatalf("status = %d, want the payment-required fallback (no infinite recursion)", status)
	}
	if apiErr.Message != "outer" {
		t.Fatalf("message = %q, want the outer text", apiErr.Message)
	}
}

func TestMapErrorValidationError(t *testing.T) {
	ve := &ValidationError{Fields: map[string]string{"name": "required"}}

	status, apiErr := MapError(ve)

	if status != fiber.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want 422", status)
	}
	if apiErr.Code != "validation_error" {
		t.Fatalf("code = %q, want %q", apiErr.Code, "validation_error")
	}

	details, ok := apiErr.Details.(map[string]string)
	if !ok {
		t.Fatalf("details is %T, want map[string]string", apiErr.Details)
	}
	if details["name"] != "required" {
		t.Fatalf("details = %v, want the field map from the ValidationError", details)
	}
}

func TestMapErrorCouponMinOrder(t *testing.T) {
	err := &model.CouponMinOrderError{MinOrder: 500_000}

	status, apiErr := MapError(err)

	if status != fiber.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
	if apiErr.Code != "coupon_min_order" {
		t.Fatalf("code = %q, want %q", apiErr.Code, "coupon_min_order")
	}
	// The minimum is rendered with Persian digits and grouping.
	if !strings.Contains(apiErr.Message, "\u06F5\u06F0\u06F0\u066C\u06F0\u06F0\u06F0") {
		t.Fatalf("message = %q, want it to contain the Persian-digit minimum", apiErr.Message)
	}

	// The specific error must still be reachable through the generic sentinel.
	if !errors.Is(err, model.ErrInvalidCoupon) {
		t.Fatal("the coupon minimum error no longer unwraps to ErrInvalidCoupon")
	}
}

// A domain error wrapped in extra context must map the same way, because
// repositories wrap driver errors before returning them.
func TestMapErrorThroughWrapping(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
		wantCode   string
	}{
		{"wrapped not found", fmt.Errorf("get user: %w", model.ErrNotFound), fiber.StatusNotFound, "not_found"},
		{"wrapped conflict", fmt.Errorf("insert: %w", model.ErrConflict), fiber.StatusConflict, "conflict"},
		{"wrapped out of stock", fmt.Errorf("reserve: %w", model.ErrOutOfStock), fiber.StatusConflict, "out_of_stock"},
		{
			name:       "wrapped user-facing error",
			err:        fmt.Errorf("verify: %w", &model.UserFacingError{Err: model.ErrPaymentFailed, Text: "gateway said no"}),
			wantStatus: fiber.StatusPaymentRequired,
			wantCode:   "payment_failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status, apiErr := MapError(tt.err)

			if status != tt.wantStatus {
				t.Errorf("status = %d, want %d", status, tt.wantStatus)
			}
			if apiErr.Code != tt.wantCode {
				t.Errorf("code = %q, want %q", apiErr.Code, tt.wantCode)
			}
		})
	}
}
