// Package httpx holds the HTTP response shape shared by handlers and
// middleware. Keeping it separate avoids an import cycle between those
// packages.
package httpx

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/shalvarsara/backend/internal/model"
)

// APIError is the body of every failed request.
type APIError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type errorEnvelope struct {
	Error APIError `json:"error"`
}

// OK writes a 200 response.
func OK(c *fiber.Ctx, data any) error {
	return c.JSON(data)
}

// Created writes a 201 response.
func Created(c *fiber.Ctx, data any) error {
	return c.Status(fiber.StatusCreated).JSON(data)
}

// NoContent writes a 204 response.
func NoContent(c *fiber.Ctx) error {
	return c.SendStatus(fiber.StatusNoContent)
}

// Fail maps a domain error to the shared error envelope and status code.
// Unexpected errors are logged server-side and never leaked to the client.
func Fail(c *fiber.Ctx, err error) error {
	status, apiErr := MapError(err)
	if status >= fiber.StatusInternalServerError {
		log.Error().Err(err).Str("path", c.Path()).Msg("unhandled request error")
	}
	return c.Status(status).JSON(errorEnvelope{Error: apiErr})
}

// MapError translates a domain error into an HTTP status and a localized body.
func MapError(err error) (int, APIError) {
	var (
		ve     *ValidationError
		minErr *model.CouponMinOrderError
		user   *model.UserFacingError
	)
	switch {
	case errors.As(err, &user):
		// Keep the status and code of the wrapped error, swap in the message the
		// customer should actually read. The wrapped error is always a sentinel or
		// a gateway error, never another UserFacingError; the guard below keeps
		// that assumption from turning into infinite recursion if it ever breaks.
		inner := user.Err
		var nested *model.UserFacingError
		if inner == nil || errors.As(inner, &nested) {
			inner = model.ErrPaymentFailed
		}
		status, apiErr := MapError(inner)
		apiErr.Message = user.Text
		return status, apiErr
	case errors.As(err, &ve):
		return fiber.StatusUnprocessableEntity, APIError{
			Code: "validation_error", Message: "داده‌های ورودی نامعتبر است.", Details: ve.Fields,
		}
	case errors.As(err, &minErr):
		return fiber.StatusBadRequest, APIError{
			Code: "coupon_min_order",
			Message: "برای استفاده از این کد تخفیف، حداقل " +
				PersianDigits(minErr.MinOrder) + " تومان خرید لازم است.",
		}
	case errors.Is(err, model.ErrNotFound):
		return fiber.StatusNotFound, APIError{Code: "not_found", Message: "موردی یافت نشد."}
	case errors.Is(err, model.ErrConflict):
		return fiber.StatusConflict, APIError{Code: "conflict", Message: "این مورد از قبل ثبت شده است."}
	case errors.Is(err, model.ErrInvalidCredential):
		return fiber.StatusUnauthorized, APIError{Code: "invalid_credentials", Message: "ایمیل یا رمز عبور نادرست است."}
	case errors.Is(err, model.ErrUnauthorized):
		return fiber.StatusUnauthorized, APIError{Code: "unauthorized", Message: "برای انجام این کار باید وارد شوید."}
	case errors.Is(err, model.ErrForbidden):
		return fiber.StatusForbidden, APIError{Code: "forbidden", Message: "شما به این بخش دسترسی ندارید."}
	case errors.Is(err, model.ErrValidation):
		return fiber.StatusUnprocessableEntity, APIError{Code: "validation_error", Message: "داده‌های ورودی نامعتبر است."}
	case errors.Is(err, model.ErrOutOfStock):
		return fiber.StatusConflict, APIError{Code: "out_of_stock", Message: "موجودی این محصول کافی نیست."}
	case errors.Is(err, model.ErrEmptyCart):
		return fiber.StatusBadRequest, APIError{Code: "empty_cart", Message: "سبد خرید شما خالی است."}
	case errors.Is(err, model.ErrInvalidCoupon):
		return fiber.StatusBadRequest, APIError{Code: "invalid_coupon", Message: "کد تخفیف معتبر نیست."}
	case errors.Is(err, model.ErrInvalidCode):
		return fiber.StatusUnprocessableEntity, APIError{
			Code: "invalid_verification_code", Message: "کد تأیید نادرست یا منقضی شده است.",
		}
	case errors.Is(err, model.ErrTooManyRequests):
		return fiber.StatusTooManyRequests, APIError{
			Code: "too_many_requests", Message: "درخواست‌های بیش از حد. لطفاً کمی بعد دوباره امتحان کنید.",
		}
	case errors.Is(err, model.ErrPaymentFailed):
		return fiber.StatusPaymentRequired, APIError{Code: "payment_failed", Message: "پرداخت انجام نشد."}
	default:
		return fiber.StatusInternalServerError, APIError{Code: "internal_error", Message: "خطای داخلی سرور. لطفاً بعداً تلاش کنید."}
	}
}
