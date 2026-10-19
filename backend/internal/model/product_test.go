package model

import "testing"

// ptrInt64 is a helper for the optional DiscountPrice column.
func ptrInt64(v int64) *int64 { return &v }

func TestProductFinalPrice(t *testing.T) {
	tests := []struct {
		name     string
		price    int64
		discount *int64
		want     int64
	}{
		{"no discount", 1_200_000, nil, 1_200_000},
		{"valid discount", 1_200_000, ptrInt64(900_000), 900_000},
		{"discount equal to price is ignored", 1_200_000, ptrInt64(1_200_000), 1_200_000},
		{"discount above price is ignored", 1_200_000, ptrInt64(1_500_000), 1_200_000},
		{"zero discount makes the product free", 1_200_000, ptrInt64(0), 0},
		{"negative discount is clamped by the price rule", 1_200_000, ptrInt64(-1), -1},
		{"free product without discount", 0, nil, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &Product{Price: tt.price, DiscountPrice: tt.discount}
			if got := p.FinalPrice(); got != tt.want {
				t.Fatalf("FinalPrice() = %d, want %d", got, tt.want)
			}
		})
	}
}

// FinalPrice must never exceed Price, whatever the stored discount looks like.
func TestProductFinalPriceNeverExceedsPrice(t *testing.T) {
	cases := []struct {
		price    int64
		discount *int64
	}{
		{1_200_000, nil},
		{1_200_000, ptrInt64(1_200_000)},
		{1_200_000, ptrInt64(9_999_999)},
		{1_200_000, ptrInt64(0)},
	}

	for _, c := range cases {
		p := &Product{Price: c.price, DiscountPrice: c.discount}
		if got := p.FinalPrice(); got > c.price {
			t.Fatalf("FinalPrice() = %d exceeds Price = %d", got, c.price)
		}
	}
}

func TestProductHasDiscount(t *testing.T) {
	tests := []struct {
		name     string
		price    int64
		discount *int64
		want     bool
	}{
		{"nil discount", 1_200_000, nil, false},
		{"lower discount", 1_200_000, ptrInt64(900_000), true},
		{"equal discount is not a discount", 1_200_000, ptrInt64(1_200_000), false},
		{"higher discount is not a discount", 1_200_000, ptrInt64(1_300_000), false},
		{"zero discount counts while cheaper", 1_200_000, ptrInt64(0), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &Product{Price: tt.price, DiscountPrice: tt.discount}
			if got := p.HasDiscount(); got != tt.want {
				t.Fatalf("HasDiscount() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestProductDiscountPercent(t *testing.T) {
	tests := []struct {
		name     string
		price    int64
		discount *int64
		want     int32
	}{
		{"no discount", 1_000_000, nil, 0},
		{"ten percent", 1_000_000, ptrInt64(900_000), 10},
		{"thirty percent", 1_000_000, ptrInt64(700_000), 30},
		{"full discount", 1_000_000, ptrInt64(0), 100},
		{"equal price is not discounted", 1_000_000, ptrInt64(1_000_000), 0},
		{"higher discount is not discounted", 1_000_000, ptrInt64(1_100_000), 0},
		// Integer division truncates: 500/1500 = 33.33 -> 33.
		{"truncates the fraction", 1_500, ptrInt64(1_000), 33},
		{"truncates a third", 999, ptrInt64(666), 33},
		{"price of zero cannot divide", 0, ptrInt64(0), 0},
		{"price of zero with a negative discount", 0, ptrInt64(-5), 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := &Product{Price: tt.price, DiscountPrice: tt.discount}
			if got := p.DiscountPercent(); got != tt.want {
				t.Fatalf("DiscountPercent() = %d, want %d", got, tt.want)
			}
			if got := p.DiscountPercent(); got < 0 || got > 100 {
				t.Fatalf("DiscountPercent() = %d, want a value in [0, 100]", got)
			}
		})
	}
}

func TestOffsets(t *testing.T) {
	t.Run("ProductFilter", func(t *testing.T) {
		tests := []struct {
			name  string
			page  int
			limit int
			want  int
		}{
			{"first page has no offset", 1, 20, 0},
			{"third page", 3, 20, 40},
			{"custom limit", 2, 50, 50},
			{"page zero is clamped", 0, 20, 0},
			{"negative page is clamped", -5, 20, 0},
			{"zero limit collapses the offset", 5, 0, 0},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				f := ProductFilter{Page: tt.page, Limit: tt.limit}
				if got := f.Offset(); got != tt.want {
					t.Fatalf("Offset() = %d, want %d", got, tt.want)
				}
			})
		}
	})

	// The admin filters share the same rule; checked here so a copy-paste edit
	// cannot silently diverge.
	t.Run("admin filters", func(t *testing.T) {
		order := AdminOrderFilter{Page: 3, Limit: 20}.Offset()
		payment := AdminPaymentFilter{Page: 3, Limit: 20}.Offset()
		user := AdminUserFilter{Page: 3, Limit: 20}.Offset()
		if order != 40 || payment != 40 || user != 40 {
			t.Fatalf("admin offsets = (%d, %d, %d), want (40, 40, 40)", order, payment, user)
		}
		if got := (AdminOrderFilter{Page: 0, Limit: 20}).Offset(); got != 0 {
			t.Fatalf("AdminOrderFilter page 0 offset = %d, want 0", got)
		}
	})
}
