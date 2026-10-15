package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// UserHandler exposes the signed-in user's profile.
type UserHandler struct {
	users *service.UserService
}

// NewUserHandler wires the user handler.
func NewUserHandler(users *service.UserService) *UserHandler {
	return &UserHandler{users: users}
}

// UpdateProfileRequest is the payload for editing a profile.
type UpdateProfileRequest struct {
	Name  string `json:"name"  validate:"required,min=2,max=80"`
	Phone string `json:"phone" validate:"omitempty,max=20"`
}

// Me returns the signed-in user.
func (h *UserHandler) Me(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	return OK(c, user)
}

// UpdateMe updates the signed-in user's profile.
func (h *UserHandler) UpdateMe(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req UpdateProfileRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	updated, err := h.users.UpdateProfile(c.Context(), user.ID, req.Name, req.Phone)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, updated)
}
