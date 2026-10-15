package repository

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// ProductRepository persists the catalogue.
type ProductRepository struct {
	db *database.Pool
}

// NewProductRepository wires a repository to the shared pool.
func NewProductRepository(db *database.Pool) *ProductRepository {
	return &ProductRepository{db: db}
}

const productSelect = `
	SELECT p.id, p.title, p.slug, p.short_desc, p.description, p.category_id,
	       p.brand, p.gender, p.pant_type, p.fabric,
	       p.price, p.discount_price, p.stock, COALESCE(p.sku, ''),
	       p.rating_avg::float8, p.rating_count, p.sold_count,
	       p.is_active, p.is_featured, p.created_at, p.updated_at,
	       c.id, c.name, c.slug, c.parent_id, c.sort_order, c.created_at, c.updated_at
	FROM products p
	JOIN categories c ON c.id = p.category_id`

// scanProduct reads a row produced by productSelect, including its category.
func scanProduct(rows pgx.Rows) (model.Product, error) {
	var (
		p   model.Product
		cat model.Category
	)
	err := rows.Scan(
		&p.ID, &p.Title, &p.Slug, &p.ShortDesc, &p.Description, &p.CategoryID,
		&p.Brand, &p.Gender, &p.PantType, &p.Fabric,
		&p.Price, &p.DiscountPrice, &p.Stock, &p.SKU,
		&p.RatingAvg, &p.RatingCount, &p.SoldCount,
		&p.IsActive, &p.IsFeatured, &p.CreatedAt, &p.UpdatedAt,
		&cat.ID, &cat.Name, &cat.Slug, &cat.ParentID, &cat.SortOrder, &cat.CreatedAt, &cat.UpdatedAt,
	)
	if err != nil {
		return p, err
	}
	p.Category = &cat
	p.Images = []model.ProductImage{}
	p.Variants = []model.ProductVariant{}
	return p, nil
}

// buildProductFilter translates a filter into a WHERE clause, ordered arguments
// and an ORDER BY expression. All values are bound as parameters.
func buildProductFilter(f model.ProductFilter) (string, []any, string) {
	conds := []string{"p.deleted_at IS NULL"}
	args := make([]any, 0, 8)

	ph := func(v any) string {
		args = append(args, v)
		return "$" + strconv.Itoa(len(args))
	}

	if !f.IncludeInactive {
		conds = append(conds, "p.is_active = TRUE")
	} else if f.IsActive != nil {
		conds = append(conds, "p.is_active = "+ph(*f.IsActive))
	}
	if f.Query != "" {
		conds = append(conds, "p.title ILIKE '%' || "+ph(f.Query)+" || '%'")
	}
	if f.CategoryID != nil {
		conds = append(conds, "p.category_id = "+ph(*f.CategoryID))
	}
	if f.CategorySlug != "" {
		conds = append(conds, "c.slug = "+ph(f.CategorySlug))
	}
	if f.Gender != "" {
		conds = append(conds, "p.gender = "+ph(f.Gender))
	}
	if f.PantType != "" {
		conds = append(conds, "p.pant_type = "+ph(f.PantType))
	}
	if f.MinPrice != nil {
		conds = append(conds, "COALESCE(p.discount_price, p.price) >= "+ph(*f.MinPrice))
	}
	if f.MaxPrice != nil {
		conds = append(conds, "COALESCE(p.discount_price, p.price) <= "+ph(*f.MaxPrice))
	}
	if f.InStock != nil {
		if *f.InStock {
			conds = append(conds, "p.stock > 0")
		} else {
			conds = append(conds, "p.stock = 0")
		}
	}
	if f.IsFeatured != nil {
		conds = append(conds, "p.is_featured = "+ph(*f.IsFeatured))
	}
	if f.Size != "" {
		conds = append(conds,
			"EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.size = "+ph(f.Size)+" AND v.stock > 0)")
	}
	if f.Color != "" {
		conds = append(conds,
			"EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.color = "+ph(f.Color)+")")
	}

	var orderBy string
	switch f.Sort {
	case "cheapest":
		orderBy = "COALESCE(p.discount_price, p.price) ASC"
	case "expensive":
		orderBy = "COALESCE(p.discount_price, p.price) DESC"
	case "popular":
		orderBy = "p.sold_count DESC, p.rating_count DESC"
	case "discount":
		orderBy = "CASE WHEN p.discount_price IS NULL THEN 0 " +
			"ELSE (p.price - p.discount_price) * 100 / NULLIF(p.price, 0) END DESC"
	case "rating":
		orderBy = "p.rating_avg DESC, p.rating_count DESC"
	default:
		orderBy = "p.created_at DESC"
	}

	return "WHERE " + strings.Join(conds, " AND "), args, orderBy + ", p.id DESC"
}

