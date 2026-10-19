package model

import (
	"errors"
	"testing"
	"time"
)

// ptrTime is a tiny helper so table entries can carry optional *time.Time
// values without repeating a closure.
func ptrTime(t time.Time) *time.Time { return &t }

func TestCouponValidate(t *testing.T) {
	now := time.Date(2026, time.March, 15, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name string
		// coupon is the code under test.
		coupon Coupon
		// subtotal is the basket the coupon is applied to.
		subtotal int64
		// wantErr is the sentinel the error must match; nil means "accepted".
		wantErr error
		// wantMinOrder selects the specific *CouponMinOrderError assertion.
		wantMinOrder bool
		minOrderWant int64
	}{
		{
			name:     "plain active coupon is accepted",
			coupon:   Coupon{Type: CouponPercent, Amount: 10, IsActive: true},
			subtotal: 1_000_000,
		},
		{
			name:     "inactive coupon is rejected",
			coupon:   Coupon{Type: CouponPercent, Amount: 10, IsActive: false},
			subtotal: 1_000_000,
			wantErr:  ErrInvalidCoupon,
		},
		{
			// After(now) is the rule: a coupon expiring exactly now is dead.
			name:     "coupon expiring exactly now is rejected",
			coupon:   Coupon{IsActive: true, ExpiresAt: ptrTime(now)},
			subtotal: 1_000_000,
			wantErr:  ErrInvalidCoupon,
		},
		{
			name:     "coupon expired a minute ago is rejected",
			coupon:   Coupon{IsActive: true, ExpiresAt: ptrTime(now.Add(-time.Minute))},
			subtotal: 1_000_000,
			wantErr:  ErrInvalidCoupon,
		},
		{
			name:     "coupon with a second left is accepted",
			coupon:   Coupon{IsActive: true, ExpiresAt: ptrTime(now.Add(time.Second))},
			subtotal: 1_000_000,
		},
		{
			name:     "coupon with no expiry never expires",
			coupon:   Coupon{IsActive: true, ExpiresAt: nil},
			subtotal: 1_000_000,
		},
		{
			name:     "exhausted coupon is rejected",
			coupon:   Coupon{IsActive: true, MaxUses: 5, UsedCount: 5},
			subtotal: 1_000_000,
			wantErr:  ErrInvalidCoupon,
		},
		{
			name:     "over-used coupon is rejected",
			coupon:   Coupon{IsActive: true, MaxUses: 5, UsedCount: 9},
			subtotal: 1_000_000,
			wantErr:  ErrInvalidCoupon,
		},
		{
			name:     "coupon one use short is accepted",
			coupon:   Coupon{IsActive: true, MaxUses: 5, UsedCount: 4},
			subtotal: 1_000_000,
		},
		{
			// MaxUses 0 means unlimited, so UsedCount is irrelevant.
			name:     "unlimited coupon with many uses is accepted",
			coupon:   Coupon{IsActive: true, MaxUses: 0, UsedCount: 999},
			subtotal: 1_000_000,
		},
		{
			name:         "below minimum order reports the minimum",
			coupon:       Coupon{IsActive: true, MinOrder: 500_000},
			subtotal:     499_999,
			wantErr:      ErrInvalidCoupon,
			wantMinOrder: true,
			minOrderWant: 500_000,
		},
		{
			name:     "exactly at the minimum order is accepted",
			coupon:   Coupon{IsActive: true, MinOrder: 500_000},
			subtotal: 500_000,
		},
		{
			// The switch is ordered: an inactive coupon reports the generic
			// sentinel even when the basket is also below the minimum, so the
			// customer is not told to spend more on a dead code.
			name:     "inactive wins over below-minimum",
			coupon:   Coupon{IsActive: false, MinOrder: 500_000},
			subtotal: 1_000,
			wantErr:  ErrInvalidCoupon,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.coupon.Validate(tt.subtotal, now)

			if tt.wantErr == nil {
				if err != nil {
					t.Fatalf("Validate() = %v, want nil", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("Validate() = nil, want an error matching %v", tt.wantErr)
			}
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("errors.Is(%v, %v) = false, want true", err, tt.wantErr)
			}

			var minErr *CouponMinOrderError
			gotMin := errors.As(err, &minErr)
			if gotMin != tt.wantMinOrder {
				t.Fatalf("*CouponMinOrderError presence = %v, want %v (err = %v)", gotMin, tt.wantMinOrder, err)
			}
			if tt.wantMinOrder && minErr.MinOrder != tt.minOrderWant {
				t.Fatalf("MinOrder = %d, want %d", minErr.MinOrder, tt.minOrderWant)
			}
		})
	}
}

