package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// CartHandler exposes the signed-in user's cart.
type CartHandler struct {
	cart *service.CartService
}

// NewCartHandler wires the cart handler.
func NewCartHandler(cart *service.CartService) *CartHandler {
	return &CartHandler{cart: cart}
}

// AddCartItemRequest puts a product/variant in the cart.
type AddCartItemRequest struct {
	ProductID int64  `json:"productId" validate:"required,gt=0"`
	VariantID *int64 `json:"variantId" validate:"omitempty,gt=0"`
	Quantity  int32  `json:"quantity"  validate:"required,gte=1,lte=99"`
}

// UpdateCartItemRequest sets an absolute quantity for one line.
type UpdateCartItemRequest struct {
	Quantity int32 `json:"quantity" validate:"required,gte=1,lte=99"`
}

// MergeCartRequest folds the browser's guest cart into the account's cart.
type MergeCartRequest struct {
	Items []MergeCartLine `json:"items" validate:"max=100,dive"`
}

// MergeCartLine is one guest line.
type MergeCartLine struct {
	ProductID int64  `json:"productId" validate:"required,gt=0"`
	VariantID *int64 `json:"variantId" validate:"omitempty,gt=0"`
	Quantity  int32  `json:"quantity"  validate:"required,gte=1,lte=99"`
}

// mergeCartResponse reports which guest lines could not be carried over.
type mergeCartResponse struct {
	Cart *model.CartView `json:"cart"`
	// Skipped counts guest lines that were delisted or out of stock.
	Skipped int32 `json:"skipped"`
}

// Get returns the signed-in user's cart. Users who never added anything get an
// empty cart rather than a 404.
func (h *CartHandler) Get(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	view, err := h.cart.Get(c.Context(), user.ID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, view)
}

// AddItem adds a product to the cart and returns the whole cart.
func (h *CartHandler) AddItem(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req AddCartItemRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	view, err := h.cart.Add(c.Context(), user.ID, model.CartLineInput{
		ProductID: req.ProductID,
		VariantID: req.VariantID,
		Quantity:  req.Quantity,
	})
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, view)
}

// UpdateItem changes the quantity of one line.
func (h *CartHandler) UpdateItem(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	id, err := itemID(c)
	if err != nil {
		return Fail(c, err)
	}

	var req UpdateCartItemRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	view, err := h.cart.SetQuantity(c.Context(), user.ID, id, req.Quantity)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, view)
}

// DeleteItem removes one line.
func (h *CartHandler) DeleteItem(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	id, err := itemID(c)
	if err != nil {
		return Fail(c, err)
	}

	view, err := h.cart.Remove(c.Context(), user.ID, id)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, view)
}

// Clear empties the cart.
func (h *CartHandler) Clear(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	view, err := h.cart.Clear(c.Context(), user.ID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, view)
}

// Merge folds the guest cart sent by the browser into the account's cart.
func (h *CartHandler) Merge(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req MergeCartRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	inputs := make([]model.CartLineInput, 0, len(req.Items))
	for _, item := range req.Items {
		inputs = append(inputs, model.CartLineInput{
			ProductID: item.ProductID,
			VariantID: item.VariantID,
			Quantity:  item.Quantity,
		})
	}

	view, skipped, err := h.cart.Merge(c.Context(), user.ID, inputs)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, mergeCartResponse{Cart: view, Skipped: skipped})
}

// itemID parses the :id path parameter, reporting a missing line as 404.
func itemID(c *fiber.Ctx) (int64, error) {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, model.ErrNotFound
	}
	return id, nil
}
