package model

import "time"

// Category groups products. ParentID is nil for top-level categories.
type Category struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	ParentID  *int64    `json:"parentId,omitempty"`
	SortOrder int32     `json:"sortOrder"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// CategoryWithCount adds aggregate data used by the storefront menu.
type CategoryWithCount struct {
	Category
	ProductCount int64 `json:"productCount"`
}
