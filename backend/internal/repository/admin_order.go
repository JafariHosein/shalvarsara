package repository

import (
	"context"
	"errors"
	"sort"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/model"
)

// This file holds the fulfilment side of orders: the admin order list, status
// transitions (including returning reserved stock when an order is cancelled)
// and shipments.

// adminOrderSelect adds the columns only the admin list needs — the customer
// behind the order and the shipment, if one exists.
const adminOrderSelect = `
	SELECT ` + orderColumns + `,
	       COALESCE((SELECT SUM(oi.quantity) FROM order_items oi WHERE oi.order_id = o.id), 0),
	       COALESCE(u.name, ''), COALESCE(u.email, ''), COALESCE(u.phone, ''),
	       COALESCE(s.carrier, ''), COALESCE(s.tracking_code, '')
	FROM orders o
	LEFT JOIN coupons c ON c.id = o.coupon_id
	LEFT JOIN users u ON u.id = o.user_id
	LEFT JOIN shipments s ON s.order_id = o.id`

// buildAdminOrderFilter translates the admin filter into a WHERE clause and its
// ordered arguments. All values are bound as parameters.
func buildAdminOrderFilter(f model.AdminOrderFilter) (string, []any) {
	conds := []string{"TRUE"}
	args := []any{}

	if s := strings.TrimSpace(f.Status); s != "" && s != "all" {
		args = append(args, s)
		conds = append(conds, "o.status = $"+strconv.Itoa(len(args))+"::order_status")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, "%"+q+"%")
		ph := "$" + strconv.Itoa(len(args))
		conds = append(conds, "(o.code ILIKE "+ph+" OR o.ship_phone ILIKE "+ph+" OR o.ship_receiver_name ILIKE "+ph+")")
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

// ListForAdmin returns one page of every order, newest first.
func (r *OrderRepository) ListForAdmin(ctx context.Context, f model.AdminOrderFilter) ([]model.AdminOrderSummary, int64, error) {
	where, args := buildAdminOrderFilter(f)

	var total int64
	if err := r.db.QueryRow(ctx, `SELECT count(*) FROM orders o `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.AdminOrderSummary{}, 0, nil
	}

	listArgs := append(append([]any{}, args...), f.Limit, f.Offset())
	q := adminOrderSelect + " " + where +
		" ORDER BY o.created_at DESC, o.id DESC LIMIT $" + strconv.Itoa(len(args)+1) +
		" OFFSET $" + strconv.Itoa(len(args)+2)

	rows, err := r.db.Query(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]model.AdminOrderSummary, 0, f.Limit)
	for rows.Next() {
		var (
			row  model.AdminOrderSummary
			o    model.Order
			ship model.AddressSnapshot
			code string
		)
		if err := rows.Scan(
			&o.ID, &o.Code, &o.UserID, &o.Status, &o.Subtotal, &o.Discount, &o.ShippingCost, &o.Total,
			&code, &o.Note,
			&ship.ReceiverName, &ship.Phone, &ship.Province, &ship.City, &ship.PostalCode, &ship.Line1,
			&o.PaidAt, &o.CreatedAt, &o.UpdatedAt,
			&row.Items, &row.Name, &row.Email, &row.Phone, &row.Carrier, &row.TrackNo,
		); err != nil {
			return nil, 0, err
		}
		o.CouponCode = code
		o.Address = &ship
		o.Items = []model.OrderItem{}
		row.Order = o
		out = append(out, row)
	}
	return out, total, rows.Err()
}

// GetForAdmin returns one order with its lines, payment and shipment.
func (r *OrderRepository) GetForAdmin(ctx context.Context, id int64) (*model.Order, error) {
	return r.GetByIDUnscoped(ctx, id)
}

