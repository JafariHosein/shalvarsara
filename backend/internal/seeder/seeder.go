// Package seeder fills an empty database with realistic starting data: an
// admin account, a demo customer, categories, coupons and 50 trousers.
//
// Seeding is idempotent: users and categories are upserted, and the catalogue
// is only generated when the products table is still empty.
package seeder

import (
	"context"
	"fmt"
	"math/rand"
	"strings"

	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	"github.com/shalvarsara/backend/internal/config"
	"github.com/shalvarsara/backend/internal/database"
	"github.com/shalvarsara/backend/internal/model"
)

// Seed runs the full seed. It is safe to call on every boot.
func Seed(ctx context.Context, db *database.Pool, admin config.AdminConfig) error {
	rng := rand.New(rand.NewSource(1403)) // fixed seed => reproducible catalogue

	if err := seedUsers(ctx, db, admin); err != nil {
		return fmt.Errorf("seed users: %w", err)
	}

	categories, err := seedCategories(ctx, db)
	if err != nil {
		return fmt.Errorf("seed categories: %w", err)
	}

	if err := seedCoupons(ctx, db); err != nil {
		return fmt.Errorf("seed coupons: %w", err)
	}

	var existing int64
	if err := db.QueryRow(ctx, `SELECT count(*) FROM products`).Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		log.Info().Int64("products", existing).Msg("catalogue already present; skipping product generation")
		return nil
	}

	if err := seedProducts(ctx, db, rng, categories); err != nil {
		return fmt.Errorf("seed products: %w", err)
	}
	log.Info().Int("products", productCount).Msg("catalogue seeded")
	return nil
}

// ---------------------------------------------------------------- users ----

