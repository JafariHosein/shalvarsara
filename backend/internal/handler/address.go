package handler

import (
	"strconv"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// AddressHandler manages a user's shipping addresses.
type AddressHandler struct {
	addresses *service.AddressService
}

// NewAddressHandler wires the address handler.
func NewAddressHandler(addresses *service.AddressService) *AddressHandler {
	return &AddressHandler{addresses: addresses}
}

// AddressRequest is the payload for creating or editing an address.
type AddressRequest struct {
	ReceiverName string `json:"receiverName" validate:"required,min=2,max=80"`
	Phone        string `json:"phone"        validate:"required,max=20"`
	Province     string `json:"province"     validate:"required,max=60"`
	City         string `json:"city"         validate:"required,max=60"`
	PostalCode   string `json:"postalCode"   validate:"required,len=10,numeric"`
	Line1        string `json:"line1"        validate:"required,max=255"`
	Line2        string `json:"line2"        validate:"omitempty,max=255"`
	IsDefault    bool   `json:"isDefault"`
}

// List returns the signed-in user's addresses.
func (h *AddressHandler) List(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	list, err := h.addresses.List(c.Context(), user.ID)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, list)
}

// Create adds an address.
func (h *AddressHandler) Create(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req AddressRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	created, err := h.addresses.Create(c.Context(), user.ID, req.toModel(0))
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, created)
}

// Update edits an address owned by the signed-in user.
func (h *AddressHandler) Update(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return Fail(c, model.ErrNotFound)
	}

	var req AddressRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	updated, err := h.addresses.Update(c.Context(), user.ID, req.toModel(id))
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, updated)
}

// Delete removes an address owned by the signed-in user.
func (h *AddressHandler) Delete(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	id, err := strconv.ParseInt(c.Params("id"), 10, 64)
	if err != nil {
		return Fail(c, model.ErrNotFound)
	}
	if err := h.addresses.Delete(c.Context(), user.ID, id); err != nil {
		return Fail(c, err)
	}
	return NoContent(c)
}

func (r AddressRequest) toModel(id int64) *model.Address {
	return &model.Address{
		ID:           id,
		ReceiverName: r.ReceiverName,
		Phone:        r.Phone,
		Province:     r.Province,
		City:         r.City,
		PostalCode:   r.PostalCode,
		Line1:        r.Line1,
		Line2:        r.Line2,
		IsDefault:    r.IsDefault,
	}
}
