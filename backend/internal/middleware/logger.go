package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"
)

// Logger writes one structured line per request via zerolog.
func Logger() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		chainErr := c.Next()

		event := log.Info()
		status := c.Response().StatusCode()
		if status >= fiber.StatusInternalServerError {
			event = log.Error()
		} else if status >= fiber.StatusBadRequest {
			event = log.Warn()
		}

		event.
			Str("method", c.Method()).
			Str("path", c.Path()).
			Int("status", status).
			Dur("latency", time.Since(start)).
			Str("ip", c.IP()).
			Msg("request")

		return chainErr
	}
}
