package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// CategoryRepository persists product categories.
type CategoryRepository struct {
	db *database.Pool
}

// NewCategoryRepository wires a repository to the shared pool.
func NewCategoryRepository(db *database.Pool) *CategoryRepository {
	return &CategoryRepository{db: db}
}

const categoryColumns = `id, name, slug, parent_id, sort_order, created_at, updated_at`

func scanCategory(row pgx.Row) (*model.Category, error) {
	var c model.Category
	err := row.Scan(&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

// List returns every category with the number of active products it holds.
func (r *CategoryRepository) List(ctx context.Context) ([]model.CategoryWithCount, error) {
	const q = `
		SELECT c.id, c.name, c.slug, c.parent_id, c.sort_order, c.created_at, c.updated_at,
		       count(p.id) FILTER (WHERE p.is_active AND p.deleted_at IS NULL) AS product_count
		FROM categories c
		LEFT JOIN products p ON p.category_id = c.id
		GROUP BY c.id
		ORDER BY c.sort_order, c.id`

	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.CategoryWithCount, 0, 8)
	for rows.Next() {
		var c model.CategoryWithCount
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Slug, &c.ParentID, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt,
			&c.ProductCount,
		); err != nil {
			return nil, err
		}
		list = append(list, c)
	}
	return list, rows.Err()
}

// GetByID returns a category by primary key.
func (r *CategoryRepository) GetByID(ctx context.Context, id int64) (*model.Category, error) {
	return scanCategory(r.db.QueryRow(ctx, `SELECT `+categoryColumns+` FROM categories WHERE id = $1`, id))
}

// GetBySlug returns a category by its URL slug.
func (r *CategoryRepository) GetBySlug(ctx context.Context, slug string) (*model.Category, error) {
	return scanCategory(r.db.QueryRow(ctx, `SELECT `+categoryColumns+` FROM categories WHERE slug = $1`, slug))
}

// Create inserts a category.
func (r *CategoryRepository) Create(ctx context.Context, c *model.Category) error {
	const q = `
		INSERT INTO categories (name, slug, parent_id, sort_order)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at`
	err := r.db.QueryRow(ctx, q, c.Name, c.Slug, c.ParentID, c.SortOrder).
		Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if isUniqueViolation(err) {
		return model.ErrConflict
	}
	return err
}

// Update modifies a category.
func (r *CategoryRepository) Update(ctx context.Context, c *model.Category) (*model.Category, error) {
	const q = `
		UPDATE categories SET name = $2, slug = $3, parent_id = $4, sort_order = $5
		WHERE id = $1
		RETURNING ` + categoryColumns
	updated, err := scanCategory(r.db.QueryRow(ctx, q, c.ID, c.Name, c.Slug, c.ParentID, c.SortOrder))
	if isUniqueViolation(err) {
		return nil, model.ErrConflict
	}
	return updated, err
}

// Delete removes a category. It fails with ErrConflict when products still
// reference it (ON DELETE RESTRICT on products.category_id).
func (r *CategoryRepository) Delete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM categories WHERE id = $1`, id)
	if isForeignKeyViolation(err) {
		return model.ErrConflict
	}
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}