func seedUsers(ctx context.Context, db *database.Pool, admin config.AdminConfig) error {
	adminPassword := admin.Password
	if strings.TrimSpace(adminPassword) == "" {
		adminPassword = "Admin@12345"
	}

	accounts := []struct {
		name     string
		email    string
		phone    string
		password string
		role     model.Role
	}{
		{admin.Name, strings.ToLower(admin.Email), "09120000000", adminPassword, model.RoleAdmin},
		{"کاربر نمونه", "customer@example.com", "09121111111", "Customer@12345", model.RoleCustomer},
	}

	for _, a := range accounts {
		hash, err := bcrypt.GenerateFromPassword([]byte(a.password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		// Upsert by email so re-running does not fail on the unique index.
		_, err = db.Exec(ctx, `
			INSERT INTO users (name, email, phone, password_hash, role)
			VALUES ($1, $2, $3, $4, $5)
			ON CONFLICT (email) DO UPDATE SET
				name = EXCLUDED.name,
				phone = EXCLUDED.phone,
				role = EXCLUDED.role
		`, a.name, a.email, a.phone, string(hash), string(a.role))
		if err != nil {
			return err
		}
		log.Info().Str("email", a.email).Str("role", string(a.role)).Msg("account ready")
	}
	return nil
}

// ----------------------------------------------------------- categories ----

type seedCategory struct {
	ID   int64
	Slug string
	Name string
}

func seedCategories(ctx context.Context, db *database.Pool) (map[string]seedCategory, error) {
	defs := []seedCategory{
		{Slug: "men", Name: "شلوار مردانه"},
		{Slug: "women", Name: "شلوار زنانه"},
		{Slug: "kids", Name: "شلوار بچگانه"},
	}

	out := make(map[string]seedCategory, len(defs))
	for i, d := range defs {
		var id int64
		err := db.QueryRow(ctx, `
			INSERT INTO categories (name, slug, sort_order)
			VALUES ($1, $2, $3)
			ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`, d.Name, d.Slug, i+1).Scan(&id)
		if err != nil {
			return nil, err
		}
		out[d.Slug] = seedCategory{ID: id, Slug: d.Slug, Name: d.Name}
	}
	return out, nil
}

// -------------------------------------------------------------- coupons ----

func seedCoupons(ctx context.Context, db *database.Pool) error {
	const q = `
		INSERT INTO coupons (code, type, amount, min_order, max_uses, expires_at, is_active)
		VALUES ($1, $2, $3, $4, $5, now() + interval '90 days', TRUE)
		ON CONFLICT (code) DO NOTHING`

	if _, err := db.Exec(ctx, q, "WELCOME10", "percent", 10, 300000, 0); err != nil {
		return err
	}
	if _, err := db.Exec(ctx, q, "OFF50000", "fixed", 50000, 700000, 0); err != nil {
		return err
	}
	return nil
}

// ------------------------------------------------------------- products ----

const productCount = 50

// genderProfile describes the sizing and naming for one audience.
type genderProfile struct {
	persian string
	english string
	catSlug string
	sizes   []string
}

var genders = []genderProfile{
	{
		persian: "مردانه", english: "men", catSlug: "men",
		sizes: []string{"30", "32", "34", "36", "38", "40", "42", "44"},
	},
	{
		persian: "زنانه", english: "women", catSlug: "women",
		sizes: []string{"36", "38", "40", "42", "44", "46"},
	},
	{
		persian: "بچگانه", english: "kids", catSlug: "kids",
		sizes: []string{"4", "6", "8", "10", "12"},
	},
}

var pantTypes = []struct {
	persian string
	english string
	base    int64 // base price in Toman
}{
	{"جین", "jeans", 890_000},
	{"پارچه‌ای", "fabric", 720_000},
	{"کتان", "cotton", 640_000},
	{"کارگو", "cargo", 810_000},
	{"اسلش", "slash", 560_000},
	{"بگ", "baggy", 690_000},
	{"اسکینی", "skinny", 750_000},
}

var styles = []struct {
	persian string
	english string
}{
	{"اسلیم فیت", "slim-fit"},
	{"بگ فیت", "baggy-fit"},
	{"راحت", "relaxed"},
	{"کلاسیک", "classic"},
	{"اسپرت", "sport"},
	{"کمرکش‌دار", "elastic-waist"},
	{"دمپا کش", "tapered"},
	{"کوتاه", "cropped"},
}

var brands = []string{"لوییز", "دنیزو", "پارس‌جین", "آرمانی", "کانواس", "نیوشا", "راما", "میلاد"}

var fabrics = []string{
	"جین کشی", "پارچه فاستونی", "کتان", "مخلوط پنبه", "کتان کشی", "جین سنگ‌شور", "کرپ",
}

var colors = []struct {
	name string
	hex  string
}{
	{"مشکی", "#111827"},
	{"سرمه‌ای", "#1E3A8A"},
	{"آبی روشن", "#60A5FA"},
	{"خاکستری", "#6B7280"},
	{"بژ", "#D6C4A8"},
	{"زیتونی", "#4B5320"},
	{"قهوه‌ای", "#6B4226"},
	{"شکلاتی", "#4B2E2E"},
}

func seedProducts(ctx context.Context, db *database.Pool, rng *rand.Rand, cats map[string]seedCategory) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	for i := 0; i < productCount; i++ {
		g := genders[i%len(genders)]
		pant := pantTypes[rng.Intn(len(pantTypes))]
		style := styles[rng.Intn(len(styles))]
		brand := brands[rng.Intn(len(brands))]
		fabric := fabrics[rng.Intn(len(fabrics))]

		code := 700 + i
		title := fmt.Sprintf("شلوار %s %s مدل %s %d", pant.persian, g.persian, style.persian, code)
		slug := fmt.Sprintf("shalvar-%s-%s-%s-%d", pant.english, g.english, style.english, code)

		// Price: base + jitter, rounded to 10,000 Toman.
		price := (pant.base + int64(rng.Intn(60))*10_000) / 10_000 * 10_000

		// ~35% of products carry a discount.
		var discount *int64
		if rng.Intn(100) < 35 {
			off := int64(5+rng.Intn(6)) * 5 // 5%..30% in 5% steps
			d := price * (100 - off) / 100 / 10_000 * 10_000
			if d > 0 && d < price {
				discount = &d
			}
		}

		shortDesc := fmt.Sprintf("شلوار %s %s با جنس %s، مناسب استفاده روزمره.", pant.persian, g.persian, fabric)
		description := strings.Join([]string{
			fmt.Sprintf("%s از برند %s با دوخت باکیفیت و جنس %s.", title, brand, fabric),
			"کمر فنری و قابلیت تنظیم، دوخت مقاوم درزها و رنگ‌بندی ثابت پس از شست‌وشو.",
			"مناسب استفاده روزمره، محل کار و مهمانی‌های غیررسمی.",
			"برای انتخاب سایز، اندازه دور کمر خود را با جدول سایزها مقایسه کنید.",
		}, "\n\n")

		isFeatured := rng.Intn(100) < 30
		ratingCount := 3 + rng.Intn(60)
		ratingAvg := 3.4 + rng.Float64()*1.6 // 3.4 .. 5.0
		soldCount := rng.Intn(400)

		// Variant sizes: a random subset of the audience's sizes.
		sizeCount := 3 + rng.Intn(3)
		chosenSizes := pickSizes(rng, g.sizes, sizeCount)
		// 1..2 colours per product.
		colorCount := 1 + rng.Intn(2)
		chosenColors := pickColors(rng, colorCount)

		var productID int64
		if err := tx.QueryRow(ctx, `
			INSERT INTO products (
				title, slug, short_desc, description, category_id, brand, gender, pant_type, fabric,
				price, discount_price, stock, sku, rating_avg, rating_count, sold_count,
				is_active, is_featured
			) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,$12,$13,$14,$15,TRUE,$16)
			RETURNING id`,
			title, slug, shortDesc, description, cats[g.catSlug].ID, brand, g.persian, pant.persian, fabric,
			price, discount, fmt.Sprintf("SS-%s-%04d", strings.ToUpper(pant.english), code),
			ratingAvg, ratingCount, soldCount, isFeatured,
		).Scan(&productID); err != nil {
			return fmt.Errorf("insert product %d: %w", i, err)
		}

		// ---- images ----
		for imgIdx := 0; imgIdx < 3; imgIdx++ {
			url := fmt.Sprintf("https://picsum.photos/seed/%s-%d/800/1000", slug, imgIdx)
			if _, err := tx.Exec(ctx, `
				INSERT INTO product_images (product_id, url, alt, is_primary, sort_order)
				VALUES ($1, $2, $3, $4, $5)`,
				productID, url, fmt.Sprintf("%s — تصویر %d", title, imgIdx+1), imgIdx == 0, imgIdx,
			); err != nil {
				return err
			}
		}

		// ---- variants ----
		totalStock := int32(0)
		for _, size := range chosenSizes {
			for _, color := range chosenColors {
				stock := int32(rng.Intn(12))
				// A few variants are deliberately sold out.
				if rng.Intn(100) < 12 {
					stock = 0
				}
				totalStock += stock
				if _, err := tx.Exec(ctx, `
					INSERT INTO product_variants (product_id, size, color, color_hex, stock, sku, extra_price)
					VALUES ($1, $2, $3, $4, $5, $6, 0)
					ON CONFLICT (product_id, size, color) DO NOTHING`,
					productID, size, color.name, color.hex, stock,
					fmt.Sprintf("SS-%d-%s-%s", code, size, strings.ReplaceAll(color.name, " ", "")),
				); err != nil {
					return err
				}
			}
		}

		// Product stock mirrors total variant stock.
		if _, err := tx.Exec(ctx, `UPDATE products SET stock = $2 WHERE id = $1`, productID, totalStock); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}

// pickSizes returns n distinct sizes, preserving the natural order.
func pickSizes(rng *rand.Rand, sizes []string, n int) []string {
	if n > len(sizes) {
		n = len(sizes)
	}
	perm := rng.Perm(len(sizes))[:n]
	chosen := map[int]bool{}
	for _, idx := range perm {
		chosen[idx] = true
	}
	out := make([]string, 0, n)
	for i, s := range sizes {
		if chosen[i] {
			out = append(out, s)
		}
	}
	return out
}

// pickColors returns n distinct colour options.
func pickColors(rng *rand.Rand, n int) []struct {
	name string
	hex  string
} {
	if n > len(colors) {
		n = len(colors)
	}
	perm := rng.Perm(len(colors))[:n]
	out := make([]struct {
		name string
		hex  string
	}, 0, n)
	for _, idx := range perm {
		out = append(out, colors[idx])
	}
	return out
}
