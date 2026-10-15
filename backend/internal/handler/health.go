package handler

import (
	"context"
	"time"

	"github.com/gofiber/fiber/v2"
)

// HealthHandler reports service liveness and database readiness.
type HealthHandler struct {
	db pinger
}

type pinger interface {
	Health(ctx context.Context) error
}

// NewHealthHandler wires the health handler.
func NewHealthHandler(db pinger) *HealthHandler {
	return &HealthHandler{db: db}
}

// Live reports that the process is up (no dependencies checked).
func (h *HealthHandler) Live(c *fiber.Ctx) error {
	return OK(c, fiber.Map{
		"status": "ok",
		"time":   time.Now().UTC().Format(time.RFC3339),
	})
}

// Ready reports whether the database is reachable.
func (h *HealthHandler) Ready(c *fiber.Ctx) error {
	if err := h.db.Health(c.Context()); err != nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"status":   "unavailable",
			"database": "down",
		})
	}
	return OK(c, fiber.Map{"status": "ok", "database": "up"})
}