func TestCouponMinOrderErrorUnwraps(t *testing.T) {
	err := &CouponMinOrderError{MinOrder: 250_000}

	if !errors.Is(err, ErrInvalidCoupon) {
		t.Fatalf("errors.Is(%v, ErrInvalidCoupon) = false, want true", err)
	}
	if errors.Is(err, ErrNotFound) {
		t.Fatalf("errors.Is(%v, ErrNotFound) = true, want false", err)
	}

	var target *CouponMinOrderError
	if !errors.As(err, &target) {
		t.Fatal("errors.As failed to recover *CouponMinOrderError")
	}
	if target.MinOrder != 250_000 {
		t.Fatalf("MinOrder = %d, want 250000", target.MinOrder)
	}

	const wantMsg = "coupon: order below minimum of 250000"
	if got := err.Error(); got != wantMsg {
		t.Fatalf("Error() = %q, want %q", got, wantMsg)
	}
}

func TestCouponDiscountFor(t *testing.T) {
	tests := []struct {
		name     string
		kind     string
		amount   int64
		subtotal int64
		want     int64
	}{
		{"percent of a round subtotal", CouponPercent, 10, 1_000_000, 100_000},
		{"percent rounds down", CouponPercent, 33, 999, 329},
		{"percent one hundred gives the whole basket", CouponPercent, 100, 750_000, 750_000},
		{"percent of a tiny basket truncates to zero", CouponPercent, 1, 50, 0},
		{"fixed discount", CouponFixed, 50_000, 1_000_000, 50_000},
		{"fixed discount clamped to the subtotal", CouponFixed, 5_000_000, 200_000, 200_000},
		{"fixed discount equal to the subtotal", CouponFixed, 200_000, 200_000, 200_000},
		{"unknown type is treated as fixed", "bogus", 10_000, 500_000, 10_000},
		{"zero subtotal yields zero", CouponPercent, 50, 0, 0},
		{"negative subtotal yields zero", CouponFixed, 50_000, -1_000, 0},
		{"negative amount never charges the customer", CouponFixed, -50_000, 1_000_000, 0},
		{"negative percent never charges the customer", CouponPercent, -10, 1_000_000, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c := &Coupon{Type: tt.kind, Amount: tt.amount}
			got := c.DiscountFor(tt.subtotal)
			if got != tt.want {
				t.Fatalf("DiscountFor(%d) with %s/%d = %d, want %d",
					tt.subtotal, tt.kind, tt.amount, got, tt.want)
			}
			if got < 0 {
				t.Fatalf("DiscountFor(%d) = %d, a discount must never be negative", tt.subtotal, got)
			}
			if tt.subtotal > 0 && got > tt.subtotal {
				t.Fatalf("DiscountFor(%d) = %d, a discount must never exceed the subtotal", tt.subtotal, got)
			}
		})
	}
}

// JalaliYear only models the Nowruz boundary, so the interesting dates are the
// day before and the day of 20/21 March.
func TestJalaliYear(t *testing.T) {
	tests := []struct {
		name string
		date time.Time
		want int
	}{
		{"day before Nowruz 1405", time.Date(2026, time.March, 20, 23, 59, 59, 0, time.UTC), 1404},
		{"Nowruz 1405", time.Date(2026, time.March, 21, 0, 0, 0, 0, time.UTC), 1405},
		{"day before Nowruz 1404", time.Date(2025, time.March, 20, 12, 0, 0, 0, time.UTC), 1403},
		{"Nowruz 1404", time.Date(2025, time.March, 21, 12, 0, 0, 0, time.UTC), 1404},
		{"start of the Gregorian year", time.Date(2026, time.January, 1, 0, 0, 0, 0, time.UTC), 1404},
		{"last day of the Gregorian year", time.Date(2026, time.December, 31, 0, 0, 0, 0, time.UTC), 1405},
		{"February is still the previous Jalali year", time.Date(2026, time.February, 28, 0, 0, 0, 0, time.UTC), 1404},
		{"June is already the new Jalali year", time.Date(2026, time.June, 1, 0, 0, 0, 0, time.UTC), 1405},
		{"Nowruz 1358", time.Date(1979, time.March, 21, 0, 0, 0, 0, time.UTC), 1358},
		{"day before Nowruz 1358", time.Date(1979, time.March, 20, 0, 0, 0, 0, time.UTC), 1357},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := JalaliYear(tt.date); got != tt.want {
				t.Fatalf("JalaliYear(%s) = %d, want %d",
					tt.date.Format(time.DateOnly), got, tt.want)
			}
		})
	}
}

func TestOrderIsPayable(t *testing.T) {
	tests := []struct {
		status string
		want   bool
	}{
		{OrderPending, true},
		{OrderPaid, false},
		{OrderProcessing, false},
		{OrderShipped, false},
		{OrderDelivered, false},
		{OrderCanceled, false},
		{"", false},
		{"unknown", false},
	}

	for _, tt := range tests {
		t.Run("status="+tt.status, func(t *testing.T) {
			o := &Order{Status: tt.status}
			if got := o.IsPayable(); got != tt.want {
				t.Fatalf("IsPayable() for status %q = %v, want %v", tt.status, got, tt.want)
			}
		})
	}
}
