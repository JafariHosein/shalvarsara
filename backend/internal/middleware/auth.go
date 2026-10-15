// Package middleware contains Fiber middleware: authentication, authorization
// and request-scoped helpers.
package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/httpx"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
	"github.com/shalvarsara/backend/internal/service"
)

const localUserKey = "authUser"

// Auth enforces JWT authentication.
type Auth struct {
	tokens *service.TokenService
	users  *repository.UserRepository
}

// NewAuth wires the auth middleware.
func NewAuth(tokens *service.TokenService, users *repository.UserRepository) *Auth {
	return &Auth{tokens: tokens, users: users}
}

// RequireAuth rejects the request unless it carries a valid access token for an
// active user. The user is loaded from the database so deactivations and role
// changes take effect immediately rather than at token expiry.
func (a *Auth) RequireAuth(c *fiber.Ctx) error {
	raw, ok := bearerToken(c)
	if !ok {
		return httpx.Fail(c, model.ErrUnauthorized)
	}

	claims, err := a.tokens.Parse(raw, service.TokenAccess)
	if err != nil {
		return httpx.Fail(c, model.ErrUnauthorized)
	}

	user, err := a.users.GetByID(c.Context(), claims.UserID)
	if err != nil {
		return httpx.Fail(c, model.ErrUnauthorized)
	}
	if !user.IsActive {
		return httpx.Fail(c, model.ErrForbidden)
	}

	c.Locals(localUserKey, user)
	return c.Next()
}

// RequireAdmin must run after RequireAuth; it rejects non-admin users.
func (a *Auth) RequireAdmin(c *fiber.Ctx) error {
	user := CurrentUser(c)
	if user == nil {
		return httpx.Fail(c, model.ErrUnauthorized)
	}
	if !user.IsAdmin() {
		return httpx.Fail(c, model.ErrForbidden)
	}
	return c.Next()
}

// CurrentUser returns the authenticated user, or nil when unauthenticated.
func CurrentUser(c *fiber.Ctx) *model.User {
	user, ok := c.Locals(localUserKey).(*model.User)
	if !ok {
		return nil
	}
	return user
}

// bearerToken extracts the token from an "Authorization: Bearer <token>" header.
func bearerToken(c *fiber.Ctx) (string, bool) {
	header := c.Get(fiber.HeaderAuthorization)
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return "", false
	}
	token := strings.TrimSpace(header[len(prefix):])
	return token, token != ""
}
