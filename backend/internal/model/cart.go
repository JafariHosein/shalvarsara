package model

// Cart is one shopping basket. A signed-in user owns exactly one, created the
// first time they add something; the session_id column is reserved for
// server-side guest carts.
type Cart struct {
	ID        int64
	UserID    *int64
	SessionID *string
}

// CartLine is a stored cart item joined with everything the storefront needs to
// render it, plus the live stock ceiling used to clamp the quantity stepper.
type CartLine struct {
	ID          int64  `json:"id"`
	ProductID   int64  `json:"productId"`
	VariantID   *int64 `json:"variantId"`
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	Image       string `json:"image"`
	UnitPrice   int64  `json:"unitPrice"` // discounted price plus the variant surcharge
	ListPrice   int64  `json:"listPrice"` // struck-through original price
	Size        string `json:"size"`
	Color       string `json:"color"`
	Quantity    int32  `json:"quantity"`
	MaxQuantity int32  `json:"maxQuantity"`
	LineTotal   int64  `json:"lineTotal"`
	IsAvailable bool   `json:"isAvailable"`
}

// CartView is the payload every cart endpoint returns, so the client can replace
// its state in one round trip instead of refetching after each mutation.
type CartView struct {
	Items     []CartLine `json:"items"`
	ItemCount int32      `json:"itemCount"`
	Subtotal  int64      `json:"subtotal"`
}

// CartLineInput is a requested product/variant/quantity before validation.
type CartLineInput struct {
	ProductID int64
	VariantID *int64
	Quantity  int32
}

// NewCartView totals a set of lines.
//
// Unavailable lines still count towards the subtotal: they stay visible in the
// UI with a warning and are rejected at checkout instead of silently
// disappearing from the total.
func NewCartView(lines []CartLine) *CartView {
	if lines == nil {
		lines = []CartLine{}
	}
	view := &CartView{Items: lines}
	for _, line := range lines {
		view.ItemCount += line.Quantity
		view.Subtotal += line.LineTotal
	}
	return view
}
