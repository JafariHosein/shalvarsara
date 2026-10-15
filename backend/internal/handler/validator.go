package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/httpx"
)

// ValidationError is re-exported from httpx.
type ValidationError = httpx.ValidationError

// bind parses and validates a JSON request body.
func bind(c *fiber.Ctx, dst any) error { return httpx.Bind(c, dst) }
