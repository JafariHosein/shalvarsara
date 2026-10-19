package handler

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/middleware"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/service"
)

// AuthHandler exposes the authentication endpoints.
type AuthHandler struct {
	auth *service.AuthService
	// testMode keeps the verification code in the response until a real SMS
	// panel is connected. It is the only place that behaviour lives.
	testMode bool
}

// NewAuthHandler wires the auth handler.
func NewAuthHandler(auth *service.AuthService, sms config.SMSConfig) *AuthHandler {
	return &AuthHandler{auth: auth, testMode: sms.TestMode}
}

// RegisterRequest is the sign-up payload. The code proves the customer owns the
// mobile number they registered with.
type RegisterRequest struct {
	Name     string `json:"name"     validate:"required,min=2,max=80"`
	Email    string `json:"email"    validate:"required,email,max=160"`
	Phone    string `json:"phone"    validate:"required,max=20"`
	Password string `json:"password" validate:"required,min=8,max=72"`
	Code     string `json:"code"     validate:"required,max=10"`
}

// RegisterCodeRequest asks for a verification code to be sent to a mobile.
type RegisterCodeRequest struct {
	Phone string `json:"phone" validate:"required,max=20"`
}

// registerCodeResponse tells the client when the code expires, and — while no
// SMS panel is wired up — carries the code itself.
type registerCodeResponse struct {
	Phone            string `json:"phone"`
	ExpiresInSeconds int    `json:"expiresInSeconds"`
	TestMode         bool   `json:"testMode"`
	Code             string `json:"code,omitempty"`
	Message          string `json:"message"`
}

// LoginRequest is the sign-in payload.
type LoginRequest struct {
	Email    string `json:"email"    validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

// RefreshRequest carries a refresh token.
type RefreshRequest struct {
	RefreshToken string `json:"refreshToken" validate:"required"`
}

// ChangePasswordRequest changes the signed-in user's password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"currentPassword" validate:"required"`
	NewPassword     string `json:"newPassword"     validate:"required,min=8,max=72"`
}

// authResponse is returned by register and login.
type authResponse struct {
	User   *model.User       `json:"user"`
	Tokens service.TokenPair `json:"tokens"`
}

// Register creates an account.
func (h *AuthHandler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	user, tokens, err := h.auth.Register(c.Context(), service.RegisterInput{
		Name:     req.Name,
		Email:    req.Email,
		Phone:    req.Phone,
		Password: req.Password,
		Code:     req.Code,
	})
	if err != nil {
		return Fail(c, err)
	}
	return Created(c, authResponse{User: user, Tokens: tokens})
}

// RegisterCode issues the SMS code that a sign-up must present.
//
// No SMS panel is connected yet, so in test mode the code comes back in the
// response body and the sign-up page shows it with an explanation. Once a panel
// is wired in, setting SMS_TEST_MODE=false is the whole switch: the code stops
// being serialized and the message changes accordingly.
func (h *AuthHandler) RegisterCode(c *fiber.Ctx) error {
	var req RegisterCodeRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	issued, err := h.auth.RequestRegisterCode(c.Context(), req.Phone)
	if err != nil {
		return Fail(c, err)
	}

	res := registerCodeResponse{
		// Echo the normalized number, so the client can match the code to the
		// field it belongs to no matter what was typed.
		Phone:            issued.Phone,
		ExpiresInSeconds: int(time.Until(issued.ExpiresAt).Seconds()),
		TestMode:         h.testMode,
		Message:          "کد تأیید ارسال شد.",
	}
	if h.testMode {
		res.Code = issued.Code
		res.Message = "کد تأیید ساخته شد. در حالت آزمایشی، کد روی همین صفحه نمایش داده می‌شود."
	}
	return OK(c, res)
}

// Login authenticates a user.
func (h *AuthHandler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	user, tokens, err := h.auth.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, authResponse{User: user, Tokens: tokens})
}

// Refresh exchanges a refresh token for a new pair.
func (h *AuthHandler) Refresh(c *fiber.Ctx) error {
	var req RefreshRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}

	user, tokens, err := h.auth.Refresh(c.Context(), req.RefreshToken)
	if err != nil {
		return Fail(c, err)
	}
	return OK(c, authResponse{User: user, Tokens: tokens})
}

// Logout revokes the caller's tokens server-side.
//
// The tokens are stateless, so "logging out" only means something if the server
// stops honouring them: the account's token version is bumped, which invalidates
// every access and refresh token issued before this call — including the copy a
// thief may be holding.
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	if err := h.auth.Logout(c.Context(), user.ID); err != nil {
		return Fail(c, err)
	}
	return NoContent(c)
}

// Me returns the signed-in user.
func (h *AuthHandler) Me(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}
	return OK(c, user)
}

// ChangePassword updates the signed-in user's password.
func (h *AuthHandler) ChangePassword(c *fiber.Ctx) error {
	user := middleware.CurrentUser(c)
	if user == nil {
		return Fail(c, model.ErrUnauthorized)
	}

	var req ChangePasswordRequest
	if err := bind(c, &req); err != nil {
		return Fail(c, err)
	}
	if err := h.auth.ChangePassword(c.Context(), user.ID, req.CurrentPassword, req.NewPassword); err != nil {
		return Fail(c, err)
	}
	return NoContent(c)
}
