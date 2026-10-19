// Command migrate applies or reverses database migrations and exits.
//
// It is handy in CI and in deployment scripts where the API should not be
// started just to bring the schema up to date:
//
//	go run ./cmd/migrate            # apply everything pending (same as "up")
//	go run ./cmd/migrate up         # apply everything pending
//	go run ./cmd/migrate down       # reverse the last migration
//	go run ./cmd/migrate down 3     # reverse the last three
//	go run ./cmd/migrate down all   # reverse everything
//
// "down" is destructive: each .down.sql drops the objects its .up.sql created.
// It exists so a bad deploy can be undone, and it is never run automatically.
package main

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/database"
)

func main() {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr, TimeFormat: "15:04:05"})

	command, steps, err := parseArgs(os.Args[1:])
	if err != nil {
		fmt.Fprintln(os.Stderr, "migrate:", err)
		os.Exit(2)
	}

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

	switch command {
	case "up":
		if err := db.Migrate(ctx); err != nil {
			log.Fatal().Err(err).Msg("migrate")
		}
		log.Info().Msg("migrations up to date")

	case "down":
		if steps != 0 {
			log.Warn().Int("steps", steps).Msg("reversing migrations — this drops the objects they created")
		} else {
			log.Warn().Msg("reversing EVERY migration — this drops the objects they created")
		}
		reverted, err := db.Rollback(ctx, steps)
		if err != nil {
			log.Fatal().Err(err).Msg("rollback")
		}
		if reverted == 0 {
			log.Info().Msg("nothing to reverse")
			return
		}
		log.Info().Int("reverted", reverted).Msg("rollback complete")
	}
}

// parseArgs turns the command line into a direction and a step count.
// A step count of 0 means "all".
func parseArgs(args []string) (command string, steps int, err error) {
	command = "up"
	if len(args) > 0 {
		command = args[0]
	}

	switch command {
	case "up", "down":
	default:
		return "", 0, fmt.Errorf("unknown command %q (want \"up\" or \"down\")", command)
	}

	// "down" with no count reverses exactly one migration, which is the safe
	// default; "all" (or 0) reverses everything.
	if command == "down" {
		steps = 1
	}
	if len(args) < 2 {
		return command, steps, nil
	}
	if command == "up" {
		return "", 0, fmt.Errorf("unexpected argument %q (\"up\" takes none)", args[1])
	}

	if args[1] == "all" {
		return command, 0, nil
	}
	n, convErr := strconv.Atoi(args[1])
	if convErr != nil || n < 1 {
		return "", 0, fmt.Errorf("invalid step count %q (want a positive number or \"all\")", args[1])
	}
	return command, n, nil
}
