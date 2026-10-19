package model

import "time"

// ---------- catalogue ----------

// AdminProductInput is the writable surface of a product in the admin panel.
// Every field is a pointer so one struct serves both a full form submit and a
// single-field toggle: nil means "leave unchanged".
//
// DiscountPrice is the exception: 0 clears the discount (the column becomes
// NULL), because a zero-Toman discount is meaningless.
type AdminProductInput struct {
	Title         *string `json:"title" validate:"omitempty,min=3,max=200"`
	Slug          *string `json:"slug" validate:"omitempty,max=200"`
	ShortDesc     *string `json:"shortDesc" validate:"omitempty,max=600"`
	Description   *string `json:"description" validate:"omitempty,max=6000"`
	CategoryID    *int64  `json:"categoryId" validate:"omitempty,gt=0"`
	Brand         *string `json:"brand" validate:"omitempty,max=80"`
	Gender        *string `json:"gender" validate:"omitempty,max=40"`
	PantType      *string `json:"pantType" validate:"omitempty,max=40"`
	Fabric        *string `json:"fabric" validate:"omitempty,max=80"`
	Price         *int64  `json:"price" validate:"omitempty,gte=0"`
	DiscountPrice *int64  `json:"discountPrice" validate:"omitempty,gte=0"`
	Stock         *int32  `json:"stock" validate:"omitempty,gte=0"`
	SKU           *string `json:"sku" validate:"omitempty,max=64"`
	IsActive      *bool   `json:"isActive"`
	IsFeatured    *bool   `json:"isFeatured"`
}

// AdminVariantInput is a size/colour combination as the admin form sends it.
//
// POST (create) requires Size and Color. PATCH (update) treats every field as
// optional: a nil field is left as it stands. Without the pointers a partial
// PATCH would silently write the zero value, so toggling one field from a list
// row would wipe the rest — and a variant's `stock` reaching 0 by accident
// takes the size off sale.
type AdminVariantInput struct {
	Size       *string `json:"size" validate:"omitempty,min=1,max=20"`
	Color      *string `json:"color" validate:"omitempty,min=1,max=40"`
	ColorHex   *string `json:"colorHex" validate:"omitempty,max=9"`
	Stock      *int32  `json:"stock" validate:"omitempty,gte=0"`
	SKU        *string `json:"sku" validate:"omitempty,max=64"`
	ExtraPrice *int64  `json:"extraPrice" validate:"omitempty,gte=0"`
}

// AdminImageInput is one gallery image.
//
// The URL is not restricted to absolute addresses: the seeded catalogue stores
// app-relative paths ("/products/…"), and so does anything served from the
// frontend's own public directory. The service checks that it is either an
// http(s) URL or a rooted path — see AdminService.validateImageURL.
//
// Like AdminVariantInput, the fields are pointers so a PATCH only rewrites what
// it was sent: `isPrimary` in particular is a one-click action in the image
// manager, and a zero value there would quietly demote the primary image.
type AdminImageInput struct {
	URL       *string `json:"url" validate:"omitempty,max=500"`
	Alt       *string `json:"alt" validate:"omitempty,max=300"`
	IsPrimary *bool   `json:"isPrimary"`
	SortOrder *int32  `json:"sortOrder"`
}

// AdminCategoryInput is the writable surface of a category.
type AdminCategoryInput struct {
	Name      string `json:"name" validate:"required,max=80"`
	Slug      string `json:"slug" validate:"omitempty,max=80"`
	ParentID  *int64 `json:"parentId" validate:"omitempty,gt=0"`
	SortOrder int32  `json:"sortOrder"`
}

// ---------- orders ----------

// AdminOrderFilter carries the supported admin order-list parameters.
type AdminOrderFilter struct {
	Query  string // matches the order code or the receiver phone
	Status string
	Page   int
	Limit  int
}

// Offset converts page/limit into a SQL OFFSET.
func (f AdminOrderFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.Limit
}

