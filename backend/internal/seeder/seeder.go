// Package seeder fills an empty database with realistic starting data: an
// admin account, demo customers, categories, coupons, 50 trousers, their
// reviews and one delivered order so the review flow can be tried out.
//
// Seeding is idempotent: users and categories are upserted, the catalogue is
// only generated when the products table is still empty, and the reviews and
// the delivered order are skipped once their own tables have data.
package seeder

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

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
	} else {
		if err := seedProducts(ctx, db, rng, categories); err != nil {
			return fmt.Errorf("seed products: %w", err)
		}
		log.Info().Int("products", productCount).Msg("catalogue seeded")
	}

	// Reviews and the delivered demo order build on the catalogue. Each of them
	// checks for its own data first, so a database seeded before they existed
	// picks them up on the next boot instead of needing a reset.
	deliveredProducts, err := seedDeliveredOrder(ctx, db, rng)
	if err != nil {
		return fmt.Errorf("seed delivered order: %w", err)
	}
	if err := seedReviews(ctx, db, rng, deliveredProducts); err != nil {
		return fmt.Errorf("seed reviews: %w", err)
	}
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

// seedColor is one colour option. The slug matches the file names of the
// product photography in frontend/public/products.
type seedColor struct {
	slug string
	name string
	hex  string
}

// imageView is one gallery slot: which shot of which colour photo to use, and
// the caption it gets.
type imageView struct {
	suffix string
	colour seedColor
	label  string
	photo  int
}

