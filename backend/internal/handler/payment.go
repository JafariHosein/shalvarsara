package handler

import (
	"net/url"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// PaymentHandler exposes the ZarinPal flow: start, browser callback and status.
type PaymentHandler struct {
	payments *service.PaymentService
	cfg      config.ZarinPalConfig
}

// NewPaymentHandler wires the payment handler.
func NewPaymentHandler(payments *service.PaymentService, cfg config.ZarinPalConfig) *PaymentHandler {
	return &PaymentHandler{payments: payments, cfg: cfg}
}

// StartPaymentRequest opens a payment session for an order.
type StartPaymentRequest struct {
	OrderID int64 `json:"orderId" validate:"required,gt=0"`
}

// Start asks the gateway for a session and returns the page to redirect to.
func (h *PaymentHandler) Start(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req StartPaymentRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	start, err := h.payments.Start(c.Context(), user.ID, req.OrderID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, start)
}

// Callback is where the gateway sends the customer's browser back to. It must
// stay public — the browser arrives without an Authorization header — so it
// answers with a redirect to the storefront result page rather than with JSON.
//
// A callback that identifies no usable payment still redirects: showing a raw
// JSON error page to a customer coming back from their bank would be worse.
func (h *PaymentHandler) Callback(c *fiber.Ctx) error {
	authority := firstNonEmpty(c.Query("Authority"), c.Query("authority"))
	status := firstNonEmpty(c.Query("Status"), c.Query("status"))

	outcome, err := h.payments.Callback(c.Context(), authority, status)
	if err != nil {
		return c.Redirect(h.resultURL(0, "error"), fiber.StatusSeeOther)
	}

	state := "failed"
	if outcome.Paid {
		state = "ok"
	}
	return c.Redirect(h.resultURL(outcome.OrderID, state), fiber.StatusSeeOther)
}

// Status returns the freshest state of an order so the result page can render it
// after the redirect. It is scoped to the signed-in user like every /orders read.
func (h *PaymentHandler) Status(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	id, err := orderID(c)
	if err != nil {
		return Fail(c, err)
	}
	order, err := h.payments.Status(c.Context(), user.ID, id)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, order)
}

// resultURL builds the storefront URL the customer lands on after paying. The
// order id travels in the query string; reading the order still needs a token,
// so a shared or bookmarked link leaks nothing.
func (h *PaymentHandler) resultURL(orderID int64, state string) string {
	base := strings.TrimSpace(h.cfg.ResultURL)
	if base == "" {
		base = "http://localhost:5173/payment/result"
	}
	parsed, err := url.Parse(base)
	if err != nil {
		return base
	}
	query := parsed.Query()
	if orderID > 0 {
		query.Set("order", strconv.FormatInt(orderID, 10))
	}
	query.Set("status", state)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}
