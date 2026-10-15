package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// OrderHandler exposes checkout and the customer's order history.
type OrderHandler struct {
	orders *service.OrderService
}

// NewOrderHandler wires the order handler.
func NewOrderHandler(orders *service.OrderService) *OrderHandler {
	return &OrderHandler{orders: orders}
}

// CreateOrderRequest places an order from the current cart.
type CreateOrderRequest struct {
	AddressID  int64  `json:"addressId"  validate:"required,gt=0"`
	CouponCode string `json:"couponCode" validate:"omitempty,max=40"`
	Note       string `json:"note"       validate:"omitempty,max=500"`
}

// PreviewOrderRequest prices the current cart before anything is written.
type PreviewOrderRequest struct {
	CouponCode string `json:"couponCode" validate:"omitempty,max=40"`
}

// Preview prices the current cart with the same rules Create uses.
func (h *OrderHandler) Preview(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req PreviewOrderRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	preview, err := h.orders.Preview(c.Context(), user.ID, req.CouponCode)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, preview)
}

// Create turns the current cart into an order and empties the cart.
func (h *OrderHandler) Create(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req CreateOrderRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	order, err := h.orders.Create(c.Context(), user.ID, service.CreateOrderInput{
		AddressID:  req.AddressID,
		CouponCode: req.CouponCode,
		Note:       req.Note,
	})
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, order)
}

// List returns a page of the signed-in user's orders, newest first.
func (h *OrderHandler) List(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	page, err := h.orders.List(c.Context(), user.ID, queryInt(c, "page", 1), queryInt(c, "limit", 10))
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// Get returns one of the signed-in user's orders.
func (h *OrderHandler) Get(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	id, err := orderID(c)
	if err != nil {
		return Fail(c, err)
	}
	order, err := h.orders.Get(c.Context(), user.ID, id)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, order)
}

// orderID parses the :id path parameter, reporting a missing order as 404.
func orderID(c *fiber.Ctx) (int64, error) {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, model.ErrNotFound
	}
	return id, nil
}
