package repository

import (
	"context"
	"crypto/subtle"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// maxCodeAttempts is how many wrong guesses one phone number tolerates before
// it is locked out. Six digits with five tries keeps guessing hopeless.
//
// The budget is per (phone, purpose) across a rolling window, not per code row:
// counting only the newest row meant every re-issue restored a fresh five
// guesses, so an attacker could grind indefinitely at the price of an SMS per
// round.
const maxCodeAttempts = 5

// attemptWindow is how far back failures are counted.
const attemptWindow = time.Hour

// PhoneVerificationRepository stores the one-time codes sent to a phone number.
type PhoneVerificationRepository struct {
	db *database.Pool
}

// NewPhoneVerificationRepository wires a repository to the shared pool.
func NewPhoneVerificationRepository(db *database.Pool) *PhoneVerificationRepository {
	return &PhoneVerificationRepository{db: db}
}

// Issue stores a fresh code and returns its expiry. Earlier codes stay in the
// table for the audit trail but only the newest one can ever be verified, so a
// customer always uses the message they received last.
func (r *PhoneVerificationRepository) Issue(
	ctx context.Context, phone, purpose, code string, ttl time.Duration,
) (time.Time, error) {
	const q = `
		INSERT INTO phone_verifications (phone, code, purpose, expires_at)
		VALUES ($1, $2, $3, now() + make_interval(secs => $4))
		RETURNING expires_at`

	var expiresAt time.Time
	err := r.db.QueryRow(ctx, q, phone, code, purpose, int(ttl.Seconds())).Scan(&expiresAt)
	if err != nil {
		return time.Time{}, err
	}

	// Housekeeping: codes nobody will ever use again. Failing here is harmless,
	// the insert above is what matters.
	_, _ = r.db.Exec(ctx, `
		DELETE FROM phone_verifications
		WHERE phone = $1 AND purpose = $2 AND expires_at < now() - interval '1 day'`,
		phone, purpose)

	return expiresAt, nil
}

// LastIssuedAt reports when a code was last created for this phone and purpose.
// It returns model.ErrNotFound when there is none, which callers read as "no
// cooldown to respect yet".
func (r *PhoneVerificationRepository) LastIssuedAt(
	ctx context.Context, phone, purpose string,
) (time.Time, error) {
	const q = `
		SELECT created_at FROM phone_verifications
		WHERE phone = $1 AND purpose = $2
		ORDER BY created_at DESC
		LIMIT 1`

	var createdAt time.Time
	if err := r.db.QueryRow(ctx, q, phone, purpose).Scan(&createdAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return time.Time{}, model.ErrNotFound
		}
		return time.Time{}, err
	}
	return createdAt, nil
}

// Verify checks the newest open code for this phone and burns it on success.
// Every failure mode has its own sentinel so the service can explain itself:
// ErrNotFound when nothing was ever sent, ErrInvalidCode for a wrong or expired
// guess, ErrTooManyRequests once the per-number guess budget is spent.
//
// The row is locked for the check, so two simultaneous submissions cannot both
// pass with the same code.
func (r *PhoneVerificationRepository) Verify(ctx context.Context, phone, purpose, code string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock the phone's whole verification history for this purpose, so the
	// guess budget cannot be raced by firing attempts in parallel.
	if _, err := tx.Exec(ctx, `
		SELECT id FROM phone_verifications
		WHERE phone = $1 AND purpose = $2
		FOR UPDATE`, phone, purpose); err != nil {
		return err
	}

	var failures int
	if err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(attempts), 0) FROM phone_verifications
		WHERE phone = $1 AND purpose = $2 AND created_at > now() - make_interval(secs => $3)`,
		phone, purpose, int(attemptWindow.Seconds())).Scan(&failures); err != nil {
		return err
	}
	if failures >= maxCodeAttempts {
		return model.ErrTooManyRequests
	}

	const pick = `
		SELECT id, code, attempts, expires_at, consumed_at
		FROM phone_verifications
		WHERE phone = $1 AND purpose = $2
		ORDER BY created_at DESC
		LIMIT 1
		FOR UPDATE`

	var (
		id         int64
		stored     string
		attempts   int
		expiresAt  time.Time
		consumedAt *time.Time
	)
	if err := tx.QueryRow(ctx, pick, phone, purpose).
		Scan(&id, &stored, &attempts, &expiresAt, &consumedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return model.ErrNotFound
		}
		return err
	}

	// A code that was already used, ran out of tries or timed out is simply a
	// wrong code from the customer's point of view — asking for a fresh one is
	// the next step either way.
	if consumedAt != nil || !time.Now().Before(expiresAt) {
		return model.ErrInvalidCode
	}

	if subtle.ConstantTimeCompare([]byte(stored), []byte(code)) != 1 {
		// Count the miss and keep the code usable until the attempts run out.
		if _, err := tx.Exec(ctx,
			`UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1`, id); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		return model.ErrInvalidCode
	}

	if _, err := tx.Exec(ctx,
		`UPDATE phone_verifications SET consumed_at = now() WHERE id = $1`, id); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
