package model

import (
	"strconv"
	"time"
)

// Order statuses, mirroring the order_status enum in the schema.
const (
	OrderPending    = "pending"
	OrderPaid       = "paid"
	OrderProcessing = "processing"
	OrderShipped    = "shipped"
	OrderDelivered  = "delivered"
	OrderCanceled   = "canceled"
)

// Payment statuses, mirroring the payment_status enum.
const (
	PaymentInitiated = "initiated"
	PaymentVerified  = "verified"
	PaymentFailed    = "failed"
)

// Coupon types, mirroring the coupon_type enum.
const (
	CouponPercent = "percent"
	CouponFixed   = "fixed"
)

// Order is a placed order together with its lines and, once a payment has been
// started, the latest gateway attempt.
type Order struct {
	ID      int64            `json:"id"`
	Code    string           `json:"code"`
	UserID  *int64           `json:"userId,omitempty"`
	Address *AddressSnapshot `json:"shippingAddress"`

	Status       string `json:"status"`
	Subtotal     int64  `json:"subtotal"`
	Discount     int64  `json:"discount"`
	ShippingCost int64  `json:"shippingCost"`
	Total        int64  `json:"total"`
	CouponCode   string `json:"couponCode,omitempty"`
	Note         string `json:"note"`

	Items    []OrderItem `json:"items"`
	Payment  *Payment    `json:"payment,omitempty"`
	Shipment *Shipment   `json:"shipment,omitempty"`

	PaidAt    *time.Time `json:"paidAt,omitempty"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
}

// IsPayable reports whether the order can still be paid for.
func (o *Order) IsPayable() bool {
	return o.Status == OrderPending
}

// AddressSnapshot is the shipping address copied onto the order when it is
// placed, so the order stays readable after the address is edited or deleted.
type AddressSnapshot struct {
	ReceiverName string `json:"receiverName"`
	Phone        string `json:"phone"`
	Province     string `json:"province"`
	City         string `json:"city"`
	PostalCode   string `json:"postalCode"`
	Line1        string `json:"line1"`
}

// OrderItem is one line of an order. Title, variant label and unit price are
// snapshots: a later price change must never rewrite an old invoice.
type OrderItem struct {
	ID           int64  `json:"id"`
	ProductID    *int64 `json:"productId,omitempty"`
	VariantID    *int64 `json:"variantId,omitempty"`
	Slug         string `json:"slug"`
	Title        string `json:"title"`
	VariantLabel string `json:"variantLabel"`
	ImageURL     string `json:"imageUrl"`
	UnitPrice    int64  `json:"unitPrice"`
	Quantity     int32  `json:"quantity"`
	LineTotal    int64  `json:"lineTotal"`
}

// Payment is one attempt to pay for an order through a gateway.
type Payment struct {
	ID        int64     `json:"id"`
	OrderID   int64     `json:"orderId"`
	Gateway   string    `json:"gateway"`
	Authority string    `json:"authority,omitempty"`
	RefID     string    `json:"refId,omitempty"`
	Amount    int64     `json:"amount"` // Rial, exactly as sent to the gateway
	Status    string    `json:"status"`
	CardPan   string    `json:"cardPan,omitempty"`
	Message   string    `json:"message,omitempty"`
	CreatedAt time.Time `json:"createdAt"`
}

// Shipment is how an order left the warehouse. One order has at most one.
type Shipment struct {
	Carrier      string     `json:"carrier"`
	TrackingCode string     `json:"trackingCode"`
	Status       string     `json:"status"`
	ShippedAt    *time.Time `json:"shippedAt,omitempty"`
	DeliveredAt  *time.Time `json:"deliveredAt,omitempty"`
}

// PaymentStart is what the storefront needs to hand a customer to the gateway.
type PaymentStart struct {
	PaymentID  int64  `json:"paymentId"`
	OrderID    int64  `json:"orderId"`
	OrderCode  string `json:"orderCode"`
	Authority  string `json:"authority"`
	GatewayURL string `json:"gatewayUrl"`
	// AmountRial is what the gateway was asked for. The storefront only shows it;
	// the authoritative amount lives on the order in Toman.
	AmountRial int64 `json:"amountRial"`
	Sandbox    bool  `json:"sandbox"`
}

// Coupon is a discount code. Amount is a percentage for coupon_type 'percent'
// and an absolute Toman value for 'fixed'.
type Coupon struct {
	ID        int64      `json:"id"`
	Code      string     `json:"code"`
	Type      string     `json:"type"`
	Amount    int64      `json:"amount"`
	MinOrder  int64      `json:"minOrder"`
	MaxUses   int32      `json:"maxUses"`
	UsedCount int32      `json:"usedCount"`
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
	IsActive  bool       `json:"isActive"`
}

// Validate reports why the coupon cannot be used on an order of this size.
func (c *Coupon) Validate(subtotal int64, now time.Time) error {
	switch {
	case !c.IsActive:
		return ErrInvalidCoupon
	case c.ExpiresAt != nil && !c.ExpiresAt.After(now):
		return ErrInvalidCoupon
	case c.MaxUses > 0 && c.UsedCount >= c.MaxUses:
		return ErrInvalidCoupon
	case subtotal < c.MinOrder:
		return &CouponMinOrderError{MinOrder: c.MinOrder}
	}
	return nil
}

// DiscountFor returns the Toman discount this coupon grants on a subtotal. The
// discount never exceeds the subtotal, so an order total can never go negative.
func (c *Coupon) DiscountFor(subtotal int64) int64 {
	if subtotal <= 0 {
		return 0
	}
	var discount int64
	switch c.Type {
	case CouponPercent:
		discount = subtotal * c.Amount / 100
	default:
		discount = c.Amount
	}
	if discount > subtotal {
		discount = subtotal
	}
	if discount < 0 {
		return 0
	}
	return discount
}

// CouponMinOrderError reports that the basket is below the coupon's minimum.
// It unwraps to ErrInvalidCoupon so generic handling still works, while the HTTP
// layer can render the specific message.
type CouponMinOrderError struct {
	MinOrder int64
}

func (e *CouponMinOrderError) Error() string {
	return "coupon: order below minimum of " + strconv.FormatInt(e.MinOrder, 10)
}

// Unwrap lets errors.Is(err, ErrInvalidCoupon) succeed.
func (e *CouponMinOrderError) Unwrap() error { return ErrInvalidCoupon }

// OrderPreview is the priced breakdown of the current cart, computed with
// exactly the same rules as a real order but without writing anything.
type OrderPreview struct {
	Items          []OrderPreviewItem `json:"items"`
	ItemCount      int32              `json:"itemCount"`
	Subtotal       int64              `json:"subtotal"`
	Discount       int64              `json:"discount"`
	ShippingCost   int64              `json:"shippingCost"`
	Total          int64              `json:"total"`
	CouponCode     string             `json:"couponCode,omitempty"`
	FreeFrom       int64              `json:"freeFrom"`
	HasUnavailable bool               `json:"hasUnavailable"`
}

// OrderPreviewItem is one line of a checkout preview: what an order would store,
// plus the live availability the UI needs to warn about a line.
type OrderPreviewItem struct {
	ProductID    int64  `json:"productId"`
	VariantID    *int64 `json:"variantId"`
	Slug         string `json:"slug"`
	Title        string `json:"title"`
	VariantLabel string `json:"variantLabel"`
	ImageURL     string `json:"imageUrl"`
	UnitPrice    int64  `json:"unitPrice"`
	Quantity     int32  `json:"quantity"`
	MaxQuantity  int32  `json:"maxQuantity"`
	LineTotal    int64  `json:"lineTotal"`
	IsAvailable  bool   `json:"isAvailable"`
}

// OrderDraft is a fully priced order that only needs to be written: the service
// has already resolved the products, taken the price snapshot and computed every
// amount, so persisting it is a single transaction in the repository.
type OrderDraft struct {
	UserID int64
	// CodePrefix is the human-readable part of the order number, e.g. "SS-1405-".
	CodePrefix      string
	AddressID       *int64
	CouponID        *int64
	CouponCode      string
	Subtotal        int64
	Discount        int64
	ShippingCost    int64
	Total           int64
	Note            string
	ShippingAddress AddressSnapshot
	Items           []OrderItem
	// CartID, when set, is emptied as part of the same transaction.
	CartID *int64
}

// JalaliYear returns the Jalali (Solar Hijri) calendar year containing t.
//
// Only the year is needed — for order codes — so the Nowruz boundary is enough:
// the Jalali year turns over on 20/21 March.
func JalaliYear(t time.Time) int {
	year, month, day := t.Date()
	if month < time.March || (month == time.March && day < 21) {
		return year - 622
	}
	return year - 621
}
