package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// WishlistHandler exposes the signed-in customer's saved-for-later list. Like
// the cart, every write answers with the whole list, so the client never has to
// guess what the result was.
type WishlistHandler struct {
	wishlist *service.WishlistService
}

// NewWishlistHandler wires the wishlist handler.
func NewWishlistHandler(wishlist *service.WishlistService) *WishlistHandler {
	return &WishlistHandler{wishlist: wishlist}
}

// List returns the saved products, newest first.
func (h *WishlistHandler) List(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	page, err := h.wishlist.List(c.Context(), user.ID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// Add saves a product for later.
func (h *WishlistHandler) Add(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var in model.WishlistInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}

	page, err := h.wishlist.Add(c.Context(), user.ID, in.ProductID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// Remove drops a saved product. Removing one that is not saved is a no-op, so a
// double-tap on the heart is not an error.
func (h *WishlistHandler) Remove(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	productID, err := strconv.ParseInt(c.Params("productId"), 10, 64)
	if err != nil || productID <= 0 {
		return Fail(c, model.ErrNotFound)
	}

	page, err := h.wishlist.Remove(c.Context(), user.ID, productID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}