// TransitionStatus moves an order to a new status and returns it.
//
// Cancelling is the one transition with side effects: the stock reserved at
// checkout is returned and the sold counters are rolled back, in the same
// transaction that changes the status.
func (r *OrderRepository) TransitionStatus(ctx context.Context, id int64, to string) (*model.Order, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		from  string
		items []model.OrderItem
	)
	if err := tx.QueryRow(ctx,
		`SELECT status::text FROM orders WHERE id = $1 FOR UPDATE`, id).Scan(&from); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}

	if from == to {
		return nil, &model.UserFacingError{Err: model.ErrValidation, Text: "سفارش همین حالا در این وضعیت است."}
	}
	if !model.CanTransition(from, to) {
		return nil, &model.UserFacingError{
			Err:  model.ErrValidation,
			Text: "تغییر وضعیت از «" + statusFa(from) + "» به «" + statusFa(to) + "» مجاز نیست.",
		}
	}

	if to == model.OrderCanceled {
		rows, err := tx.Query(ctx, `
			SELECT product_id, variant_id, quantity FROM order_items
			WHERE order_id = $1 ORDER BY product_id, variant_id`, id)
		if err != nil {
			return nil, err
		}
		for rows.Next() {
			var it model.OrderItem
			if err := rows.Scan(&it.ProductID, &it.VariantID, &it.Quantity); err != nil {
				rows.Close()
				return nil, err
			}
			items = append(items, it)
		}
		rows.Close()
		if err := rows.Err(); err != nil {
			return nil, err
		}

		if _, err := tx.Exec(ctx, `
			UPDATE orders SET status = $2::order_status WHERE id = $1`, id, to); err != nil {
			return nil, err
		}
		if err := restoreStock(ctx, tx, items); err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return r.GetByIDUnscoped(ctx, id)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE orders SET
			status = $2::order_status,
			paid_at = CASE WHEN $2 = 'paid' AND paid_at IS NULL THEN now() ELSE paid_at END
		WHERE id = $1`, id, to); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE shipments SET
			status = $2,
			shipped_at = CASE WHEN $2 = 'shipped' AND shipped_at IS NULL THEN now() ELSE shipped_at END,
			delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END
		WHERE order_id = $1`, id, to); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetByIDUnscoped(ctx, id)
}

// restoreStock is the exact inverse of reserveStock and locks rows in the same
// order, so a cancel and a concurrent checkout cannot deadlock.
func restoreStock(ctx context.Context, tx pgx.Tx, items []model.OrderItem) error {
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
			if _, err := tx.Exec(ctx,
				`SELECT 1 FROM product_variants WHERE id = $1 FOR UPDATE`, *item.VariantID); err != nil {
				return err
			}
			if _, err := tx.Exec(ctx,
				`UPDATE product_variants SET stock = stock + $2 WHERE id = $1`,
				*item.VariantID, item.Quantity); err != nil {
				return err
			}
		}
		if _, err := tx.Exec(ctx, `
			UPDATE products SET stock = stock + $2, sold_count = GREATEST(sold_count - $2, 0)
			WHERE id = $1`, *item.ProductID, item.Quantity); err != nil {
			return err
		}
	}
	return nil
}

// UpsertShipment records how an order left the warehouse. Registering a
// shipment on a paid order also moves it to processing, which is what the
// admin means by "the parcel is with the courier".
func (r *OrderRepository) UpsertShipment(ctx context.Context, id int64, in model.AdminShipmentInput) (*model.Order, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status string
	if err := tx.QueryRow(ctx,
		`SELECT status::text FROM orders WHERE id = $1 FOR UPDATE`, id).Scan(&status); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	switch status {
	case model.OrderPaid, model.OrderProcessing, model.OrderShipped, model.OrderDelivered:
		// A shipment may be recorded (or corrected) on any live order.
	default:
		return nil, &model.UserFacingError{
			Err:  model.ErrValidation,
			Text: "برای سفارش در وضعیت «" + statusFa(status) + "» نمی‌توان مرسوله ثبت کرد.",
		}
	}

	next := status
	if status == model.OrderPaid {
		next = model.OrderProcessing
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO shipments (order_id, carrier, tracking_code, status, shipped_at)
		VALUES ($1, $2, $3, $4, NULL)
		ON CONFLICT (order_id) DO UPDATE SET
			carrier = EXCLUDED.carrier,
			tracking_code = EXCLUDED.tracking_code`,
		id, in.Carrier, in.TrackingCode, next); err != nil {
		return nil, err
	}

	if next != status {
		if _, err := tx.Exec(ctx,
			`UPDATE orders SET status = $2::order_status WHERE id = $1`, id, next); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.GetByIDUnscoped(ctx, id)
}

// statusFa is the label the admin sees for an order status.
func statusFa(status string) string {
	switch status {
	case model.OrderPending:
		return "در انتظار پرداخت"
	case model.OrderPaid:
		return "پرداخت‌شده"
	case model.OrderProcessing:
		return "در حال آماده‌سازی"
	case model.OrderShipped:
		return "ارسال‌شده"
	case model.OrderDelivered:
		return "تحویل‌شده"
	case model.OrderCanceled:
		return "لغوشده"
	default:
		return status
	}
}
