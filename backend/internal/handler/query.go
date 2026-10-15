package handler

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// queryInt reads an integer query parameter, returning def when absent/invalid.
func queryInt(c *fiber.Ctx, key string, def int) int {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return def
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return n
}

// queryInt64Ptr returns a pointer to the parsed value, or nil when absent.
func queryInt64Ptr(c *fiber.Ctx, key string) *int64 {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}
	n, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return nil
	}
	return &n
}

// queryBoolPtr returns a pointer to the parsed boolean, or nil when absent.
func queryBoolPtr(c *fiber.Ctx, key string) *bool {
	raw := strings.TrimSpace(c.Query(key))
	if raw == "" {
		return nil
	}
	b, err := strconv.ParseBool(raw)
	if err != nil {
		// Treat "1"/"0" leniently as well.
		switch raw {
		case "1":
			t := true
			return &t
		case "0":
			f := false
			return &f
		}
		return nil
	}
	return &b
}

// queryString returns a trimmed query parameter.
func queryString(c *fiber.Ctx, key string) string {
	return strings.TrimSpace(c.Query(key))
}