// List returns one page of products plus the total number of matches.
func (r *ProductRepository) List(ctx context.Context, f model.ProductFilter) ([]model.Product, int64, error) {
	where, args, orderBy := buildProductFilter(f)

	var total int64
	countQ := `SELECT count(*) FROM products p JOIN categories c ON c.id = p.category_id ` + where
	if err := r.db.QueryRow(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.Product{}, 0, nil
	}

	listArgs := append(append([]any{}, args...), f.Limit, f.Offset())
	limitPh := "$" + strconv.Itoa(len(args)+1)
	offsetPh := "$" + strconv.Itoa(len(args)+2)

	q := productSelect + " " + where + " ORDER BY " + orderBy + " LIMIT " + limitPh + " OFFSET " + offsetPh

	rows, err := r.db.Query(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	products := make([]model.Product, 0, f.Limit)
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, 0, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if err := r.attachMedia(ctx, products); err != nil {
		return nil, 0, err
	}
	return products, total, nil
}

// GetBySlug returns a product with its images and variants.
func (r *ProductRepository) GetBySlug(ctx context.Context, slug string, includeInactive bool) (*model.Product, error) {
	q := productSelect + " WHERE p.slug = $1 AND p.deleted_at IS NULL"
	if !includeInactive {
		q += " AND p.is_active = TRUE"
	}
	return r.getOne(ctx, q, slug)
}

// GetByID returns a product with its images and variants.
func (r *ProductRepository) GetByID(ctx context.Context, id int64, includeInactive bool) (*model.Product, error) {
	q := productSelect + " WHERE p.id = $1 AND p.deleted_at IS NULL"
	if !includeInactive {
		q += " AND p.is_active = TRUE"
	}
	return r.getOne(ctx, q, id)
}

func (r *ProductRepository) getOne(ctx context.Context, query string, arg any) (*model.Product, error) {
	rows, err := r.db.Query(ctx, query, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		if err := rows.Err(); err != nil {
			return nil, err
		}
		return nil, model.ErrNotFound
	}
	p, err := scanProduct(rows)
	if err != nil {
		return nil, err
	}
	rows.Close()

	list := []model.Product{p}
	if err := r.attachMedia(ctx, list); err != nil {
		return nil, err
	}
	return &list[0], nil
}

// Related returns other active products from the same category.
func (r *ProductRepository) Related(ctx context.Context, productID, categoryID int64, limit int) ([]model.Product, error) {
	q := productSelect + `
		WHERE p.category_id = $1 AND p.id <> $2 AND p.is_active = TRUE AND p.deleted_at IS NULL
		ORDER BY p.sold_count DESC, p.created_at DESC
		LIMIT $3`

	rows, err := r.db.Query(ctx, q, categoryID, productID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]model.Product, 0, limit)
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := r.attachMedia(ctx, products); err != nil {
		return nil, err
	}
	return products, nil
}

