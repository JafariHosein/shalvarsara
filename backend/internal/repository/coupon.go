package repository

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// CouponRepository persists discount codes.
type CouponRepository struct {
	db *database.Pool
}

// NewCouponRepository wires a repository to the shared pool.
func NewCouponRepository(db *database.Pool) *CouponRepository {
	return &CouponRepository{db: db}
}

// Coupon codes are stored uppercase so lookups are case-insensitive without a
// functional index.
const couponColumns = `id, code, type::text, amount, min_order, max_uses, used_count, expires_at, is_active`

// GetByCode looks a coupon up by code, ignoring the caller's letter case.
func (r *CouponRepository) GetByCode(ctx context.Context, code string) (*model.Coupon, error) {
	var c model.Coupon
	err := r.db.QueryRow(ctx,
		`SELECT `+couponColumns+` FROM coupons WHERE code = $1`,
		strings.ToUpper(strings.TrimSpace(code)),
	).Scan(&c.ID, &c.Code, &c.Type, &c.Amount, &c.MinOrder, &c.MaxUses, &c.UsedCount, &c.ExpiresAt, &c.IsActive)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &c, nil
}
