// Package handler implements the HTTP layer. Handlers translate between
// transport types and services; the response shape itself lives in httpx so it
// can also be used by middleware.
package handler

import (
	"github.com/gofiber/fiber/v2"

	"github.com/shalvarsara/backend/internal/httpx"
)

// APIError is re-exported for handler signatures and tests.
type APIError = httpx.APIError

// OK writes a 200 response.
func OK(c *fiber.Ctx, data any) error { return httpx.OK(c, data) }

// Created writes a 201 response.
func Created(c *fiber.Ctx, data any) error { return httpx.Created(c, data) }

// NoContent writes a 204 response.
func NoContent(c *fiber.Ctx) error { return httpx.NoContent(c) }

// Fail maps a domain error to the shared error envelope and status code.
func Fail(c *fiber.Ctx, err error) error { return httpx.Fail(c, err) }
