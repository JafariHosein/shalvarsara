package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/service"
)

// CategoryHandler exposes the category tree.
type CategoryHandler struct {
	categories *service.CategoryService
}

// NewCategoryHandler wires the category handler.
func NewCategoryHandler(categories *service.CategoryService) *CategoryHandler {
	return &CategoryHandler{categories: categories}
}

// List returns all categories with product counts.
func (h *CategoryHandler) List(c *fiber.Ctx) error {
	list, err := h.categories.List(c.Context())
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, list)
}
