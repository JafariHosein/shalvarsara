package service

import (
	"context"
	"strings"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

const (
	defaultPageSize = 12
	maxPageSize     = 60
)

// ProductService exposes the storefront catalogue.
type ProductService struct {
	products *repository.ProductRepository
}

// NewProductService wires the product service.
func NewProductService(products *repository.ProductRepository) *ProductService {
	return &ProductService{products: products}
}

// List returns a page of products for the given filter.
func (s *ProductService) List(ctx context.Context, f model.ProductFilter) (model.Page[model.Product], error) {
	f.Page, f.Limit = normalizePaging(f.Page, f.Limit)
	f.Query = strings.TrimSpace(f.Query)

	items, total, err := s.products.List(ctx, f)
	if err != nil {
		return model.Page[model.Product]{}, err
	}
	return model.NewPage(items, f.Page, f.Limit, total), nil
}

// GetBySlug returns a single product for the storefront.
func (s *ProductService) GetBySlug(ctx context.Context, slug string) (*model.Product, error) {
	return s.products.GetBySlug(ctx, strings.TrimSpace(slug), false)
}

// Related returns similar products from the same category.
func (s *ProductService) Related(ctx context.Context, slug string, limit int) ([]model.Product, error) {
	if limit <= 0 || limit > 12 {
		limit = 8
	}
	product, err := s.products.GetBySlug(ctx, slug, false)
	if err != nil {
		return nil, err
	}
	return s.products.Related(ctx, product.ID, product.CategoryID, limit)
}

// Suggest powers the live search box.
func (s *ProductService) Suggest(ctx context.Context, query string, limit int) ([]model.Product, error) {
	query = strings.TrimSpace(query)
	if len([]rune(query)) < 2 {
		return []model.Product{}, nil
	}
	if limit <= 0 || limit > 10 {
		limit = 6
	}
	return s.products.Suggest(ctx, query, limit)
}

// normalizePaging clamps page/limit into sane bounds.
func normalizePaging(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = defaultPageSize
	}
	if limit > maxPageSize {
		limit = maxPageSize
	}
	return page, limit
}
