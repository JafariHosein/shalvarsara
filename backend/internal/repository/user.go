// Package repository is the data-access layer. Every query is parameterized;
// user input is never concatenated into SQL.
package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// UserRepository persists user accounts.
type UserRepository struct {
	db *database.Pool
}

// NewUserRepository wires a repository to the shared pool.
func NewUserRepository(db *database.Pool) *UserRepository {
	return &UserRepository{db: db}
}

const userColumns = `id, name, email, phone, password_hash, role, is_active, token_version, phone_verified_at, created_at, updated_at`

// scanUser reads one row into a User, converting the enum to our Role type.
func scanUser(row pgx.Row) (*model.User, error) {
	var (
		u    model.User
		role string
	)
	err := row.Scan(
		&u.ID, &u.Name, &u.Email, &u.Phone, &u.PasswordHash,
		&role, &u.IsActive, &u.TokenVersion, &u.PhoneVerifiedAt, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, model.ErrNotFound
		}
		return nil, err
	}
	u.Role = model.Role(role)
	return &u, nil
}

// Create inserts a user and fills in the generated id and timestamps.
func (r *UserRepository) Create(ctx context.Context, u *model.User) error {
	const q = `
		INSERT INTO users (name, email, phone, password_hash, role, phone_verified_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`

	err := r.db.QueryRow(ctx, q,
		u.Name, u.Email, u.Phone, u.PasswordHash, string(u.Role), u.PhoneVerifiedAt).
		Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
	if isUniqueViolation(err) {
		return model.ErrConflict
	}
	return err
}

// GetByID returns a user by primary key.
func (r *UserRepository) GetByID(ctx context.Context, id int64) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE id = $1`, id))
}

// GetByEmail returns a user by email (already normalized to lowercase).
func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	return scanUser(r.db.QueryRow(ctx, `SELECT `+userColumns+` FROM users WHERE email = $1`, email))
}

// GetByPhone returns the most recent account with this phone number.
//
// Phone numbers are not unique — two family members may share one — so this is
// a "is this number already in use" check rather than a lookup by identity.
func (r *UserRepository) GetByPhone(ctx context.Context, phone string) (*model.User, error) {
	const q = `SELECT ` + userColumns + ` FROM users WHERE phone = $1 ORDER BY id LIMIT 1`
	return scanUser(r.db.QueryRow(ctx, q, phone))
}

// UpdateProfile changes the mutable profile fields.
func (r *UserRepository) UpdateProfile(ctx context.Context, id int64, name, phone string) (*model.User, error) {
	const q = `
		UPDATE users SET name = $2, phone = $3
		WHERE id = $1
		RETURNING ` + userColumns
	return scanUser(r.db.QueryRow(ctx, q, id, name, phone))
}

// UpdatePassword replaces the stored hash and invalidates every token issued
// before the change. Without the version bump, "change your password to lock the
// attacker out" would not actually end their session: access tokens live 15
// minutes and refresh tokens 30 days.
func (r *UserRepository) UpdatePassword(ctx context.Context, id int64, passwordHash string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE users
		SET password_hash = $2, token_version = token_version + 1
		WHERE id = $1`, id, passwordHash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// BumpTokenVersion invalidates every token issued for the user so far. Logout
// and an admin deactivation call it, which is what makes "log out everywhere"
// real for stateless JWTs.
func (r *UserRepository) BumpTokenVersion(ctx context.Context, id int64) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE users SET token_version = token_version + 1 WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return model.ErrNotFound
	}
	return nil
}

// Count returns the total number of users (used by the admin dashboard).
func (r *UserRepository) Count(ctx context.Context) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&n)
	return n, err
}
