// Command seed populates the database with the initial catalogue: categories,
// 50 trousers, an admin account and a demo customer.
//
//	go run ./cmd/seed
package main

import (
	"context"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/seeder"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("load config")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("connect database")
	}
	defer db.Close()

	if err := db.Migrate(ctx); err != nil {
		log.Fatal().Err(err).Msg("migrate")
	}

	if err := seeder.Seed(ctx, db, cfg.Admin, cfg.AppEnv); err != nil {
		log.Fatal().Err(err).Msg("seed")
	}
}
