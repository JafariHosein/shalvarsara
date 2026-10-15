package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/model"
)

// This file holds the admin side of coupon management. Redemption lives in the
// checkout transaction (order.go) and never goes through here.

// GetCouponByID returns one coupon.
func (r *CouponRepository) GetCouponByID(ctx context.Context, id int64) (*model.Coupon, error) {
	var c model.Coupon
	err := r.db.QueryRow(ctx,
		`SELECT `+couponColumns+` FROM coupons WHERE id = $1`, id,
	).Scan(&c.ID, &c.Code, &c.Type, &c.Amount, &c.MinOrder, &c.MaxUses, &c.UsedCount, &c.ExpiresAt, &c.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}

// ListCoupons returns one page of coupons, newest first.
func (r *CouponRepository) ListCoupons(ctx context.Context, query string, limit, offset int) ([]model.Coupon, int64, error) {
	where := "TRUE"
	args := []any{}
	if q := strings.TrimSpace(query); q != "" {
		args = append(args, "%"+strings.ToUpper(q)+"%")
		where = "code ILIKE $1"
	}

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT count(*) FROM coupons WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.Coupon{}, 0, nil
	}

	listArgs := append(append([]any{}, args...), limit, offset)
	rows, err := r.db.Query(ctx,
		`SELECT `+couponColumns+` FROM coupons WHERE `+where+
			` ORDER BY created_at DESC, id DESC LIMIT $`+itoa(len(args)+1)+` OFFSET $`+itoa(len(args)+2),
		listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]model.Coupon, 0, limit)
	for rows.Next() {
		var c model.Coupon
		if err := rows.Scan(
			&c.ID, &c.Code, &c.Type, &c.Amount, &c.MinOrder, &c.MaxUses, &c.UsedCount, &c.ExpiresAt, &c.IsActive,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, c)
	}
	return out, total, rows.Err()
}

// CreateCoupon inserts a coupon and returns it.
func (r *CouponRepository) CreateCoupon(ctx context.Context, c *model.Coupon) error {
	err := r.db.QueryRow(ctx, `
		INSERT INTO coupons (code, type, amount, min_order, max_uses, expires_at, is_active)
		VALUES ($1, $2::coupon_type, $3, $4, $5, $6, $7)
		RETURNING id`,
		c.Code, c.Type, c.Amount, c.MinOrder, c.MaxUses, c.ExpiresAt, c.IsActive,
	).Scan(&c.ID)
	if isUniqueViolation(err) {
		return model.ErrConflict
	}
	return err
}

// UpdateCoupon rewrites every writable coupon column and returns the stored row.
func (r *CouponRepository) UpdateCoupon(ctx context.Context, c *model.Coupon) (*model.Coupon, error) {
	err := r.db.QueryRow(ctx, `
		UPDATE coupons SET
			code = $2, type = $3::coupon_type, amount = $4, min_order = $5,
			max_uses = $6, expires_at = $7, is_active = $8
		WHERE id = $1
		RETURNING `+couponColumns,
		c.ID, c.Code, c.Type, c.Amount, c.MinOrder, c.MaxUses, c.ExpiresAt, c.IsActive,
	).Scan(&c.ID, &c.Code, &c.Type, &c.Amount, &c.MinOrder, &c.MaxUses, &c.UsedCount, &c.ExpiresAt, &c.IsActive)
	if isUniqueViolation(err) {
		return nil, model.ErrConflict
	}
	return c, err
}

// CountActiveCoupons counts the coupons the dashboard shows as live.
func (r *CouponRepository) CountActiveCoupons(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `
		SELECT count(*) FROM coupons
		WHERE is_active AND (expires_at IS NULL OR expires_at > now()) AND (max_uses = 0 OR used_count < max_uses)`,
	).Scan(&n)
	return n, err
}
