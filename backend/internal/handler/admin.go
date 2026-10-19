package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// AdminHandler exposes the management panel. Every route it serves sits behind
// RequireAuth + RequireAdmin, so the handlers themselves never re-check the
// role.
type AdminHandler struct {
	admin *service.AdminService
}

// NewAdminHandler wires the admin handler.
func NewAdminHandler(admin *service.AdminService) *AdminHandler {
	return &AdminHandler{admin: admin}
}

// paramID parses a positive :id path parameter, reporting a bad one as 404.
func paramID(c *fiber.Ctx) (int64, error) {
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil || id <= 0 {
		return 0, model.ErrNotFound
	}
	return id, nil
}

// badFilter reports an unusable list-filter value as a 400 with a message that
// names the field, instead of letting it fail as a database cast error.
func badFilter(field string) error {
	return &model.UserFacingError{
		Err:  model.ErrValidation,
		Text: "مقدار «" + field + "» در جستجو معتبر نیست.",
	}
}

// ---- dashboard ----

// Stats returns the dashboard numbers.
func (h *AdminHandler) Stats(c *fiber.Ctx) error {
	stats, err := h.admin.Stats(c.Context())
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, stats)
}

// ---- products ----

// ListProducts returns a page of the catalogue, deactivated products included.
//
// Query parameters: q, categoryId, active (true|false|all), sort, page, limit.
func (h *AdminHandler) ListProducts(c *fiber.Ctx) error {
	filter := model.ProductFilter{
		Query:      queryString(c, "q"),
		CategoryID: queryInt64Ptr(c, "categoryId"),
		Sort:       queryString(c, "sort"),
		Page:       queryInt(c, "page", 1),
		Limit:      queryInt(c, "limit", 20),
	}
	switch queryString(c, "active") {
	case "true", "1":
		v := true
		filter.IsActive = &v
	case "false", "0":
		v := false
		filter.IsActive = &v
	}

	page, err := h.admin.ListProducts(c.Context(), filter)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// GetProduct returns one product with its variants and gallery.
func (h *AdminHandler) GetProduct(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	product, err := h.admin.GetProduct(c.Context(), id)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, product)
}

// CreateProduct adds a product.
func (h *AdminHandler) CreateProduct(c *fiber.Ctx) error {
	var in model.AdminProductInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	product, err := h.admin.CreateProduct(c.Context(), in)
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, product)
}

// UpdateProduct edits a product (the form sends every field it owns).
func (h *AdminHandler) UpdateProduct(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminProductInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	product, err := h.admin.UpdateProduct(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, product)
}

// DeleteProduct soft-deletes a product so old orders keep working.
func (h *AdminHandler) DeleteProduct(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	if err := h.admin.DeleteProduct(c.Context(), id); err != nil {
		return Fail(c, err)
	}
	return NoContent(c)
}

// CreateVariant adds a size/colour combination.
func (h *AdminHandler) CreateVariant(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminVariantInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	product, err := h.admin.CreateVariant(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, product)
}

// UpdateVariant edits one variant.
func (h *AdminHandler) UpdateVariant(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminVariantInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	product, err := h.admin.UpdateVariant(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, product)
}

// DeleteVariant removes one variant.
func (h *AdminHandler) DeleteVariant(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	if err := h.admin.DeleteVariant(c.Context(), id); err != nil {
		return Fail(c, err)
	}
	return NoContent(c)
}

// CreateImage appends a gallery image.
func (h *AdminHandler) CreateImage(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminImageInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	product, err := h.admin.CreateImage(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, product)
}

// UpdateImage edits one gallery image.
func (h *AdminHandler) UpdateImage(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminImageInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	product, err := h.admin.UpdateImage(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, product)
}

// DeleteImage removes one gallery image.
func (h *AdminHandler) DeleteImage(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	if err := h.admin.DeleteImage(c.Context(), id); err != nil {
		return Fail(c, err)
	}
	return NoContent(c)
}

// ---- categories ----

// CreateCategory adds a category.
func (h *AdminHandler) CreateCategory(c *fiber.Ctx) error {
	var in model.AdminCategoryInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	category, err := h.admin.CreateCategory(c.Context(), in)
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, category)
}

// UpdateCategory edits a category.
func (h *AdminHandler) UpdateCategory(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminCategoryInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	category, err := h.admin.UpdateCategory(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, category)
}

// DeleteCategory removes an empty category.
func (h *AdminHandler) DeleteCategory(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	if err := h.admin.DeleteCategory(c.Context(), id); err != nil {
		return Fail(c, err)
	}
	return NoContent(c)
}

// ---- orders ----

