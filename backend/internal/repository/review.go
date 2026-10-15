package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// ReviewRepository persists product reviews: customers write their own,
// storefront readers see the published ones, and admins moderate.
type ReviewRepository struct {
	db *database.Pool
}

// NewReviewRepository wires a repository to the shared pool.
func NewReviewRepository(db *database.Pool) *ReviewRepository {
	return &ReviewRepository{db: db}
}

const reviewColumns = `id, product_id, user_id, rating, comment, status::text, created_at, updated_at`

func scanReview(row pgx.Row) (*model.Review, error) {
	var r model.Review
	if err := row.Scan(
		&r.ID, &r.ProductID, &r.UserID, &r.Rating, &r.Comment, &r.Status, &r.CreatedAt, &r.UpdatedAt,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &r, nil
}

// ListApproved returns one page of published reviews, newest first. The author
// name is shortened on the way out: only the review is public.
func (r *ReviewRepository) ListApproved(
	ctx context.Context, productID int64, limit, offset int,
) ([]model.ReviewView, error) {
	rows, err := r.db.Query(ctx, `
		SELECT rev.id, rev.rating, rev.comment, u.name, rev.created_at
		FROM reviews rev
		JOIN users u ON u.id = rev.user_id
		WHERE rev.product_id = $1 AND rev.status = 'approved'
		ORDER BY rev.created_at DESC, rev.id DESC
		LIMIT $2 OFFSET $3`, productID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]model.ReviewView, 0, limit)
	for rows.Next() {
		var (
			view   model.ReviewView
			author string
		)
		if err := rows.Scan(&view.ID, &view.Rating, &view.Comment, &author, &view.CreatedAt); err != nil {
			return nil, err
		}
		view.Author = model.MaskAuthor(author)
		out = append(out, view)
	}
	return out, rows.Err()
}

// CountApproved counts the published reviews of a product.
func (r *ReviewRepository) CountApproved(ctx context.Context, productID int64) (int64, error) {
	var total int64
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM reviews WHERE product_id = $1 AND status = 'approved'`, productID).
		Scan(&total)
	return total, err
}

// Summary aggregates the published reviews: their average and the star
// breakdown the product page draws as bars.
func (r *ReviewRepository) Summary(ctx context.Context, productID int64) (model.ReviewSummary, error) {
	var s model.ReviewSummary
	err := r.db.QueryRow(ctx, `
		SELECT count(*), COALESCE(avg(rating), 0),
		       count(*) FILTER (WHERE rating = 1), count(*) FILTER (WHERE rating = 2),
		       count(*) FILTER (WHERE rating = 3), count(*) FILTER (WHERE rating = 4),
		       count(*) FILTER (WHERE rating = 5)
		FROM reviews
		WHERE product_id = $1 AND status = 'approved'`, productID).
		Scan(&s.Count, &s.Average, &s.Stars[0], &s.Stars[1], &s.Stars[2], &s.Stars[3], &s.Stars[4])
	return s, err
}

// GetByUser returns the review a customer already wrote, whatever its status.
func (r *ReviewRepository) GetByUser(ctx context.Context, productID, userID int64) (*model.Review, error) {
	return scanReview(r.db.QueryRow(ctx,
		`SELECT `+reviewColumns+` FROM reviews WHERE product_id = $1 AND user_id = $2`,
		productID, userID))
}

// HasDeliveredPurchase reports whether the product reached the customer: it has
// to sit in one of their delivered orders. This is what makes a review earned.
func (r *ReviewRepository) HasDeliveredPurchase(ctx context.Context, userID, productID int64) (bool, error) {
	var found bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM order_items oi
			JOIN orders o ON o.id = oi.order_id
			WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status = 'delivered'
		)`, userID, productID).Scan(&found)
	return found, err
}

// Upsert stores the customer's review, or replaces the one they wrote before.
// Either way the row waits for moderation again: an edit of an approved review
// must not slip past the queue.
func (r *ReviewRepository) Upsert(
	ctx context.Context, productID, userID int64, rating int32, comment string,
) (*model.Review, error) {
	return scanReview(r.db.QueryRow(ctx, `
		INSERT INTO reviews (product_id, user_id, rating, comment, status)
		VALUES ($1, $2, $3, $4, 'pending')
		ON CONFLICT (product_id, user_id) DO UPDATE SET
			rating = EXCLUDED.rating,
			comment = EXCLUDED.comment,
			status = 'pending'
		RETURNING `+reviewColumns, productID, userID, rating, comment))
}

// RecalcProductRating rewrites the product's public rating from the reviews
// that are actually approved, so the stars on the card always match the list.
func (r *ReviewRepository) RecalcProductRating(ctx context.Context, productID int64) error {
	_, err := r.db.Exec(ctx, `
		UPDATE products SET
			rating_avg = COALESCE(ROUND((
				SELECT avg(rating) FROM reviews
				WHERE product_id = $1 AND status = 'approved'
			), 2), 0),
			rating_count = (
				SELECT count(*) FROM reviews
				WHERE product_id = $1 AND status = 'approved'
			)
		WHERE id = $1`, productID)
	return err
}
