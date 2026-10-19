package repository

import (
	"errors"
	"strings"

	"github.com/jackc/pgx/v5/pgconn"
)

// isUniqueViolation reports whether err is a PostgreSQL unique-constraint
// violation (SQLSTATE 23505). Repositories translate this into model.ErrConflict
// so services can react without importing the driver.
func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}

// isForeignKeyViolation reports SQLSTATE 23503.
func isForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23503"
	}
	return false
}

// isCheckViolation reports SQLSTATE 23514.
func isCheckViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23514"
	}
	return false
}

// isInvalidTextRepresentation reports SQLSTATE 22P02, raised when a value that
// is not a member of a PostgreSQL enum is cast to it.
func isInvalidTextRepresentation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "22P02"
	}
	return false
}

// likeEscaper neutralises the LIKE metacharacters in user input.
var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// likePattern builds a "contains" pattern for ILIKE.
//
// Without escaping, a search box value of "%" would match every row and "_"
// would match any character, so a legitimate-looking query would silently
// return the whole table (and an arbitrary page of it). Queries using this
// helper must include `ESCAPE '\'`.
func likePattern(q string) string {
	return "%" + likeEscaper.Replace(q) + "%"
}
