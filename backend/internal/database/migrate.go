package database

import (
	"context"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/shalvarsara/backend/migrations"
)

// advisoryLockKey is an arbitrary constant used to serialize migrations when
// several API instances start at the same time.
const advisoryLockKey int64 = 947123456001

// Migrate applies every pending *.up.sql migration exactly once, in filename
// order. It is safe to call on every boot: applied versions are recorded in
// schema_migrations and skipped afterwards.
func (p *Pool) Migrate(ctx context.Context) error {
	return p.withMigrationLock(ctx, func() error {
		applied, err := p.appliedVersions(ctx)
		if err != nil {
			return err
		}

		files, err := upMigrationFiles()
		if err != nil {
			return err
		}

		for _, name := range files {
			version := versionOf(name)
			if applied[version] {
				continue
			}
			body, err := migrations.FS.ReadFile(name)
			if err != nil {
				return fmt.Errorf("migrate: read %s: %w", name, err)
			}
			if err := p.applyOne(ctx, version, string(body)); err != nil {
				return fmt.Errorf("migrate: apply %s: %w", name, err)
			}
		}
		return nil
	})
}

// Rollback reverses the most recently applied migrations, newest first.
//
// steps <= 0 reverses everything. A version whose .down.sql is missing stops the
// rollback rather than being skipped: silently stepping over it would leave the
// schema in a state neither version describes.
//
// This is the escape hatch for a bad deploy, so it is deliberately explicit —
// nothing calls it automatically.
func (p *Pool) Rollback(ctx context.Context, steps int) (int, error) {
	done := 0
	err := p.withMigrationLock(ctx, func() error {
		applied, err := p.appliedVersions(ctx)
		if err != nil {
			return err
		}
		if len(applied) == 0 {
			return nil
		}

		names, err := upMigrationFiles()
		if err != nil {
			return err
		}

		// Reverse order: the newest migration is undone first.
		for i := len(names) - 1; i >= 0; i-- {
			if steps > 0 && done >= steps {
				return nil
			}
			version := versionOf(names[i])
			if !applied[version] {
				continue
			}

			downName := strings.TrimSuffix(names[i], ".up.sql") + ".down.sql"
			body, err := migrations.FS.ReadFile(downName)
			if err != nil {
				return fmt.Errorf("migrate: read %s: %w", downName, err)
			}
			if err := p.revertOne(ctx, version, string(body)); err != nil {
				return fmt.Errorf("migrate: revert %s: %w", downName, err)
			}
			done++
		}
		return nil
	})
	return done, err
}

// withMigrationLock runs fn while holding the cross-process migration lock.
//
// The lock is session-scoped, so it has to be taken and released on ONE
// connection. Taking it through the pool would leave it held by whichever idle
// connection ran the statement, and the deferred unlock would run on a different
// one and silently do nothing — leaving the next process to block until that
// connection died.
func (p *Pool) withMigrationLock(ctx context.Context, fn func() error) error {
	if err := p.ensureMigrationsTable(ctx); err != nil {
		return err
	}

	conn, err := p.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("migrate: acquire connection: %w", err)
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", advisoryLockKey); err != nil {
		return fmt.Errorf("migrate: acquire lock: %w", err)
	}
	defer func() {
		_, _ = conn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", advisoryLockKey)
	}()

	return fn()
}

// applyOne runs a migration and records it in a single transaction, so a
// failure leaves neither a half-applied schema nor a false "applied" row.
func (p *Pool) applyOne(ctx context.Context, version, body string) error {
	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, body); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		"INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// revertOne runs a down migration and forgets its version in a single
// transaction, so a failure leaves neither a half-reverted schema nor a stale
// "applied" row that would make the next Migrate() skip it.
func (p *Pool) revertOne(ctx context.Context, version, body string) error {
	tx, err := p.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, body); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		"DELETE FROM schema_migrations WHERE version = $1", version); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (p *Pool) ensureMigrationsTable(ctx context.Context) error {
	const ddl = `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`
	if _, err := p.Exec(ctx, ddl); err != nil {
		return fmt.Errorf("migrate: create schema_migrations: %w", err)
	}
	return nil
}

func (p *Pool) appliedVersions(ctx context.Context) (map[string]bool, error) {
	rows, err := p.Query(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return nil, fmt.Errorf("migrate: read applied: %w", err)
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		applied[v] = true
	}
	return applied, rows.Err()
}

// upMigrationFiles returns the *.up.sql names, sorted ascending.
func upMigrationFiles() ([]string, error) {
	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return nil, fmt.Errorf("migrate: read dir: %w", err)
	}
	var names []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".up.sql") {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)
	return names, nil
}

// versionOf turns "000001_init.up.sql" into "000001_init".
func versionOf(filename string) string {
	return strings.TrimSuffix(filename, ".up.sql")
}
