package service

import (
	"context"
	"strings"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// CategoryService exposes category operations.
type CategoryService struct {
	categories *repository.CategoryRepository
}

// NewCategoryService wires the category service.
func NewCategoryService(categories *repository.CategoryRepository) *CategoryService {
	return &CategoryService{categories: categories}
}

// List returns all categories with product counts.
func (s *CategoryService) List(ctx context.Context) ([]model.CategoryWithCount, error) {
	return s.categories.List(ctx)
}

// GetBySlug returns one category.
func (s *CategoryService) GetBySlug(ctx context.Context, slug string) (*model.Category, error) {
	return s.categories.GetBySlug(ctx, strings.TrimSpace(slug))
}

// Create adds a category (admin).
func (s *CategoryService) Create(ctx context.Context, c *model.Category) (*model.Category, error) {
	return c, s.categories.Create(ctx, c)
}

// Update edits a category (admin).
func (s *CategoryService) Update(ctx context.Context, c *model.Category) (*model.Category, error) {
	return s.categories.Update(ctx, c)
}

// Delete removes a category (admin). Fails when products still reference it.
func (s *CategoryService) Delete(ctx context.Context, id int64) error {
	return s.categories.Delete(ctx, id)
}
