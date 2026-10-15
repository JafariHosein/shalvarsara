package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// ProductHandler exposes the catalogue to the storefront.
type ProductHandler struct {
	products *service.ProductService
}

// NewProductHandler wires the product handler.
func NewProductHandler(products *service.ProductService) *ProductHandler {
	return &ProductHandler{products: products}
}

// List returns a filtered, sorted, paginated page of products.
//
// Supported query parameters: q, category, categoryId, size, color, minPrice,
// maxPrice, inStock, featured, gender, pantType, sort, page, limit.
func (h *ProductHandler) List(c *fiber.Ctx) error {
	filter := model.ProductFilter{
		Query:        queryString(c, "q"),
		CategorySlug: queryString(c, "category"),
		CategoryID:   queryInt64Ptr(c, "categoryId"),
		Size:         queryString(c, "size"),
		Color:        queryString(c, "color"),
		MinPrice:     queryInt64Ptr(c, "minPrice"),
		MaxPrice:     queryInt64Ptr(c, "maxPrice"),
		InStock:      queryBoolPtr(c, "inStock"),
		IsFeatured:   queryBoolPtr(c, "featured"),
		Gender:       queryString(c, "gender"),
		PantType:     queryString(c, "pantType"),
		Sort:         queryString(c, "sort"),
		Page:         queryInt(c, "page", 1),
		Limit:        queryInt(c, "limit", 12),
	}

	page, err := h.products.List(c.Context(), filter)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// Get returns one product by slug.
func (h *ProductHandler) Get(c *fiber.Ctx) error {
	product, err := h.products.GetBySlug(c.Context(), c.Params("slug"))
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, product)
}

// Related returns similar products for a product slug.
func (h *ProductHandler) Related(c *fiber.Ctx) error {
	items, err := h.products.Related(c.Context(), c.Params("slug"), queryInt(c, "limit", 8))
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, items)
}

// Suggest powers the live search box.
func (h *ProductHandler) Suggest(c *fiber.Ctx) error {
	items, err := h.products.Suggest(c.Context(), queryString(c, "q"), queryInt(c, "limit", 6))
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, items)
}
