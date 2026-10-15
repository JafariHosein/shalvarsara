// Command migrate applies pending database migrations and exits.
//
// It is handy in CI and in deployment scripts where the API should not be
// started just to bring the schema up to date:
//
//	go run ./cmd/migrate
package main

import (
	"context"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/database"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("load config")
	}

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("connect database")
	}
	defer db.Close()

	if err := db.Migrate(ctx); err != nil {
		log.Fatal().Err(err).Msg("migrate")
	}
	log.Info().Msg("migrations up to date")
}