// ListOrders returns a page of every order.
//
// Query parameters: q (code, name or phone), status, page, limit.
func (h *AdminHandler) ListOrders(c *fiber.Ctx) error {
	filter := model.AdminOrderFilter{
		Query:  queryString(c, "q"),
		Status: queryString(c, "status"),
		Page:   queryInt(c, "page", 1),
		Limit:  queryInt(c, "limit", 20),
	}
	// A mistyped status would otherwise reach a `::order_status` cast and come
	// back as an unhandled-error 500 instead of a message the admin can fix.
	if filter.Status != "" && filter.Status != "all" && !model.ValidOrderStatus(filter.Status) {
		return Fail(c, badFilter("وضعیت سفارش"))
	}
	page, err := h.admin.ListOrders(c.Context(), filter)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// ---- transactions ----

// ListPayments returns a page of payment attempts across every order.
//
// Query parameters: q (order code, authority or reference id), status
// (initiated, verified, failed or all), page, limit.
func (h *AdminHandler) ListPayments(c *fiber.Ctx) error {
	filter := model.AdminPaymentFilter{
		Query:  queryString(c, "q"),
		Status: queryString(c, "status"),
		Page:   queryInt(c, "page", 1),
		Limit:  queryInt(c, "limit", 20),
	}
	if filter.Status != "" && filter.Status != "all" && !model.ValidPaymentStatus(filter.Status) {
		return Fail(c, badFilter("وضعیت پرداخت"))
	}
	page, err := h.admin.ListPayments(c.Context(), filter)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// GetOrder returns one order with its lines, payment and shipment.
func (h *AdminHandler) GetOrder(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	order, err := h.admin.GetOrder(c.Context(), id)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, order)
}

// SetOrderStatus moves an order along the fulfilment pipeline.
func (h *AdminHandler) SetOrderStatus(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminStatusInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	order, err := h.admin.SetOrderStatus(c.Context(), id, in.Status)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, order)
}

// SaveShipment records the carrier and tracking code of an order.
func (h *AdminHandler) SaveShipment(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminShipmentInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	order, err := h.admin.SaveShipment(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, order)
}

// ---- users ----

// ListUsers returns a page of accounts with their order totals.
func (h *AdminHandler) ListUsers(c *fiber.Ctx) error {
	filter := model.AdminUserFilter{
		Query: queryString(c, "q"),
		Role:  queryString(c, "role"),
		Page:  queryInt(c, "page", 1),
		Limit: queryInt(c, "limit", 20),
	}
	if filter.Role != "" && filter.Role != "all" && !model.ValidRole(filter.Role) {
		return Fail(c, badFilter("نقش کاربر"))
	}
	page, err := h.admin.ListUsers(c.Context(), filter)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// UpdateUser changes a user's role or access.
func (h *AdminHandler) UpdateUser(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminUserInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	actor := middleware.CurrentUser(c)
	var actorID int64
	if actor != nil {
		actorID = actor.ID
	}
	user, err := h.admin.UpdateUser(c.Context(), actorID, id, in)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, user)
}

// ---- reviews ----

// ListReviews returns a page of customer reviews for moderation.
func (h *AdminHandler) ListReviews(c *fiber.Ctx) error {
	filter := model.AdminReviewFilter{
		Query:  queryString(c, "q"),
		Status: queryString(c, "status"),
		Page:   queryInt(c, "page", 1),
		Limit:  queryInt(c, "limit", 20),
	}
	page, err := h.admin.ListReviews(c.Context(), filter)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// SetReviewStatus approves or rejects a review.
func (h *AdminHandler) SetReviewStatus(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminReviewStatusInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	review, err := h.admin.SetReviewStatus(c.Context(), id, in.Status)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, review)
}

// ---- coupons ----

// ListCoupons returns a page of discount codes.
func (h *AdminHandler) ListCoupons(c *fiber.Ctx) error {
	page, err := h.admin.ListCoupons(c.Context(), queryString(c, "q"),
		queryInt(c, "page", 1), queryInt(c, "limit", 20))
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, page)
}

// CreateCoupon adds a discount code.
func (h *AdminHandler) CreateCoupon(c *fiber.Ctx) error {
	var in model.AdminCouponInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	coupon, err := h.admin.CreateCoupon(c.Context(), in)
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, coupon)
}

// UpdateCoupon edits a discount code.
func (h *AdminHandler) UpdateCoupon(c *fiber.Ctx) error {
	id, err := paramID(c)
	if err != nil {
		return Fail(c, err)
	}
	var in model.AdminCouponInput
	if err := bind(c, &in); err != nil {
		return Fail(c, err)
	}
	coupon, err := h.admin.UpdateCoupon(c.Context(), id, in)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, coupon)
}
