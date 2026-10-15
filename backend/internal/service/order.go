package service

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

// CreateOrderInput is a checkout request.
type CreateOrderInput struct {
	AddressID  int64
	CouponCode string
	Note       string
}

// OrderService turns a cart into an order and reads orders back.
//
// Pricing lives here, not on the client: the preview endpoint the checkout page
// calls and the order that is finally written share one code path, so the number
// a customer is shown is the number they are charged.
type OrderService struct {
	carts     *repository.CartRepository
	orders    *repository.OrderRepository
	addresses *repository.AddressRepository
	coupons   *CouponService
	shipping  config.ShippingConfig
}

// NewOrderService wires the order service.
func NewOrderService(
	carts *repository.CartRepository,
	orders *repository.OrderRepository,
	addresses *repository.AddressRepository,
	coupons *CouponService,
	shipping config.ShippingConfig,
) *OrderService {
	return &OrderService{
		carts:     carts,
		orders:    orders,
		addresses: addresses,
		coupons:   coupons,
		shipping:  shipping,
	}
}

// pricing is the resolved money breakdown of a cart.
type pricing struct {
	subtotal int64
	discount int64
	shipping int64
	total    int64
	couponID *int64
	code     string
}

// Preview prices the cart exactly as Create would, without writing anything, so
// the checkout page can show the final numbers before the customer commits.
func (s *OrderService) Preview(ctx context.Context, userID int64, couponCode string) (*model.OrderPreview, error) {
	lines, price, err := s.price(ctx, userID, couponCode)
	if err != nil {
		return nil, err
	}

	view := &model.OrderPreview{
		Items:        make([]model.OrderPreviewItem, 0, len(lines)),
		Subtotal:     price.subtotal,
		Discount:     price.discount,
		ShippingCost: price.shipping,
		Total:        price.total,
		CouponCode:   price.code,
		FreeFrom:     s.shipping.FreeFrom,
	}

	for _, line := range lines {
		available := line.IsAvailable && line.Quantity <= line.MaxQuantity
		if !available {
			view.HasUnavailable = true
		}
		view.ItemCount += line.Quantity
		view.Items = append(view.Items, model.OrderPreviewItem{
			ProductID:    line.ProductID,
			VariantID:    line.VariantID,
			Slug:         line.Slug,
			Title:        line.Title,
			VariantLabel: variantLabel(line.Size, line.Color),
			ImageURL:     line.Image,
			UnitPrice:    line.UnitPrice,
			Quantity:     line.Quantity,
			MaxQuantity:  line.MaxQuantity,
			LineTotal:    line.LineTotal,
			IsAvailable:  available,
		})
	}
	return view, nil
}

// Create prices the cart, snapshots it into an order and empties the cart.
//
// The write itself is one transaction in the repository: stock is locked and
// decremented there, so two customers racing for the last pair of trousers
// cannot both win.
func (s *OrderService) Create(
	ctx context.Context, userID int64, in CreateOrderInput,
) (*model.Order, error) {
	lines, price, err := s.price(ctx, userID, in.CouponCode)
	if err != nil {
		return nil, err
	}
	for _, line := range lines {
		if !line.IsAvailable {
			return nil, model.ErrOutOfStock
		}
	}

	address, err := s.addresses.GetByID(ctx, userID, in.AddressID)
	if err != nil {
		return nil, err
	}
	cart, err := s.carts.GetByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	draft := &model.OrderDraft{
		UserID:       userID,
		CodePrefix:   orderCodePrefix(time.Now()),
		AddressID:    &address.ID,
		CouponID:     price.couponID,
		CouponCode:   price.code,
		Subtotal:     price.subtotal,
		Discount:     price.discount,
		ShippingCost: price.shipping,
		Total:        price.total,
		Note:         strings.TrimSpace(in.Note),
		ShippingAddress: model.AddressSnapshot{
			ReceiverName: address.ReceiverName,
			Phone:        address.Phone,
			Province:     address.Province,
			City:         address.City,
			PostalCode:   address.PostalCode,
			Line1:        address.Line1,
		},
		Items:  orderItems(lines),
		CartID: &cart.ID,
	}
	return s.orders.CreateFromCart(ctx, draft)
}

// List returns one page of the user's orders, newest first.
func (s *OrderService) List(ctx context.Context, userID int64, page, limit int) (model.Page[model.Order], error) {
	page, limit = normalizePaging(page, limit)
	orders, total, err := s.orders.ListByUser(ctx, userID, limit, (page-1)*limit)
	if err != nil {
		return model.Page[model.Order]{}, err
	}
	return model.NewPage(orders, page, limit, total), nil
}

// Get returns one of the user's orders.
func (s *OrderService) Get(ctx context.Context, userID, id int64) (*model.Order, error) {
	return s.orders.GetByID(ctx, userID, id)
}

// price resolves the cart's lines and the money breakdown.
//
// It deliberately does not reject unavailable lines: the preview shows them with
// a warning, and Create rejects them before anything is written.
func (s *OrderService) price(
	ctx context.Context, userID int64, couponCode string,
) ([]model.CartLine, pricing, error) {
	var p pricing

	cart, err := s.carts.GetByUser(ctx, userID)
	if errors.Is(err, model.ErrNotFound) {
		return nil, p, model.ErrEmptyCart
	}
	if err != nil {
		return nil, p, err
	}

	lines, err := s.carts.LoadLines(ctx, cart.ID)
	if err != nil {
		return nil, p, err
	}
	if len(lines) == 0 {
		return nil, p, model.ErrEmptyCart
	}
	for _, line := range lines {
		p.subtotal += line.LineTotal
	}

	coupon, discount, err := s.coupons.Resolve(ctx, couponCode, p.subtotal)
	if err != nil {
		return nil, p, err
	}
	p.discount = discount
	if coupon != nil {
		p.couponID = &coupon.ID
		p.code = coupon.Code
	}

	// Delivery is priced on the goods subtotal, before any discount: applying a
	// coupon must never be what pushes an order over the free-shipping line.
	p.shipping = s.shipping.Cost(p.subtotal)
	p.total = p.subtotal - p.discount + p.shipping
	return lines, p, nil
}

// orderItems snapshots cart lines as order lines. Title, variant label and price
// are copied, not referenced, so a later price change cannot rewrite an invoice.
func orderItems(lines []model.CartLine) []model.OrderItem {
	items := make([]model.OrderItem, 0, len(lines))
	for _, line := range lines {
		productID := line.ProductID
		items = append(items, model.OrderItem{
			ProductID:    &productID,
			VariantID:    line.VariantID,
			Slug:         line.Slug,
			Title:        line.Title,
			VariantLabel: variantLabel(line.Size, line.Color),
			ImageURL:     line.Image,
			UnitPrice:    line.UnitPrice,
			Quantity:     line.Quantity,
			LineTotal:    line.LineTotal,
		})
	}
	return items
}

// variantLabel renders the size/colour pair shown on an invoice line.
func variantLabel(size, color string) string {
	parts := make([]string, 0, 2)
	if size != "" {
		parts = append(parts, "سایز "+size)
	}
	if color != "" {
		parts = append(parts, color)
	}
	return strings.Join(parts, " · ")
}

// orderCodePrefix builds the readable half of an order number, e.g. "SS-1405-".
// The sequence value is appended by the repository inside the insert.
func orderCodePrefix(now time.Time) string {
	return "SS-" + strconv.Itoa(model.JalaliYear(now)) + "-"
}
