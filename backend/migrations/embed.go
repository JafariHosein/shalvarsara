// Package migrations holds the embedded SQL migration files. Embedding keeps
// the schema versioned with the binary, so `docker compose up` needs no extra
// tooling to bring a fresh database up to date.
package migrations

import "embed"

// FS contains every *.sql file in this directory.
//
//go:embed *.sql
var FS embed.FS
