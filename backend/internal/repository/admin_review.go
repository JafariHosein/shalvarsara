package repository

import (
	"context"
	"strings"

	"github.com/shalvarsara/backend/internal/model"
)

// This file holds the moderation side of reviews: the admin panel lists the
// queue and approves or rejects what it finds. Storefront reads and writes live
// in review.go.

const adminReviewSelect = `
	SELECT rev.id, rev.product_id, rev.user_id, rev.rating, rev.comment, rev.status::text,
	       rev.created_at, rev.updated_at,
	       p.title, p.slug, u.name, u.email
	FROM reviews rev
	JOIN products p ON p.id = rev.product_id
	JOIN users u ON u.id = rev.user_id`

// AdminList returns one page of reviews and the total the filter matches.
func (r *ReviewRepository) AdminList(
	ctx context.Context, f model.AdminReviewFilter,
) ([]model.AdminReviewRow, int64, error) {
	// «همه» in the panel means "no status filter" — the same convention the
	// orders, payments and users lists use.
	f.Status = strings.TrimSpace(f.Status)
	if f.Status == "all" {
		f.Status = ""
	}
	f.Query = strings.TrimSpace(f.Query)

	const where = `
		WHERE ($1 = '' OR rev.status::text = $1)
		  AND ($2 = '' OR p.title ILIKE $2 ESCAPE '\'
		               OR u.name ILIKE $2 ESCAPE '\'
		               OR u.email ILIKE $2 ESCAPE '\')`

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT count(*) FROM reviews rev
		JOIN products p ON p.id = rev.product_id
		JOIN users u ON u.id = rev.user_id`+where, f.Status, reviewSearchPattern(f.Query)).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.AdminReviewRow{}, 0, nil
	}

	rows, err := r.db.Query(ctx, adminReviewSelect+where+`
		ORDER BY rev.created_at DESC, rev.id DESC
		LIMIT $3 OFFSET $4`, f.Status, reviewSearchPattern(f.Query), f.Limit, f.Offset())
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]model.AdminReviewRow, 0, f.Limit)
	for rows.Next() {
		var row model.AdminReviewRow
		if err := rows.Scan(
			&row.Review.ID, &row.Review.ProductID, &row.Review.UserID, &row.Review.Rating,
			&row.Review.Comment, &row.Review.Status, &row.Review.CreatedAt, &row.Review.UpdatedAt,
			&row.ProductTitle, &row.ProductSlug, &row.Author, &row.Email,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, row)
	}
	return out, total, rows.Err()
}

// reviewSearchPattern turns an empty box into "no filter" (the empty string is
// what the $2 = ” guard tests) and anything else into an escaped pattern.
func reviewSearchPattern(q string) string {
	if strings.TrimSpace(q) == "" {
		return ""
	}
	return likePattern(q)
}

// AdminSetStatus records the moderation decision and refreshes the product's
// public rating in the same transaction.
//
// The two statements used to commit separately, so a failure in the second left
// the review moderated but the product's stars stale — and two admins approving
// different reviews of one product could interleave them.
func (r *ReviewRepository) AdminSetStatus(ctx context.Context, id int64, status string) (*model.Review, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	review, err := scanReview(tx.QueryRow(ctx,
		`UPDATE reviews SET status = $2::review_status WHERE id = $1 RETURNING `+reviewColumns,
		id, status))
	if err != nil {
		return nil, err
	}
	if err := recalcProductRatingTx(ctx, tx, review.ProductID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return review, nil
}
