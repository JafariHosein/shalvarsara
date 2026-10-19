package repository

import (
	"context"
	"errors"
	"sort"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// OrderRepository persists orders, their lines and their payments.
type OrderRepository struct {
	db *database.Pool
}

// NewOrderRepository wires a repository to the shared pool.
func NewOrderRepository(db *database.Pool) *OrderRepository {
	return &OrderRepository{db: db}
}

const orderColumns = `
	o.id, o.code, o.user_id, o.status::text, o.subtotal, o.discount, o.shipping_cost, o.total,
	COALESCE(NULLIF(o.coupon_code, ''), c.code, ''), o.note,
	o.ship_receiver_name, o.ship_phone, o.ship_province, o.ship_city, o.ship_postal_code, o.ship_line1,
	o.paid_at, o.created_at, o.updated_at`

// The coupon code is stored on the order itself. Reading it back from the
// coupons table would let a later edit rewrite the code shown on old invoices,
// and deleting the coupon would erase it entirely — the same reason titles and
// prices are snapshotted. The join stays as a fallback for rows written before
// the snapshot column existed.
const orderSelect = `
	SELECT ` + orderColumns + `
	FROM orders o
	LEFT JOIN coupons c ON c.id = o.coupon_id`

func scanOrder(row pgx.Row) (*model.Order, error) {
	var (
		o    model.Order
		ship model.AddressSnapshot
	)
	err := row.Scan(
		&o.ID, &o.Code, &o.UserID, &o.Status, &o.Subtotal, &o.Discount, &o.ShippingCost, &o.Total,
		&o.CouponCode, &o.Note,
		&ship.ReceiverName, &ship.Phone, &ship.Province, &ship.City, &ship.PostalCode, &ship.Line1,
		&o.PaidAt, &o.CreatedAt, &o.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	o.Address = &ship
	o.Items = []model.OrderItem{}
	return &o, nil
}

// CreateFromCart writes a priced order in a single transaction: it locks the
// stock of every line, refuses to oversell, decrements stock and sold counts,
// inserts the order and its items, redeems the coupon and empties the cart.
//
// Any failure rolls all of it back, so an order can never exist without the
// stock behind it.
func (r *OrderRepository) CreateFromCart(ctx context.Context, draft *model.OrderDraft) (*model.Order, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := reserveStock(ctx, tx, draft.Items); err != nil {
		return nil, err
	}

	var order model.Order
	err = tx.QueryRow(ctx, `
		INSERT INTO orders (
			code, user_id, address_id, status, subtotal, discount, shipping_cost, total,
			coupon_id, coupon_code, note,
			ship_receiver_name, ship_phone, ship_province, ship_city, ship_postal_code, ship_line1
		) VALUES (
			$1 || lpad(nextval('order_code_seq')::text, 6, '0'), $2, $3, 'pending', $4, $5, $6, $7,
			$8, $9, $10, $11, $12, $13, $14, $15, $16
		)
		RETURNING id, code, created_at, updated_at`,
		draft.CodePrefix, draft.UserID, draft.AddressID,
		draft.Subtotal, draft.Discount, draft.ShippingCost, draft.Total,
		draft.CouponID, draft.CouponCode, draft.Note,
		draft.ShippingAddress.ReceiverName, draft.ShippingAddress.Phone,
		draft.ShippingAddress.Province, draft.ShippingAddress.City,
		draft.ShippingAddress.PostalCode, draft.ShippingAddress.Line1,
	).Scan(&order.ID, &order.Code, &order.CreatedAt, &order.UpdatedAt)
	if err != nil {
		return nil, err
	}

	order.UserID = &draft.UserID
	order.Status = model.OrderPending
	order.Subtotal = draft.Subtotal
	order.Discount = draft.Discount
	order.ShippingCost = draft.ShippingCost
	order.Total = draft.Total
	order.CouponCode = draft.CouponCode
	order.Note = draft.Note
	order.Address = &draft.ShippingAddress
	order.Items = make([]model.OrderItem, 0, len(draft.Items))

	for _, item := range draft.Items {
		var id int64
		err := tx.QueryRow(ctx, `
			INSERT INTO order_items
				(order_id, product_id, variant_id, title, variant_label, image_url, unit_price, quantity)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			RETURNING id`,
			order.ID, item.ProductID, item.VariantID, item.Title, item.VariantLabel,
			item.ImageURL, item.UnitPrice, item.Quantity,
		).Scan(&id)
		if err != nil {
			return nil, err
		}
		item.ID = id
		item.LineTotal = item.UnitPrice * int64(item.Quantity)
		order.Items = append(order.Items, item)
	}

	// Redeem the coupon inside the same transaction: the guarded UPDATE is the
	// one place that can tell whether the code was exhausted by a parallel
	// checkout between validation and commit.
	if draft.CouponID != nil {
		tag, err := tx.Exec(ctx, `
			UPDATE coupons SET used_count = used_count + 1
			WHERE id = $1 AND is_active
			  AND (max_uses = 0 OR used_count < max_uses)
			  AND (expires_at IS NULL OR expires_at > now())
			  AND min_order <= $2`,
			*draft.CouponID, draft.Subtotal)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, model.ErrInvalidCoupon
		}
	}

	// The basket became an order; the cart is only emptied once everything else
	// has succeeded.
	//
	// The deleted-row count is the checkout's idempotency guard: two overlapping
	// POST /orders (a double-click, or a client retry) both price the same cart
	// before either transaction commits. The loser blocks on the rows the winner
	// deleted, re-reads and finds nothing left to consume, so it rolls back —
	// releasing the stock and the coupon use it had reserved — instead of
	// producing a second order for one basket.
	if draft.CartID != nil {
		tag, err := tx.Exec(ctx, `DELETE FROM cart_items WHERE cart_id = $1`, *draft.CartID)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() == 0 {
			return nil, model.ErrEmptyCart
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &order, nil
}

// reserveStock locks and decrements the stock behind every line.
//
// Lines are locked in a deterministic order (product, then variant) so two
// simultaneous checkouts cannot deadlock against each other, and the variant row
// — not the product aggregate — is the authority for a variant line.
func reserveStock(ctx context.Context, tx pgx.Tx, items []model.OrderItem) error {
	ordered := make([]model.OrderItem, len(items))
	copy(ordered, items)
	sort.Slice(ordered, func(i, j int) bool {
		pi, pj := idOf(ordered[i].ProductID), idOf(ordered[j].ProductID)
		if pi != pj {
			return pi < pj
		}
		return idOf(ordered[i].VariantID) < idOf(ordered[j].VariantID)
	})

	for _, item := range ordered {
		if item.ProductID == nil {
			continue
		}

		if item.VariantID != nil {
			var stock int32
			err := tx.QueryRow(ctx,
				`SELECT stock FROM product_variants WHERE id = $1 AND product_id = $2 FOR UPDATE`,
				*item.VariantID, *item.ProductID).Scan(&stock)
			if err != nil {
				if errors.Is(err, pgx.ErrNoRows) {
					return model.ErrNotFound
				}
				return err
			}
			if stock < item.Quantity {
				return model.ErrOutOfStock
			}
			if _, err := tx.Exec(ctx,
				`UPDATE product_variants SET stock = stock - $2 WHERE id = $1`,
				*item.VariantID, item.Quantity); err != nil {
				return err
			}
			// Keep the product-level aggregate in step; the variant row stays
			// authoritative, so the aggregate is floored rather than checked.
			if _, err := tx.Exec(ctx, `
				UPDATE products SET stock = GREATEST(stock - $2, 0), sold_count = sold_count + $2
				WHERE id = $1`, *item.ProductID, item.Quantity); err != nil {
				return err
			}
			continue
		}

		// No variant: the product row itself must still have enough stock. The
		// predicate makes the check and the decrement one atomic step.
		tag, err := tx.Exec(ctx, `
			UPDATE products SET stock = stock - $2, sold_count = sold_count + $2
			WHERE id = $1 AND stock >= $2`, *item.ProductID, item.Quantity)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return model.ErrOutOfStock
		}
	}
	return nil
}

func idOf(v *int64) int64 {
	if v == nil {
		return 0
	}
	return *v
}

// ListByUser returns one page of a user's orders, newest first.
func (r *OrderRepository) ListByUser(ctx context.Context, userID int64, limit, offset int) ([]model.Order, int64, error) {
	var total int64
	if err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM orders WHERE user_id = $1`, userID).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.Order{}, 0, nil
	}

	rows, err := r.db.Query(ctx,
		orderSelect+` WHERE o.user_id = $1 ORDER BY o.created_at DESC, o.id DESC LIMIT $2 OFFSET $3`,
		userID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	orders := make([]model.Order, 0, limit)
	for rows.Next() {
		order, err := scanOrder(rows)
		if err != nil {
			return nil, 0, err
		}
		orders = append(orders, *order)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if err := r.attachItems(ctx, orders); err != nil {
		return nil, 0, err
	}
	if err := r.attachShipments(ctx, orders); err != nil {
		return nil, 0, err
	}
	return orders, total, nil
}

// GetByID returns one order belonging to the user, with its lines and latest
// payment. Scoping the query by user id is what stops one account from reading
// another's orders.
func (r *OrderRepository) GetByID(ctx context.Context, userID, id int64) (*model.Order, error) {
	order, err := scanOrder(r.db.QueryRow(ctx, orderSelect+` WHERE o.id = $1 AND o.user_id = $2`, id, userID))
	if err != nil {
		return nil, err
	}
	orders := []model.Order{*order}
	if err := r.attachItems(ctx, orders); err != nil {
		return nil, err
	}
	*order = orders[0]
	if err := r.attachPayment(ctx, order); err != nil {
		return nil, err
	}
	page := []model.Order{*order}
	if err := r.attachShipments(ctx, page); err != nil {
		return nil, err
	}
	*order = page[0]
	return order, nil
}

// attachShipments fills in the shipment of a set of orders with one query.
func (r *OrderRepository) attachShipments(ctx context.Context, orders []model.Order) error {
	if len(orders) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(orders))
	index := make(map[int64]int, len(orders))
	for i := range orders {
		ids = append(ids, orders[i].ID)
		index[orders[i].ID] = i
	}

	rows, err := r.db.Query(ctx, `
		SELECT order_id, carrier, tracking_code, status, shipped_at, delivered_at
		FROM shipments WHERE order_id = ANY($1)`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			orderID int64
			s       model.Shipment
		)
		if err := rows.Scan(&orderID, &s.Carrier, &s.TrackingCode, &s.Status, &s.ShippedAt, &s.DeliveredAt); err != nil {
			return err
		}
		if i, ok := index[orderID]; ok {
			orders[i].Shipment = &s
		}
	}
	return rows.Err()
}

// attachItems fills in the lines of a page of orders with one extra query.
func (r *OrderRepository) attachItems(ctx context.Context, orders []model.Order) error {
	if len(orders) == 0 {
		return nil
	}
	ids := make([]int64, 0, len(orders))
	index := make(map[int64]int, len(orders))
	for i := range orders {
		ids = append(ids, orders[i].ID)
		index[orders[i].ID] = i
	}

	rows, err := r.db.Query(ctx, `
		SELECT oi.id, oi.order_id, oi.product_id, oi.variant_id, COALESCE(p.slug, ''),
		       oi.title, oi.variant_label, oi.image_url, oi.unit_price, oi.quantity
		FROM order_items oi
		LEFT JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = ANY($1)
		ORDER BY oi.id`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var item model.OrderItem
		var orderID int64
		if err := rows.Scan(
			&item.ID, &orderID, &item.ProductID, &item.VariantID, &item.Slug,
			&item.Title, &item.VariantLabel, &item.ImageURL, &item.UnitPrice, &item.Quantity,
		); err != nil {
			return err
		}
		item.LineTotal = item.UnitPrice * int64(item.Quantity)
		if i, ok := index[orderID]; ok {
			orders[i].Items = append(orders[i].Items, item)
		}
	}
	return rows.Err()
}

// attachPayment loads the most recent gateway attempt for an order.
func (r *OrderRepository) attachPayment(ctx context.Context, order *model.Order) error {
	var p model.Payment
	err := r.db.QueryRow(ctx, `
		SELECT id, order_id, gateway, COALESCE(authority, ''), COALESCE(ref_id, ''),
		       amount, status::text, card_pan, message, created_at
		FROM payments WHERE order_id = $1
		ORDER BY id DESC LIMIT 1`, order.ID).
		Scan(&p.ID, &p.OrderID, &p.Gateway, &p.Authority, &p.RefID,
			&p.Amount, &p.Status, &p.CardPan, &p.Message, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return err
	}
	order.Payment = &p
	return nil
}

// GetByCode returns an order by its public code.
func (r *OrderRepository) GetByCode(ctx context.Context, code string) (*model.Order, error) {
	return scanOrder(r.db.QueryRow(ctx, orderSelect+` WHERE o.code = $1`, code))
}

// GetByIDUnscoped returns an order without a user filter, with its lines and
// latest payment.
//
// It exists for the payment callback, which is reached by the customer's browser
// without a token: the caller must already have proved ownership some other way
// (here, by presenting a gateway authority issued for that very order).
func (r *OrderRepository) GetByIDUnscoped(ctx context.Context, id int64) (*model.Order, error) {
	order, err := scanOrder(r.db.QueryRow(ctx, orderSelect+` WHERE o.id = $1`, id))
	if err != nil {
		return nil, err
	}
	orders := []model.Order{*order}
	if err := r.attachItems(ctx, orders); err != nil {
		return nil, err
	}
	*order = orders[0]
	if err := r.attachPayment(ctx, order); err != nil {
		return nil, err
	}
	page := []model.Order{*order}
	if err := r.attachShipments(ctx, page); err != nil {
		return nil, err
	}
	*order = page[0]
	return order, nil
}

// UpdateStatus moves an order to a new status.
func (r *OrderRepository) UpdateStatus(ctx context.Context, id int64, status string) error {
	tag, err := r.db.Exec(ctx, `UPDATE orders SET status = $2::order_status WHERE id = $1`, id, status)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}
