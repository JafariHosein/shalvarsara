package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// PaymentRepository persists gateway attempts. Amounts here are always Rial:
// the Toman -> Rial conversion happens in the payment service, once.
type PaymentRepository struct {
	db *database.Pool
}

// NewPaymentRepository wires a repository to the shared pool.
func NewPaymentRepository(db *database.Pool) *PaymentRepository {
	return &PaymentRepository{db: db}
}

const paymentColumns = `id, order_id, gateway, COALESCE(authority, ''), COALESCE(ref_id, ''),
	amount, status::text, card_pan, message, created_at`

func scanPayment(row pgx.Row) (*model.Payment, error) {
	var p model.Payment
	err := row.Scan(&p.ID, &p.OrderID, &p.Gateway, &p.Authority, &p.RefID,
		&p.Amount, &p.Status, &p.CardPan, &p.Message, &p.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

// Create starts a new payment attempt for an order.
func (r *PaymentRepository) Create(ctx context.Context, orderID, amountRial int64) (*model.Payment, error) {
	return scanPayment(r.db.QueryRow(ctx, `
		INSERT INTO payments (order_id, gateway, amount, status)
		VALUES ($1, 'zarinpal', $2, 'initiated')
		RETURNING `+paymentColumns, orderID, amountRial))
}

// SetAuthority stores the token the gateway returned for an attempt.
func (r *PaymentRepository) SetAuthority(ctx context.Context, id int64, authority string) error {
	_, err := r.db.Exec(ctx, `UPDATE payments SET authority = $2 WHERE id = $1`, id, authority)
	return err
}

// GetByAuthority finds the attempt a gateway callback refers to.
func (r *PaymentRepository) GetByAuthority(ctx context.Context, authority string) (*model.Payment, error) {
	return scanPayment(r.db.QueryRow(ctx,
		`SELECT `+paymentColumns+` FROM payments WHERE authority = $1`, authority))
}

// Fail records a declined or abandoned attempt.
func (r *PaymentRepository) Fail(ctx context.Context, id int64, message string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE payments SET status = 'failed', message = $2 WHERE id = $1`, id, message)
	return err
}

// Complete marks the payment verified and the order paid in one transaction, so
// the two can never disagree. It is safe to call once per authority: the caller
// checks the payment status first and this method is a no-op on an order that is
// already paid.
func (r *PaymentRepository) Complete(
	ctx context.Context, paymentID, orderID int64, refID, cardPan string,
) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `
		UPDATE payments
		SET status = 'verified', ref_id = $2, card_pan = $3, message = ''
		WHERE id = $1`, paymentID, refID, cardPan); err != nil {
		return err
	}

	if _, err := tx.Exec(ctx, `
		UPDATE orders
		SET status = 'paid', paid_at = COALESCE(paid_at, now())
		WHERE id = $1`, orderID); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
