package model

// Page is the standard envelope returned by every paginated list endpoint.
type Page[T any] struct {
	Items      []T   `json:"items"`
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"totalPages"`
}

// NewPage builds a page envelope, normalizing the paging fields.
func NewPage[T any](items []T, page, limit int, total int64) Page[T] {
	if items == nil {
		items = []T{}
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}
	return Page[T]{
		Items:      items,
		Page:       page,
		Limit:      limit,
		Total:      total,
		TotalPages: totalPages,
	}
}
