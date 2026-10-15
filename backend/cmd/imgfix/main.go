// Command imgfix repoints an already-seeded catalogue at the product
// photography in frontend/public/products. New databases get the right URLs
// straight from the seeder; this is a one-off for the live demo data.
package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/database"
)

var pantSlugs = map[string]string{
	"جین":      "jeans",
	"پارچه‌ای": "fabric",
	"کتان":     "cotton",
	"کارگو":    "cargo",
	"اسلش":     "slash",
	"بگ":       "baggy",
	"اسکینی":   "skinny",
}

var colourSlugs = map[string]string{
	"مشکی":     "black",
	"سرمه‌ای":  "navy",
	"آبی روشن": "lightblue",
	"خاکستری":  "gray",
	"بژ":       "beige",
	"زیتونی":   "olive",
	"قهوه‌ای":  "brown",
	"شکلاتی":   "chocolate",
}

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

	rows, err := db.Query(ctx, `SELECT id, title, pant_type FROM products ORDER BY id`)
	if err != nil {
		log.Fatal().Err(err).Msg("load products")
	}
	type product struct {
		id       int64
		title    string
		pantType string
	}
	products := []product{}
	for rows.Next() {
		var p product
		if err := rows.Scan(&p.id, &p.title, &p.pantType); err != nil {
			log.Fatal().Err(err).Msg("scan product")
		}
		products = append(products, p)
	}
	rows.Close()

	updated, skipped := 0, 0
	for _, p := range products {
		slug, ok := pantSlugs[p.pantType]
		if !ok {
			log.Warn().Str("pantType", p.pantType).Int64("id", p.id).Msg("unknown pant type; skipped")
			skipped++
			continue
		}

		// Distinct colours in a stable order; the first two drive the gallery.
		colourRows, err := db.Query(ctx,
			`SELECT DISTINCT color FROM product_variants WHERE product_id = $1 ORDER BY color`, p.id)
		if err != nil {
			log.Fatal().Err(err).Msg("load variants")
		}
		colourNames := []string{}
		for colourRows.Next() {
			var name string
			if err := colourRows.Scan(&name); err != nil {
				log.Fatal().Err(err).Msg("scan colour")
			}
			colourNames = append(colourNames, name)
		}
		colourRows.Close()
		if len(colourNames) == 0 {
			log.Warn().Int64("id", p.id).Msg("product without variants; skipped")
			skipped++
			continue
		}
		primary, ok := colourSlugs[colourNames[0]]
		if !ok {
			log.Warn().Str("colour", colourNames[0]).Int64("id", p.id).Msg("unknown colour; skipped")
			skipped++
			continue
		}
		folded := primary
		if len(colourNames) > 1 {
			if slug2, ok := colourSlugs[colourNames[1]]; ok {
				folded = slug2
			}
		}
		primaryName := colourNames[0]
		foldedName := primaryName
		if len(colourNames) > 1 {
			foldedName = colourNames[1]
		}

		// Products sharing a type/colour pair alternate between the two photos
		// that exist for that pair (see frontend/public/products/SOURCES.md).
		photo := int(p.id%2) + 1
		other := 3 - photo

		type imageRow struct {
			url  string
			alt  string
			sort int
		}
		images := []imageRow{
			{fmt.Sprintf("/products/%s-%s-a-%d.webp", slug, primary, photo), fmt.Sprintf("%s — نمای کامل، رنگ %s", p.title, primaryName), 0},
			{fmt.Sprintf("/products/%s-%s-b-%d.webp", slug, primary, photo), fmt.Sprintf("%s — جزئیات کمر و جیب، رنگ %s", p.title, primaryName), 1},
		}
		if len(colourNames) > 1 {
			images = append(images, imageRow{fmt.Sprintf("/products/%s-%s-a-%d.webp", slug, folded, other), fmt.Sprintf("%s — نمای کامل، رنگ %s", p.title, foldedName), 2})
		}
		images = append(images, imageRow{fmt.Sprintf("/products/%s-%s-c-%d.webp", slug, primary, photo), fmt.Sprintf("%s — دمپا و قد شلوار، رنگ %s", p.title, primaryName), len(images)})

		for _, img := range images {
			tag, err := db.Exec(ctx, `
				UPDATE product_images SET url = $2, alt = $3
				WHERE product_id = $1 AND sort_order = $4`, p.id, img.url, img.alt, img.sort)
			if err != nil {
				log.Fatal().Err(err).Msg("update image")
			}
			if tag.RowsAffected() == 0 {
				if _, err := db.Exec(ctx, `
					INSERT INTO product_images (product_id, url, alt, is_primary, sort_order)
					VALUES ($1, $2, $3, $4, $5)`,
					p.id, img.url, img.alt, img.sort == 0, img.sort); err != nil {
					log.Fatal().Err(err).Msg("insert image")
				}
			}
		}
		// Drop leftovers from the previous (3-4 slot) gallery layout.
		if _, err := db.Exec(ctx,
			`DELETE FROM product_images WHERE product_id = $1 AND sort_order >= $2`, p.id, len(images)); err != nil {
			log.Fatal().Err(err).Msg("prune stale images")
		}
		updated++
	}

	log.Info().Int("products", updated).Int("skipped", skipped).Msg("catalogue images repointed")
}
