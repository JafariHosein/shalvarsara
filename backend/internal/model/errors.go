// Package model holds the domain types shared across the layers. It knows
// nothing about HTTP or SQL.
package model

import "errors"

// Sentinel errors. Repositories and services return these; the HTTP layer maps
// them to status codes so handlers never inspect driver errors.
var (
	ErrNotFound          = errors.New("not found")
	ErrConflict          = errors.New("already exists")
	ErrUnauthorized      = errors.New("unauthorized")
	ErrForbidden         = errors.New("forbidden")
	ErrValidation        = errors.New("validation failed")
	ErrInvalidCredential = errors.New("invalid credentials")
	ErrOutOfStock        = errors.New("out of stock")
	ErrEmptyCart         = errors.New("empty cart")
	ErrInvalidCoupon     = errors.New("invalid coupon")
	ErrPaymentFailed     = errors.New("payment failed")
	ErrInvalidCode       = errors.New("invalid verification code")
	ErrTooManyRequests   = errors.New("too many requests")
)

// UserFacingError wraps a sentinel error with a message that is safe and useful
// to show a customer — for example the reason a payment gateway gave. The HTTP
// layer keeps the status code of the wrapped error but replaces its generic
// message with Text.
type UserFacingError struct {
	Err  error
	Text string
}

// Error implements the error interface.
func (e *UserFacingError) Error() string { return e.Err.Error() + ": " + e.Text }

// Unwrap keeps errors.Is(err, sentinel) working through the wrapper.
func (e *UserFacingError) Unwrap() error { return e.Err }