// AdminOrderSummary is one row of the admin order table: the order plus who
// placed it, which the storefront never needs.
type AdminOrderSummary struct {
	Order   Order  `json:"order"`
	UserID  *int64 `json:"userId,omitempty"`
	Name    string `json:"customerName"`
	Email   string `json:"customerEmail"`
	Phone   string `json:"customerPhone"`
	Items   int32  `json:"itemsCount"`
	Carrier string `json:"carrier,omitempty"`
	TrackNo string `json:"trackingCode,omitempty"`
}

// AdminStatusInput moves an order along the fulfilment pipeline.
type AdminStatusInput struct {
	Status string `json:"status" validate:"required,oneof=pending paid processing shipped delivered canceled"`
}

// AdminShipmentInput records how an order left the warehouse.
type AdminShipmentInput struct {
	Carrier      string `json:"carrier" validate:"required,max=80"`
	TrackingCode string `json:"trackingCode" validate:"required,max=80"`
}

// CanTransition reports whether status may follow from — the pipeline is one
// way, and only a live order can still be cancelled.
//
// `pending → paid` is deliberately absent: an order becomes paid only when the
// gateway confirms the money (PaymentRepository.Complete), which is the single
// place that can also check the order was still payable. Allowing an admin to
// declare it paid by hand would let revenue and the payments table disagree.
func CanTransition(from, to string) bool {
	if from == to {
		return false
	}
	switch from {
	case OrderPending:
		return to == OrderCanceled
	case OrderPaid:
		return to == OrderProcessing || to == OrderCanceled
	case OrderProcessing:
		return to == OrderShipped || to == OrderCanceled
	case OrderShipped:
		return to == OrderDelivered
	default: // delivered, canceled
		return false
	}
}

// OrderStatuses lists every order status, for validating a filter or a request
// before it reaches a PostgreSQL enum cast.
var OrderStatuses = []string{
	OrderPending, OrderPaid, OrderProcessing, OrderShipped, OrderDelivered, OrderCanceled,
}

// PaymentStatuses lists every payment status.
var PaymentStatuses = []string{PaymentInitiated, PaymentVerified, PaymentFailed}

// ValidOrderStatus reports whether s is a known order status.
func ValidOrderStatus(s string) bool { return contains(OrderStatuses, s) }

// ValidPaymentStatus reports whether s is a known payment status.
func ValidPaymentStatus(s string) bool { return contains(PaymentStatuses, s) }

// ValidRole reports whether s is a known user role.
func ValidRole(s string) bool { return s == string(RoleCustomer) || s == string(RoleAdmin) }

func contains(values []string, s string) bool {
	for _, v := range values {
		if v == s {
			return true
		}
	}
	return false
}

// ---------- payments ----------

// AdminPaymentFilter carries the supported transaction-list parameters.
type AdminPaymentFilter struct {
	Query  string // matches the order code, the authority or the reference id
	Status string // initiated | verified | failed | all
	Page   int
	Limit  int
}

// Offset converts page/limit into a SQL OFFSET.
func (f AdminPaymentFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.Limit
}

// AdminPaymentRow is one gateway attempt as the transactions table shows it:
// the payment itself, the order it belongs to and who placed that order.
type AdminPaymentRow struct {
	Payment   Payment `json:"payment"`
	OrderCode string  `json:"orderCode"`
	UserID    *int64  `json:"userId,omitempty"`
	Name      string  `json:"customerName"`
	Email     string  `json:"customerEmail"`
	Phone     string  `json:"customerPhone"`
	StatusFa  string  `json:"statusFa"`
}

// ---------- users ----------

// AdminUserFilter carries the supported admin user-list parameters.
type AdminUserFilter struct {
	Query string
	Role  string
	Page  int
	Limit int
}

// Offset converts page/limit into a SQL OFFSET.
func (f AdminUserFilter) Offset() int {
	if f.Page < 1 {
		return 0
	}
	return (f.Page - 1) * f.Limit
}

