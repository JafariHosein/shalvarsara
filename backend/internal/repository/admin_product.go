package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/model"
)

// This file holds the write side of the catalogue: the admin panel creates and
// edits products, their variants and their gallery images here. Reads live in
// product.go.

// ProductSlugTaken reports whether a slug is already in use. Soft-deleted
// products keep their slug reserved, matching the plain UNIQUE constraint on the
// column — a recycled slug would silently repoint an old link at a new product.
func (r *ProductRepository) ProductSlugTaken(ctx context.Context, slug string, exceptID int64) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS (
			SELECT 1 FROM products WHERE slug = $1 AND id <> $2
		)`, slug, exceptID).Scan(&exists)
	return exists, err
}

// Create inserts a product and returns its id and timestamps.
func (r *ProductRepository) Create(ctx context.Context, p *model.Product) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO products (
			title, slug, short_desc, description, category_id, brand, gender,
			pant_type, fabric, price, discount_price, stock, sku, is_active, is_featured
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULLIF($13, ''), $14, $15
		)
		RETURNING id, created_at, updated_at`,
		p.Title, p.Slug, p.ShortDesc, p.Description, p.CategoryID, p.Brand, p.Gender,
		p.PantType, p.Fabric, p.Price, p.DiscountPrice, p.Stock, p.SKU, p.IsActive, p.IsFeatured,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if isUniqueViolation(err) {
		return model.ErrConflict
	}
	return err
}

// Update rewrites every writable product column and returns the stored row.
func (r *ProductRepository) Update(ctx context.Context, p *model.Product) (*model.Product, error) {
	tag, err := r.db.Exec(ctx, `
		UPDATE products SET
			title = $2, slug = $3, short_desc = $4, description = $5, category_id = $6,
			brand = $7, gender = $8, pant_type = $9, fabric = $10, price = $11,
			discount_price = $12, stock = $13, sku = NULLIF($14, ''),
			is_active = $15, is_featured = $16
		WHERE id = $1 AND deleted_at IS NULL`,
		p.ID, p.Title, p.Slug, p.ShortDesc, p.Description, p.CategoryID,
		p.Brand, p.Gender, p.PantType, p.Fabric, p.Price,
		p.DiscountPrice, p.Stock, p.SKU, p.IsActive, p.IsFeatured)
	if isUniqueViolation(err) {
		return nil, model.ErrConflict
	}
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, model.ErrNotFound
	}
	return r.GetByID(ctx, p.ID, true)
}

// SoftDelete hides a product without breaking the orders that reference it.
func (r *ProductRepository) SoftDelete(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE products SET is_active = FALSE, deleted_at = now()
		WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// ---------- variants ----------

// CreateVariant adds one size/colour combination.
func (r *ProductRepository) CreateVariant(ctx context.Context, v *model.ProductVariant) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO product_variants (product_id, size, color, color_hex, stock, sku, extra_price)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7)
		RETURNING id`,
		v.ProductID, v.Size, v.Color, v.ColorHex, v.Stock, v.SKU, v.ExtraPrice,
	).Scan(&v.ID)
	if isUniqueViolation(err) {
		return model.ErrConflict
	}
	return err
}

// UpdateVariant rewrites one variant and returns the stored row.
func (r *ProductRepository) UpdateVariant(ctx context.Context, v *model.ProductVariant) (*model.ProductVariant, error) {
	err := r.db.QueryRow(ctx, `
		UPDATE product_variants SET
			size = $2, color = $3, color_hex = $4, stock = $5,
			sku = NULLIF($6, ''), extra_price = $7
		WHERE id = $1
		RETURNING id, product_id, size, color, color_hex, stock, COALESCE(sku, ''), extra_price`,
		v.ID, v.Size, v.Color, v.ColorHex, v.Stock, v.SKU, v.ExtraPrice,
	).Scan(&v.ID, &v.ProductID, &v.Size, &v.Color, &v.ColorHex, &v.Stock, &v.SKU, &v.ExtraPrice)
	if isUniqueViolation(err) {
		return nil, model.ErrConflict
	}
	return v, err
}

// DeleteVariant removes one variant. Order lines keep their snapshot; the
// foreign key is ON DELETE SET NULL.
func (r *ProductRepository) DeleteVariant(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM product_variants WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// FindVariant loads one variant by id.
func (r *ProductRepository) FindVariant(ctx context.Context, id int64) (*model.ProductVariant, error) {
	var v model.ProductVariant
	err := r.db.QueryRow(ctx,
		`SELECT id, product_id, size, color, color_hex, stock, COALESCE(sku, ''), extra_price
		 FROM product_variants WHERE id = $1`, id).
		Scan(&v.ID, &v.ProductID, &v.Size, &v.Color, &v.ColorHex, &v.Stock, &v.SKU, &v.ExtraPrice)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}

// FindImage loads one gallery image by id.
func (r *ProductRepository) FindImage(ctx context.Context, id int64) (*model.ProductImage, error) {
	var img model.ProductImage
	err := r.db.QueryRow(ctx,
		`SELECT id, product_id, url, alt, is_primary, sort_order
		 FROM product_images WHERE id = $1`, id).
		Scan(&img.ID, &img.ProductID, &img.URL, &img.Alt, &img.IsPrimary, &img.SortOrder)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &img, nil
}

// ---------- images ----------

// CreateImage appends a gallery image. Marking one primary unsets the others.
func (r *ProductRepository) CreateImage(ctx context.Context, img *model.ProductImage) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if img.IsPrimary {
		if _, err := tx.Exec(ctx,
			`UPDATE product_images SET is_primary = FALSE WHERE product_id = $1`, img.ProductID); err != nil {
			return err
		}
	}

	if err := tx.QueryRow(ctx, `
		INSERT INTO product_images (product_id, url, alt, is_primary, sort_order)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id`,
		img.ProductID, img.URL, img.Alt, img.IsPrimary, img.SortOrder,
	).Scan(&img.ID); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// UpdateImage rewrites one image and returns the stored row.
func (r *ProductRepository) UpdateImage(ctx context.Context, img *model.ProductImage) (*model.ProductImage, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if img.IsPrimary {
		if _, err := tx.Exec(ctx,
			`UPDATE product_images SET is_primary = FALSE WHERE product_id = $1 AND id <> $2`,
			img.ProductID, img.ID); err != nil {
			return nil, err
		}
	}

	tag, err := tx.Exec(ctx, `
		UPDATE product_images SET url = $2, alt = $3, is_primary = $4, sort_order = $5
		WHERE id = $1`, img.ID, img.URL, img.Alt, img.IsPrimary, img.SortOrder)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() == 0 {
		return nil, model.ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return img, nil
}

// DeleteImage removes one image.
func (r *ProductRepository) DeleteImage(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM product_images WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}