var colors = []seedColor{
	{"black", "مشکی", "#111827"},
	{"navy", "سرمه‌ای", "#1E3A8A"},
	{"lightblue", "آبی روشن", "#60A5FA"},
	{"gray", "خاکستری", "#6B7280"},
	{"beige", "بژ", "#D6C4A8"},
	{"olive", "زیتونی", "#4B5320"},
	{"brown", "قهوه‌ای", "#6B4226"},
	{"chocolate", "شکلاتی", "#4B2E2E"},
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
		primaryColor := chosenColors[0]

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
		// Product photography lives in frontend/public/products as
		// {pantType}-{colour}-{a|b|c}-{photo}.webp: a full-length shot, a
		// waistband/pocket detail and a hem detail, cut out on transparency so
		// the pictures sit on both the light and the dark theme.
		// Products sharing a type/colour pair alternate between the two photos.
		photo := int(productID%2) + 1
		other := 3 - photo
		views := []imageView{
			{"a", primaryColor, "نمای کامل", photo},
			{"b", primaryColor, "جزئیات کمر و جیب", photo},
		}
		if len(chosenColors) > 1 {
			views = append(views, imageView{"a", chosenColors[1], "نمای کامل", other})
		}
		views = append(views, imageView{"c", primaryColor, "دمپا و قد شلوار", photo})
		for imgIdx, view := range views {
			url := fmt.Sprintf("/products/%s-%s-%s-%d.webp", pant.english, view.colour.slug, view.suffix, view.photo)
			if _, err := tx.Exec(ctx, `
				INSERT INTO product_images (product_id, url, alt, is_primary, sort_order)
				VALUES ($1, $2, $3, $4, $5)`,
				productID, url,
				fmt.Sprintf("%s — %s، رنگ %s", title, view.label, view.colour.name),
				imgIdx == 0, imgIdx,
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
func pickColors(rng *rand.Rand, n int) []seedColor {
	if n > len(colors) {
		n = len(colors)
	}
	perm := rng.Perm(len(colors))[:n]
	out := make([]seedColor, 0, n)
	for _, idx := range perm {
		out = append(out, colors[idx])
	}
	return out
}

// --------------------------------------------------------------- reviews ----

// reviewAuthors are the extra demo customers whose names appear on the seeded
// reviews. They are ordinary customer accounts sharing the demo password; the
// storefront only ever shows a shortened name from them.
var reviewAuthors = []struct {
	name  string
	email string
	phone string
}{
	{"سارا محمدی", "customer2@example.com", "09121111112"},
	{"امیر رضایی", "customer3@example.com", "09121111113"},
	{"نگار کریمی", "customer4@example.com", "09121111114"},
	{"مهدی توکلی", "customer5@example.com", "09121111115"},
	{"الهام صادقی", "customer6@example.com", "09121111116"},
	{"رضا نجفی", "customer7@example.com", "09121111117"},
	{"مریم حیدری", "customer8@example.com", "09121111118"},
}

// reviewComments are deliberately product-agnostic, so one pool fits the whole
// catalogue instead of needing one set of lines per pant type.
var reviewComments = []string{
	"کیفیت دوخت و پارچه واقعاً خوبه، بعد از چند بار شست‌وشو هم رنگش نپرید.",
	"سایز رو دقیقاً مطابق جدول بگیرید؛ قد و دمپا همون چیزی بود که می‌خواستم.",
	"خوش‌دوخت و تمیزه، فقط کمی بلندتر از تصورم بود که خودم کوتاهش کردم.",
	"برای استفادهٔ روزمره عالیه؛ سبک و راحته و توی گرما هم اذیت نمی‌کنه.",
	"قیمت به‌نسبت کیفیت منصفانه‌ست، بسته‌بندی هم مرتب و بدون آسیب رسید.",
	"رنگش دقیقاً مثل عکسه؛ همون چیزی که می‌بینید به دستتون می‌رسه.",
	"کمرش خوب جا می‌افته و توی راه رفتن کش نمی‌کنه. خرید خوبی بود.",
	"مناسب محل کار و مهمونی؛ هم رسمی به نظر می‌رسه هم راحت.",
	"انتظار داشتم پارچه ضخیم‌تر باشه، ولی برای بهار و پاییز مناسبه.",
	"چند ماهه دارم استفاده می‌کنم و همچنان شکل و فرم اولش رو داره.",
	"ارسال سریع بود و سفارش سالم رسید؛ بابت پیگیری هم ممنون.",
	"راضی بودم، ولی اگه جیب‌ها کمی عمیق‌تر بود بهتر می‌شد.",
}

// seedDeliveredOrder gives the demo customer one delivered order, so the rule
// "only a verified buyer may rate" can be tried out without walking a real
// order through the whole pipeline. It returns the products in that order and
// does nothing once the customer already has a delivered order.
func seedDeliveredOrder(ctx context.Context, db *database.Pool, rng *rand.Rand) ([]int64, error) {
	var userID int64
	if err := db.QueryRow(ctx,
		`SELECT id FROM users WHERE email = 'customer@example.com'`).Scan(&userID); err != nil {
		return nil, err
	}

	var exists bool
	if err := db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM orders WHERE user_id = $1 AND status = 'delivered'
		)`, userID).Scan(&exists); err != nil {
		return nil, err
	}
	if exists {
		return []int64{}, nil
	}

	type line struct {
		productID int64
		title     string
		image     string
		label     string
		price     int64
	}

	rows, err := db.Query(ctx, `
		SELECT p.id, p.title, COALESCE(p.discount_price, p.price),
		       COALESCE((SELECT i.url FROM product_images i
		                 WHERE i.product_id = p.id
		                 ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1), ''),
		       COALESCE((SELECT v.size  FROM product_variants v
		                 WHERE v.product_id = p.id ORDER BY v.id LIMIT 1), ''),
		       COALESCE((SELECT v.color FROM product_variants v
		                 WHERE v.product_id = p.id ORDER BY v.id LIMIT 1), '')
		FROM products p
		WHERE p.is_active AND p.deleted_at IS NULL AND p.stock > 0
		ORDER BY p.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var catalogue []line
	for rows.Next() {
		var l line
		var size, colour string
		if err := rows.Scan(&l.productID, &l.title, &l.price, &l.image, &size, &colour); err != nil {
			return nil, err
		}
		l.label = variantLabel(size, colour)
		catalogue = append(catalogue, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(catalogue) < 2 {
		log.Warn().Msg("not enough products for a delivered demo order; skipping")
		return []int64{}, nil
	}

	// Two products, drawn from the whole catalogue so they are not always the
	// same first two.
	picked := make([]line, 0, 2)
	for len(picked) < 2 {
		l := catalogue[rng.Intn(len(catalogue))]
		duplicate := false
		for _, p := range picked {
			if p.productID == l.productID {
				duplicate = true
				break
			}
		}
		if !duplicate {
			picked = append(picked, l)
		}
	}
	orderProducts := make([]int64, 0, 2)
	subtotal := int64(0)
	for _, l := range picked {
		subtotal += l.price
		orderProducts = append(orderProducts, l.productID)
	}
	const shipping = 45000

	tx, err := db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback after commit is a no-op

	var orderID int64
	codePrefix := "SS-" + strconv.Itoa(model.JalaliYear(time.Now())) + "-"
	if err := tx.QueryRow(ctx, `
		INSERT INTO orders (
			code, user_id, status, subtotal, discount, shipping_cost, total,
			ship_receiver_name, ship_phone, ship_province, ship_city, ship_postal_code, ship_line1
		) VALUES (
			$1 || lpad(nextval('order_code_seq')::text, 6, '0'), $2, 'delivered',
			$3, 0, $4, $5, $6, $7, $8, $9, $10, $11
		) RETURNING id`,
		codePrefix, userID, subtotal, shipping, subtotal+shipping,
		"کاربر نمونه", "09121111111", "تهران", "تهران", "1234567890", "خیابان ولیعصر، پلاک ۱۲، واحد ۳",
	).Scan(&orderID); err != nil {
		return nil, err
	}

	for _, l := range picked {
		if _, err := tx.Exec(ctx, `
			INSERT INTO order_items (
				order_id, product_id, title, variant_label, image_url, unit_price, quantity
			) VALUES ($1, $2, $3, $4, $5, $6, 1)`,
			orderID, l.productID, l.title, l.label, l.image, l.price); err != nil {
			return nil, err
		}
	}

	// A verified payment, so the admin payment list has something to show for
	// the order. Amounts in the payments table are Rial.
	if _, err := tx.Exec(ctx, `
		INSERT INTO payments (order_id, gateway, authority, ref_id, amount, status, card_pan, message)
		VALUES ($1, 'zarinpal', $2, $3, $4, 'verified', '6037****1234', 'پرداخت موفق (دادهٔ نمونه)')`,
		orderID, "DEMO"+strconv.FormatInt(orderID, 10), strconv.FormatInt(1000000000+orderID, 10), (subtotal+shipping)*10,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	log.Info().Int64("order", orderID).Int("products", len(orderProducts)).Msg("delivered demo order ready")
	return orderProducts, nil
}

// seedReviews fills the product pages with plausible reviews and a short
// moderation queue, then derives every product's public rating from the reviews
// that are actually approved. It runs once: an existing review table is left
// alone.
func seedReviews(ctx context.Context, db *database.Pool, rng *rand.Rand, deliveredProducts []int64) error {
	var existing int64
	if err := db.QueryRow(ctx, `SELECT count(*) FROM reviews`).Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		log.Info().Int64("reviews", existing).Msg("reviews already present; skipping review seeding")
		return nil
	}

	// ---- authors ----
	var demoID int64
	if err := db.QueryRow(ctx,
		`SELECT id FROM users WHERE email = 'customer@example.com'`).Scan(&demoID); err != nil {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("Customer@12345"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	authors := []int64{demoID}
	for _, a := range reviewAuthors {
		var id int64
		if err := db.QueryRow(ctx, `
			INSERT INTO users (name, email, phone, password_hash, role)
			VALUES ($1, $2, $3, $4, 'customer')
			ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
			RETURNING id`, a.name, a.email, a.phone, string(hash)).Scan(&id); err != nil {
			return err
		}
		authors = append(authors, id)
	}

	// ---- the products to review ----
	rows, err := db.Query(ctx, `
		SELECT id FROM products
		WHERE is_active AND deleted_at IS NULL
		ORDER BY id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	var productIDs []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return err
		}
		productIDs = append(productIDs, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	// The demo customer stays a "clean" buyer for the products in their
	// delivered order, so the review form can be demonstrated on them.
	fresh := make(map[int64]bool, len(deliveredProducts))
	for _, id := range deliveredProducts {
		fresh[id] = true
	}

	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback after commit is a no-op

	approved, pending := 0, 0
	for _, productID := range productIDs {
		want := 2 + rng.Intn(4) // 2..5 reviews
		written := 0
		for _, idx := range rng.Perm(len(authors)) {
			if written >= want {
				break
			}
			authorID := authors[idx]
			if authorID == demoID && fresh[productID] {
				continue
			}
			// Roughly one in seven waits for moderation. The first review of a
			// product is always published, so a rated product keeps its stars.
			status := model.ReviewApproved
			if written > 0 && rng.Intn(7) == 0 {
				status = model.ReviewPending
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO reviews (product_id, user_id, rating, comment, status, created_at)
				VALUES ($1, $2, $3, $4, $5, now() - make_interval(days => $6))
				ON CONFLICT (product_id, user_id) DO NOTHING`,
				productID, authorID, weightedRating(rng),
				reviewComments[rng.Intn(len(reviewComments))], status, 1+rng.Intn(330),
			); err != nil {
				return err
			}
			written++
			if status == model.ReviewApproved {
				approved++
			} else {
				pending++
			}
		}
	}

	// ---- public ratings follow the published reviews ----
	if _, err := tx.Exec(ctx, `
		UPDATE products p SET
			rating_avg = COALESCE((
				SELECT ROUND(avg(r.rating), 2) FROM reviews r
				WHERE r.product_id = p.id AND r.status = 'approved'
			), 0),
			rating_count = (
				SELECT count(*) FROM reviews r
				WHERE r.product_id = p.id AND r.status = 'approved'
			)`); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	log.Info().Int("approved", approved).Int("pending", pending).Msg("reviews seeded")
	return nil
}

// weightedRating draws a rating the way a shop's reviews actually look: mostly
// four and five stars, with the occasional complaint.
func weightedRating(rng *rand.Rand) int32 {
	switch roll := rng.Intn(100); {
	case roll < 46:
		return 5
	case roll < 82:
		return 4
	case roll < 93:
		return 3
	case roll < 98:
		return 2
	default:
		return 1
	}
}

// variantLabel renders the size/colour pair stored on an order line, matching
// the labels the order service writes ("سایز ۳۲ · سرمه‌ای").
func variantLabel(size, colour string) string {
	parts := make([]string, 0, 2)
	if size != "" {
		parts = append(parts, "سایز "+size)
	}
	if colour != "" {
		parts = append(parts, colour)
	}
	return strings.Join(parts, " · ")
}
