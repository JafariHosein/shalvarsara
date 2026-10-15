package repository

import (
	"context"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// WishlistRepository persists the products customers saved for later. It stores
// only the pairs; the products themselves come from ProductRepository.
type WishlistRepository struct {
	db *database.Pool
}

// NewWishlistRepository wires a repository to the shared pool.
func NewWishlistRepository(db *database.Pool) *WishlistRepository {
	return &WishlistRepository{db: db}
}

// Refs returns the saved products with their save times, newest first.
func (r *WishlistRepository) Refs(ctx context.Context, userID int64) ([]model.WishlistRef, error) {
	rows, err := r.db.Query(ctx,
		`SELECT product_id, created_at FROM wishlists
		 WHERE user_id = $1 ORDER BY created_at DESC, id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.WishlistRef, 0, 8)
	for rows.Next() {
		var ref model.WishlistRef
		if err := rows.Scan(&ref.ProductID, &ref.AddedAt); err != nil {
			return nil, err
		}
		out = append(out, ref)
	}
	return out, rows.Err()
}

// Add saves a product. Saving an already-saved product is a no-op rather than a
// conflict: a double-tap on the heart should not be an error.
func (r *WishlistRepository) Add(ctx context.Context, userID, productID int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO wishlists (user_id, product_id) VALUES ($1, $2)
		ON CONFLICT (user_id, product_id) DO NOTHING`, userID, productID)
	return err
}

// Remove drops a saved product. Dropping one that was never saved is a no-op:
// the customer asked for it to be gone, and it is.
func (r *WishlistRepository) Remove(ctx context.Context, userID, productID int64) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM wishlists WHERE user_id = $1 AND product_id = $2`, userID, productID)
	return err
}
