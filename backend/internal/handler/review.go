package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// ReviewHandler exposes product reviews: everybody reads the published ones,
// only a signed-in buyer writes.
type ReviewHandler struct {
	reviews *service.ReviewService
}

// NewReviewHandler wires the review handler.
func NewReviewHandler(reviews *service.ReviewService) *ReviewHandler {
	return &ReviewHandler{reviews: reviews}
}

// List returns the published reviews of one product with its rating breakdown.
func (h *ReviewHandler) List(c *fiber.Ctx) error {
	view, err := h.reviews.List(c.Context(), c.Params("slug"), queryInt(c, "page", 1), queryInt(c, "limit", 6))
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, view)
}

// Mine reports whether the signed-in customer may review the product and what
// they already wrote.
func (h *ReviewHandler) Mine(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	view, err := h.reviews.Mine(c.Context(), c.Params("slug"), user.ID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, view)
}

// Create stores the customer's review (or their edit) and returns it waiting
// for moderation.
func (h *ReviewHandler) Create(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var in model.ReviewInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}

	review, err := h.reviews.Create(c.Context(), c.Params("slug"), user.ID, in)
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, review)
}