// AdminUserRow is a user together with the numbers the admin table shows.
type AdminUserRow struct {
	User       User       `json:"user"`
	OrderCount int64      `json:"orderCount"`
	TotalSpent int64      `json:"totalSpent"`
	LastOrder  *time.Time `json:"lastOrderAt,omitempty"`
}

// AdminUserInput updates a user's access and role.
type AdminUserInput struct {
	IsActive *bool   `json:"isActive"`
	Role     *Role   `json:"role" validate:"omitempty,oneof=customer admin"`
	Name     *string `json:"name" validate:"omitempty,min=2,max=120"`
	Phone    *string `json:"phone" validate:"omitempty,max=20"`
}

// ---------- coupons ----------

// AdminCouponInput is the writable surface of a coupon. UsedAt/UsedCount are
// read-only: they are maintained by the checkout transaction.
type AdminCouponInput struct {
	Code        *string    `json:"code" validate:"omitempty,min=3,max=40"`
	Type        *string    `json:"type" validate:"omitempty,oneof=percent fixed"`
	Amount      *int64     `json:"amount" validate:"omitempty,gt=0"`
	MinOrder    *int64     `json:"minOrder" validate:"omitempty,gte=0"`
	MaxUses     *int32     `json:"maxUses" validate:"omitempty,gte=0"`
	IsActive    *bool      `json:"isActive"`
	ExpiresAt   *time.Time `json:"expiresAt"`
	ClearExpiry bool       `json:"clearExpiry"` // an explicit null cannot be told from "unchanged"
}

// ---------- stats ----------

// BestSeller is one row of the "most sold" table.
type BestSeller struct {
	ProductID *int64 `json:"productId,omitempty"`
	Title     string `json:"title"`
	Slug      string `json:"slug"`
	Quantity  int64  `json:"quantity"`
	Revenue   int64  `json:"revenue"`
}

// SalesPoint is one day of the trailing sales window.
type SalesPoint struct {
	Date    string `json:"date"` // YYYY-MM-DD, Gregorian; the UI localizes it
	Orders  int64  `json:"orders"`
	Revenue int64  `json:"revenue"`
}

// AdminStats powers the dashboard.
type AdminStats struct {
	Revenue     int64 `json:"revenue"`    // cancelled orders excluded
	OrderCount  int64 `json:"orderCount"` // cancelled orders excluded
	Pending     int64 `json:"pending"`    // waiting to be paid
	ToFulfill   int64 `json:"toFulfill"`  // paid + processing
	Shipped     int64 `json:"shipped"`    //
	Delivered   int64 `json:"delivered"`  //
	Canceled    int64 `json:"canceled"`   //
	Products    int64 `json:"products"`   // not deleted
	ActiveItems int64 `json:"activeProducts"`
	Variants    int64 `json:"variants"`
	LowStock    int64 `json:"lowStock"` // active variants with stock <= 2
	Users       int64 `json:"users"`
	Coupons     int64 `json:"activeCoupons"`
	AvgOrder    int64 `json:"avgOrder"`

	TopSellers   []BestSeller        `json:"topSellers"`
	RecentOrders []AdminOrderSummary `json:"recentOrders"`
	Sales        []SalesPoint        `json:"sales"`
}

// ---------- helpers ----------

// Bool dereferences a pointer, falling back to def.
func Bool(p *bool, def bool) bool {
	if p == nil {
		return def
	}
	return *p
}

// Str dereferences a string pointer, falling back to def.
func Str(p *string, def string) string {
	if p == nil {
		return def
	}
	return *p
}

// I64 dereferences an int64 pointer, falling back to def.
func I64(p *int64, def int64) int64 {
	if p == nil {
		return def
	}
	return *p
}

// I32 dereferences an int32 pointer, falling back to def.
func I32(p *int32, def int32) int32 {
	if p == nil {
		return def
	}
	return *p
}
