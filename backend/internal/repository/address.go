package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// AddressRepository persists user shipping addresses.
type AddressRepository struct {
	db *database.Pool
}

// NewAddressRepository wires a repository to the shared pool.
func NewAddressRepository(db *database.Pool) *AddressRepository {
	return &AddressRepository{db: db}
}

const addressColumns = `id, user_id, receiver_name, phone, province, city, postal_code,
	line1, line2, is_default, created_at, updated_at`

func scanAddress(row pgx.Row) (*model.Address, error) {
	var a model.Address
	err := row.Scan(
		&a.ID, &a.UserID, &a.ReceiverName, &a.Phone, &a.Province, &a.City,
		&a.PostalCode, &a.Line1, &a.Line2, &a.IsDefault, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

// Create inserts an address. When a is the default, it clears any previous
// default first so the partial unique index never trips.
func (r *AddressRepository) Create(ctx context.Context, a *model.Address) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if a.IsDefault {
		if _, err := tx.Exec(ctx,
			`UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND is_default`, a.UserID); err != nil {
			return err
		}
	}

	const q = `
		INSERT INTO addresses (user_id, receiver_name, phone, province, city, postal_code, line1, line2, is_default)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		RETURNING id, created_at, updated_at`
	if err := tx.QueryRow(ctx, q,
		a.UserID, a.ReceiverName, a.Phone, a.Province, a.City, a.PostalCode, a.Line1, a.Line2, a.IsDefault,
	).Scan(&a.ID, &a.CreatedAt, &a.UpdatedAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListByUser returns a user's addresses with the default one first.
func (r *AddressRepository) ListByUser(ctx context.Context, userID int64) ([]model.Address, error) {
	rows, err := r.db.Query(ctx,
		`SELECT `+addressColumns+` FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]model.Address, 0, 4)
	for rows.Next() {
		var a model.Address
		if err := rows.Scan(
			&a.ID, &a.UserID, &a.ReceiverName, &a.Phone, &a.Province, &a.City,
			&a.PostalCode, &a.Line1, &a.Line2, &a.IsDefault, &a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, rows.Err()
}

// GetByID returns an address, scoped to its owner so a user can never read
// someone else's address by guessing an id.
func (r *AddressRepository) GetByID(ctx context.Context, userID, id int64) (*model.Address, error) {
	return scanAddress(r.db.QueryRow(ctx,
		`SELECT `+addressColumns+` FROM addresses WHERE id = $1 AND user_id = $2`, id, userID))
}

// Update modifies an address owned by userID.
func (r *AddressRepository) Update(ctx context.Context, a *model.Address) (*model.Address, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if a.IsDefault {
		if _, err := tx.Exec(ctx,
			`UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND is_default AND id <> $2`,
			a.UserID, a.ID); err != nil {
			return nil, err
		}
	}

	const q = `
		UPDATE addresses SET
			receiver_name = $3, phone = $4, province = $5, city = $6,
			postal_code = $7, line1 = $8, line2 = $9, is_default = $10
		WHERE id = $1 AND user_id = $2
		RETURNING ` + addressColumns
	updated, err := scanAddress(tx.QueryRow(ctx, q,
		a.ID, a.UserID, a.ReceiverName, a.Phone, a.Province, a.City,
		a.PostalCode, a.Line1, a.Line2, a.IsDefault))
	if err != nil {
		return nil, err
	}
	return updated, tx.Commit(ctx)
}

// Delete removes an address owned by userID.
func (r *AddressRepository) Delete(ctx context.Context, userID, id int64) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM addresses WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}
