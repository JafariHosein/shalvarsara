// Command dbq runs one SQL query against the configured database and prints
// the rows as JSON. Developer tool for inspecting the demo data.
//
//	go run ./cmd/dbq "SELECT id, title FROM products LIMIT 3"
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/database"
)

func main() {
	sql := strings.Join(os.Args[1:], " ")
	if sql == "" {
		fmt.Println(`usage: go run ./cmd/dbq "SELECT ..."`)
		os.Exit(1)
	}

	cfg, err := config.Load()
	if err != nil {
		panic(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		panic(err)
	}
	defer db.Close()

	rows, err := db.Query(ctx, sql)
	if err != nil {
		panic(err)
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	out := []map[string]any{}
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			panic(err)
		}
		row := map[string]any{}
		for i, f := range fields {
			row[string(f.Name)] = values[i]
		}
		out = append(out, row)
	}
	if err := rows.Err(); err != nil {
		panic(err)
	}
	encoded, _ := json.MarshalIndent(out, "", " ")
	fmt.Println(string(encoded))
}
