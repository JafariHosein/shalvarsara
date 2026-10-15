package repository

import (
	"context"
	"strconv"
	"strings"

	"github.com/shalvarsara/backend/internal/model"
)

// This file holds the read side of the payments table for the admin panel: one
// row per gateway attempt, joined to the order it belongs to and the customer
// behind it.

const adminPaymentSelect = `
	SELECT p.id, p.order_id, p.gateway, COALESCE(p.authority, ''), COALESCE(p.ref_id, ''),
	       p.amount, p.status::text, p.card_pan, p.message, p.created_at,
	       o.code, o.user_id, COALESCE(u.name, ''), COALESCE(u.email, ''), COALESCE(u.phone, '')
	FROM payments p
	JOIN orders o ON o.id = p.order_id
	LEFT JOIN users u ON u.id = o.user_id`

// paymentStatusFa is the label the admin panel shows for a payment status.
func paymentStatusFa(status string) string {
	switch status {
	case model.PaymentInitiated:
		return "در انتظار پرداخت"
	case model.PaymentVerified:
		return "پرداخت موفق"
	case model.PaymentFailed:
		return "پرداخت ناموفق"
	default:
		return status
	}
}

// buildAdminPaymentFilter translates the admin filter into a WHERE clause and
// its ordered arguments. All values are bound as parameters.
func buildAdminPaymentFilter(f model.AdminPaymentFilter) (string, []any) {
	conds := []string{"TRUE"}
	args := []any{}

	if s := strings.TrimSpace(f.Status); s != "" && s != "all" {
		args = append(args, s)
		conds = append(conds, "p.status = $"+strconv.Itoa(len(args))+"::payment_status")
	}
	if q := strings.TrimSpace(f.Query); q != "" {
		args = append(args, "%"+q+"%")
		ph := "$" + strconv.Itoa(len(args))
		conds = append(conds, "(o.code ILIKE "+ph+" OR COALESCE(p.authority, '') ILIKE "+ph+
			" OR COALESCE(p.ref_id, '') ILIKE "+ph+")")
	}
	return "WHERE " + strings.Join(conds, " AND "), args
}

// ListForAdmin returns one page of payment attempts, newest first.
func (r *PaymentRepository) ListForAdmin(ctx context.Context, f model.AdminPaymentFilter) ([]model.AdminPaymentRow, int64, error) {
	where, args := buildAdminPaymentFilter(f)

	var total int64
	countQuery := `SELECT count(*) FROM payments p JOIN orders o ON o.id = p.order_id ` + where
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	if total == 0 {
		return []model.AdminPaymentRow{}, 0, nil
	}

	listArgs := append(append([]any{}, args...), f.Limit, f.Offset())
	q := adminPaymentSelect + " " + where +
		" ORDER BY p.created_at DESC, p.id DESC LIMIT $" + strconv.Itoa(len(args)+1) +
		" OFFSET $" + strconv.Itoa(len(args)+2)

	rows, err := r.db.Query(ctx, q, listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := make([]model.AdminPaymentRow, 0, f.Limit)
	for rows.Next() {
		var (
			row model.AdminPaymentRow
			p   model.Payment
		)
		if err := rows.Scan(
			&p.ID, &p.OrderID, &p.Gateway, &p.Authority, &p.RefID,
			&p.Amount, &p.Status, &p.CardPan, &p.Message, &p.CreatedAt,
			&row.OrderCode, &row.UserID, &row.Name, &row.Email, &row.Phone,
		); err != nil {
			return nil, 0, err
		}
		row.Payment = p
		row.StatusFa = paymentStatusFa(p.Status)
		out = append(out, row)
	}
	return out, total, rows.Err()
}
