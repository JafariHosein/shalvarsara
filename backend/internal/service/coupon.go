package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// CouponService resolves discount codes against a basket.
type CouponService struct {
	coupons *repository.CouponRepository
}

// NewCouponService wires the coupon service.
func NewCouponService(coupons *repository.CouponRepository) *CouponService {
	return &CouponService{coupons: coupons}
}

// Resolve looks a code up and returns the coupon together with the Toman
// discount it grants on subtotal. An empty code resolves to (nil, 0, nil) so
// callers can treat "no coupon" and "coupon" the same way.
//
// An unknown code is reported as invalid rather than not-found: the storefront
// must not be usable to probe which codes exist.
func (s *CouponService) Resolve(
	ctx context.Context, code string, subtotal int64,
) (*model.Coupon, int64, error) {
	code = strings.TrimSpace(code)
	if code == "" {
		return nil, 0, nil
	}

	coupon, err := s.coupons.GetByCode(ctx, code)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return nil, 0, model.ErrInvalidCoupon
		}
		return nil, 0, err
	}
	if err := coupon.Validate(subtotal, time.Now()); err != nil {
		return nil, 0, err
	}
	return coupon, coupon.DiscountFor(subtotal), nil
}