// Suggest returns lightweight title matches for the search box.
func (r *ProductRepository) Suggest(ctx context.Context, query string, limit int) ([]model.Product, error) {
	const q = `
		SELECT p.id, p.title, p.slug, p.price, p.discount_price,
		       (SELECT url FROM product_images i WHERE i.product_id = p.id
		        ORDER BY i.is_primary DESC, i.sort_order LIMIT 1) AS image
		FROM products p
		WHERE p.is_active AND p.deleted_at IS NULL AND p.title ILIKE '%' || $1 || '%'
		ORDER BY similarity(p.title, $1) DESC, p.sold_count DESC
		LIMIT $2`

	rows, err := r.db.Query(ctx, q, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.Product, 0, limit)
	for rows.Next() {
		var (
			p     model.Product
			image *string
		)
		if err := rows.Scan(&p.ID, &p.Title, &p.Slug, &p.Price, &p.DiscountPrice, &image); err != nil {
			return nil, err
		}
		if image != nil {
			p.Images = []model.ProductImage{{URL: *image, IsPrimary: true}}
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

// attachMedia batch-loads images and variants for a page of products, avoiding
// one query per product.
func (r *ProductRepository) attachMedia(ctx context.Context, products []model.Product) error {
	if len(products) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(products))
	index := make(map[int64]int, len(products))
	for i := range products {
		ids = append(ids, products[i].ID)
		index[products[i].ID] = i
	}

	// ---- images ----
	imgRows, err := r.db.Query(ctx, `
		SELECT id, product_id, url, alt, is_primary, sort_order
		FROM product_images
		WHERE product_id = ANY($1)
		ORDER BY is_primary DESC, sort_order, id`, ids)
	if err != nil {
		return err
	}
	for imgRows.Next() {
		var img model.ProductImage
		if err := imgRows.Scan(&img.ID, &img.ProductID, &img.URL, &img.Alt, &img.IsPrimary, &img.SortOrder); err != nil {
			imgRows.Close()
			return err
		}
		if i, ok := index[img.ProductID]; ok {
			products[i].Images = append(products[i].Images, img)
		}
	}
	if err := imgRows.Err(); err != nil {
		imgRows.Close()
		return err
	}
	imgRows.Close()

	// ---- variants ----
	varRows, err := r.db.Query(ctx, `
		SELECT id, product_id, size, color, color_hex, stock, COALESCE(sku, ''), extra_price
		FROM product_variants
		WHERE product_id = ANY($1)
		ORDER BY id`, ids)
	if err != nil {
		return err
	}
	defer varRows.Close()
	for varRows.Next() {
		var v model.ProductVariant
		if err := varRows.Scan(
			&v.ID, &v.ProductID, &v.Size, &v.Color, &v.ColorHex, &v.Stock, &v.SKU, &v.ExtraPrice,
		); err != nil {
			return err
		}
		if i, ok := index[v.ProductID]; ok {
			products[i].Variants = append(products[i].Variants, v)
		}
	}
	return varRows.Err()
}

// GetVariant returns a variant belonging to a product, used at checkout.
func (r *ProductRepository) GetVariant(ctx context.Context, productID, variantID int64) (*model.ProductVariant, error) {
	var v model.ProductVariant
	err := r.db.QueryRow(ctx, `
		SELECT id, product_id, size, color, color_hex, stock, COALESCE(sku, ''), extra_price
		FROM product_variants WHERE id = $1 AND product_id = $2`, variantID, productID).
		Scan(&v.ID, &v.ProductID, &v.Size, &v.Color, &v.ColorHex, &v.Stock, &v.SKU, &v.ExtraPrice)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &v, nil
}

// ListByIDs loads a set of listed products, each with its images and variants.
// The caller owns the display order; the query returns them in id order.
func (r *ProductRepository) ListByIDs(ctx context.Context, ids []int64) ([]model.Product, error) {
	if len(ids) == 0 {
		return []model.Product{}, nil
	}
	rows, err := r.db.Query(ctx,
		productSelect+` WHERE p.id = ANY($1) AND p.deleted_at IS NULL AND p.is_active = TRUE`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	products := make([]model.Product, 0, len(ids))
	for rows.Next() {
		p, err := scanProduct(rows)
		if err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := r.attachMedia(ctx, products); err != nil {
		return nil, err
	}
	return products, nil
}

// Count returns the number of active products.
func (r *ProductRepository) Count(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM products WHERE deleted_at IS NULL`).Scan(&n)
	return n, err
}
