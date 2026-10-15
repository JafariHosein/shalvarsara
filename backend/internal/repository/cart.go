package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// CartRepository persists carts and their lines.
type CartRepository struct {
	db *database.Pool
}

// NewCartRepository wires a repository to the shared pool.
func NewCartRepository(db *database.Pool) *CartRepository {
	return &CartRepository{db: db}
}

const cartColumns = `id, user_id, session_id`

func scanCart(row pgx.Row) (*model.Cart, error) {
	var c model.Cart
	if err := row.Scan(&c.ID, &c.UserID, &c.SessionID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

// GetByUser returns the user's cart, or ErrNotFound when they have none yet.
func (r *CartRepository) GetByUser(ctx context.Context, userID int64) (*model.Cart, error) {
	return scanCart(r.db.QueryRow(ctx,
		`SELECT `+cartColumns+` FROM carts WHERE user_id = $1`, userID))
}

// GetOrCreateByUser returns the user's cart, creating it on first use. The
// upsert keeps two simultaneous first-adds from racing into a unique violation.
func (r *CartRepository) GetOrCreateByUser(ctx context.Context, userID int64) (*model.Cart, error) {
	return scanCart(r.db.QueryRow(ctx, `
		INSERT INTO carts (user_id) VALUES ($1)
		ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
		RETURNING `+cartColumns, userID))
}

// cartLineSelect joins a stored line with the product data needed to render it.
// The sub-select picks the same "primary" image the catalogue uses.
const cartLineSelect = `
	SELECT ci.id, ci.product_id, ci.variant_id, p.slug, p.title,
	       COALESCE((SELECT i.url FROM product_images i
	                 WHERE i.product_id = p.id
	                 ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1), '') AS image,
	       COALESCE(p.discount_price, p.price) AS unit_base,
	       p.price                             AS list_price,
	       COALESCE(v.extra_price, 0)          AS extra_price,
	       COALESCE(v.size, '')                AS size,
	       COALESCE(v.color, '')               AS color,
	       ci.quantity,
	       CASE WHEN ci.variant_id IS NULL THEN p.stock
	            ELSE COALESCE(v.stock, 0) END  AS max_quantity,
	       (p.is_active AND p.deleted_at IS NULL) AS is_listed
	FROM cart_items ci
	JOIN products p ON p.id = ci.product_id
	LEFT JOIN product_variants v ON v.id = ci.variant_id`

// LoadLines returns the cart's lines, newest first.
func (r *CartRepository) LoadLines(ctx context.Context, cartID int64) ([]model.CartLine, error) {
	rows, err := r.db.Query(ctx,
		cartLineSelect+` WHERE ci.cart_id = $1 ORDER BY ci.created_at DESC, ci.id DESC`, cartID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	lines := make([]model.CartLine, 0, 8)
	for rows.Next() {
		var (
			line               model.CartLine
			unitBase, listBase int64
			extra              int64
			isListed           bool
		)
		if err := rows.Scan(
			&line.ID, &line.ProductID, &line.VariantID, &line.Slug, &line.Title,
			&line.Image, &unitBase, &listBase, &extra,
			&line.Size, &line.Color, &line.Quantity, &line.MaxQuantity, &isListed,
		); err != nil {
			return nil, err
		}

		line.UnitPrice = unitBase + extra
		line.ListPrice = listBase + extra
		line.LineTotal = line.UnitPrice * int64(line.Quantity)
		// A line stays editable while the product is on sale and has stock;
		// when the stored quantity is above the current stock the client clamps
		// it, rather than the line becoming untouchable.
		line.IsAvailable = isListed && line.MaxQuantity > 0
		lines = append(lines, line)
	}
	return lines, rows.Err()
}

// AddItem inserts a line, or adds to the existing line for the same
// product+variant. The resulting quantity is clamped to maxQuantity inside the
// statement, so two concurrent adds can never exceed stock.
func (r *CartRepository) AddItem(
	ctx context.Context, cartID, productID int64, variantID *int64, quantity, maxQuantity int32,
) (int64, error) {
	var id int64
	err := r.db.QueryRow(ctx, `
		INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
		VALUES ($1, $2, $3::bigint, LEAST($4::int, $5::int))
		ON CONFLICT (cart_id, product_id, COALESCE(variant_id, 0))
		DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $5::int)
		RETURNING id`,
		cartID, productID, variantID, quantity, maxQuantity).Scan(&id)
	return id, err
}

// SetQuantity replaces the quantity of one line. The cart id is part of the
// predicate so a user can never edit another cart's line.
func (r *CartRepository) SetQuantity(ctx context.Context, cartID, itemID int64, quantity int32) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE cart_items SET quantity = $3 WHERE id = $1 AND cart_id = $2`,
		itemID, cartID, quantity)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// DeleteItem removes one line from the cart.
func (r *CartRepository) DeleteItem(ctx context.Context, cartID, itemID int64) error {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM cart_items WHERE id = $1 AND cart_id = $2`, itemID, cartID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// Clear empties the cart but keeps the cart row so it can be reused.
func (r *CartRepository) Clear(ctx context.Context, cartID int64) error {
	_, err := r.db.Exec(ctx, `DELETE FROM cart_items WHERE cart_id = $1`, cartID)
	return err
}
