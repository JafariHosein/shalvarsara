package service

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"unicode"

	"github.com/shalvarsara/backend/internal/model"
	"github.com/shalvarsara/backend/internal/repository"
)

const (
	adminPageSize    = 20
	adminMaxPageSize = 100
)

// AdminService owns the rules of the management panel: what a product may look
// like, which status changes are legal, and who may be locked out of the panel.
type AdminService struct {
	products   *repository.ProductRepository
	categories *repository.CategoryRepository
	orders     *repository.OrderRepository
	users      *repository.UserRepository
	coupons    *repository.CouponRepository
	stats      *repository.StatsRepository
	payments   *repository.PaymentRepository
	reviews    *repository.ReviewRepository
}

// NewAdminService wires the admin service.
func NewAdminService(
	products *repository.ProductRepository,
	categories *repository.CategoryRepository,
	orders *repository.OrderRepository,
	users *repository.UserRepository,
	coupons *repository.CouponRepository,
	stats *repository.StatsRepository,
	payments *repository.PaymentRepository,
	reviews *repository.ReviewRepository,
) *AdminService {
	return &AdminService{
		products:   products,
		categories: categories,
		orders:     orders,
		users:      users,
		coupons:    coupons,
		stats:      stats,
		payments:   payments,
		reviews:    reviews,
	}
}

// normalize admin paging for the wider tables.
func normalizeAdminPaging(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = adminPageSize
	}
	if limit > adminMaxPageSize {
		limit = adminMaxPageSize
	}
	return page, limit
}

// badInput is a validation failure with a message the admin can act on.
func badInput(text string) error {
	return &model.UserFacingError{Err: model.ErrValidation, Text: text}
}

// ---------- reviews ----------

// ListReviews returns a page of reviews for the moderation table.
func (s *AdminService) ListReviews(
	ctx context.Context, f model.AdminReviewFilter,
) (model.Page[model.AdminReviewRow], error) {
	f.Page, f.Limit = normalizeAdminPaging(f.Page, f.Limit)
	rows, total, err := s.reviews.AdminList(ctx, f)
	if err != nil {
		return model.Page[model.AdminReviewRow]{}, err
	}
	return model.NewPage(rows, f.Page, f.Limit, total), nil
}

// SetReviewStatus records a moderation decision. The repository refreshes the
// product's public rating in the same transaction, so approving a review cannot
// leave the stars stale.
func (s *AdminService) SetReviewStatus(ctx context.Context, id int64, status string) (*model.Review, error) {
	switch status {
	case "pending", "approved", "rejected":
	default:
		return nil, badInput("وضعیت نظر انتخابی معتبر نیست.")
	}
	return s.reviews.AdminSetStatus(ctx, id, status)
}

// translit maps Persian/Arabic letters and digits to Latin ones. Slugs are
// built from this so a Persian title still yields an ASCII, shareable URL —
// the same shape as the seeded catalogue ("shalvar-fabric-women-slim-fit-749").
var translit = map[rune]string{
	'ا': "a", 'آ': "a", 'أ': "a", 'إ': "a", 'ء': "", 'ئ': "y", 'ؤ': "o",
	'ب': "b", 'پ': "p", 'ت': "t", 'ث': "s", 'ج': "j", 'چ': "ch", 'ح': "h",
	'خ': "kh", 'د': "d", 'ذ': "z", 'ر': "r", 'ز': "z", 'ژ': "zh", 'س': "s",
	'ش': "sh", 'ص': "s", 'ض': "z", 'ط': "t", 'ظ': "z", 'ع': "a", 'غ': "gh",
	'ف': "f", 'ق': "gh", 'ک': "k", 'ك': "k", 'گ': "g", 'ل': "l", 'م': "m",
	'ن': "n", 'و': "v", 'ه': "h", 'ة': "h", 'ی': "y", 'ي': "y",
	'۰': "0", '۱': "1", '۲': "2", '۳': "3", '۴': "4",
	'۵': "5", '۶': "6", '۷': "7", '۸': "8", '۹': "9",
	'٠': "0", '١': "1", '٢': "2", '٣': "3", '٤': "4",
	'٥': "5", '٦': "6", '٧': "7", '٨': "8", '٩': "9",
}

// persianToLatin rewrites Persian script as Latin letters.
func persianToLatin(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		if latin, ok := translit[r]; ok {
			b.WriteString(latin)
			continue
		}
		if r == '\u200c' || r == '\u200f' || r == '\u200e' { // ZWNJ and friends
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// slugify turns a title into a URL-safe ASCII slug.
func slugify(s string) string {
	var b strings.Builder
	dash := false
	for _, r := range persianToLatin(strings.TrimSpace(s)) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			dash = false
		case r >= 'A' && r <= 'Z':
			b.WriteRune(unicode.ToLower(r))
			dash = false
		case r == '-' || r == '_' || unicode.IsSpace(r):
			if !dash && b.Len() > 0 {
				b.WriteRune('-')
				dash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

// uniqueSlug derives a free slug from `want` (or the title), suffixing -2, -3…
func (s *AdminService) uniqueSlug(ctx context.Context, title, want string, exceptID int64) (string, error) {
	base := slugify(want)
	if base == "" {
		base = slugify(title)
	}
	if base == "" {
		base = "shalvar"
	}
	if runes := []rune(base); len(runes) > 90 {
		base = strings.Trim(string(runes[:90]), "-")
	}

	slug := base
	for i := 2; i < 60; i++ {
		taken, err := s.products.ProductSlugTaken(ctx, slug, exceptID)
		if err != nil {
			return "", err
		}
		if !taken {
			return slug, nil
		}
		slug = base + "-" + strconv.Itoa(i)
	}
	return "", model.ErrConflict
}

// ---------- products ----------

// ListProducts returns a page of the catalogue including deactivated products.
func (s *AdminService) ListProducts(ctx context.Context, f model.ProductFilter) (model.Page[model.Product], error) {
	f.IncludeInactive = true
	f.Page, f.Limit = normalizeAdminPaging(f.Page, f.Limit)

	items, total, err := s.products.List(ctx, f)
	if err != nil {
		return model.Page[model.Product]{}, err
	}
	return model.NewPage(items, f.Page, f.Limit, total), nil
}

// GetProduct returns one product with its images and variants.
func (s *AdminService) GetProduct(ctx context.Context, id int64) (*model.Product, error) {
	return s.products.GetByID(ctx, id, true)
}

// CreateProduct validates and stores a new product.
func (s *AdminService) CreateProduct(ctx context.Context, in model.AdminProductInput) (*model.Product, error) {
	p := &model.Product{IsActive: true}
	if err := s.mergeProduct(ctx, p, in, 0, true); err != nil {
		return nil, err
	}
	if err := s.products.Create(ctx, p); err != nil {
		return nil, err
	}
	return s.products.GetByID(ctx, p.ID, true)
}

// UpdateProduct merges a partial input over the stored product.
func (s *AdminService) UpdateProduct(ctx context.Context, id int64, in model.AdminProductInput) (*model.Product, error) {
	cur, err := s.products.GetByID(ctx, id, true)
	if err != nil {
		return nil, err
	}
	next := *cur
	if err := s.mergeProduct(ctx, &next, in, id, false); err != nil {
		return nil, err
	}
	return s.products.Update(ctx, &next)
}

// DeleteProduct hides a product. Orders keep their snapshots, so history is
// unaffected.
func (s *AdminService) DeleteProduct(ctx context.Context, id int64) error {
	return s.products.SoftDelete(ctx, id)
}

// mergeProduct applies the non-nil fields of an input onto a product and checks
// the invariants the database would otherwise reject with a raw error.
func (s *AdminService) mergeProduct(ctx context.Context, p *model.Product, in model.AdminProductInput, exceptID int64, creating bool) error {
	if in.Title != nil {
		p.Title = strings.TrimSpace(*in.Title)
	}
	if in.ShortDesc != nil {
		p.ShortDesc = strings.TrimSpace(*in.ShortDesc)
	}
	if in.Description != nil {
		p.Description = strings.TrimSpace(*in.Description)
	}
	if in.Brand != nil {
		p.Brand = strings.TrimSpace(*in.Brand)
	}
	if in.Gender != nil {
		p.Gender = strings.TrimSpace(*in.Gender)
	}
	if in.PantType != nil {
		p.PantType = strings.TrimSpace(*in.PantType)
	}
	if in.Fabric != nil {
		p.Fabric = strings.TrimSpace(*in.Fabric)
	}
	if in.CategoryID != nil {
		p.CategoryID = *in.CategoryID
	}
	if in.Price != nil {
		p.Price = *in.Price
	}
	if in.Stock != nil {
		p.Stock = *in.Stock
	}
	if in.SKU != nil {
		p.SKU = strings.TrimSpace(*in.SKU)
	}
	if in.IsActive != nil {
		p.IsActive = *in.IsActive
	}
	if in.IsFeatured != nil {
		p.IsFeatured = *in.IsFeatured
	}

	// 0 clears the discount: a zero-Toman discount is not a discount.
	if in.DiscountPrice != nil {
		if *in.DiscountPrice <= 0 {
			p.DiscountPrice = nil
		} else {
			v := *in.DiscountPrice
			p.DiscountPrice = &v
		}
	}

	if p.Title == "" {
		return badInput("عنوان محصول را وارد کنید.")
	}
	if creating && p.CategoryID == 0 {
		return badInput("دسته‌بندی محصول را انتخاب کنید.")
	}
	if p.CategoryID != 0 {
		if _, err := s.categories.GetByID(ctx, p.CategoryID); err != nil {
			return badInput("دسته‌بندی انتخاب‌شده وجود ندارد.")
		}
	}
	if p.Price <= 0 {
		return badInput("قیمت محصول باید بیشتر از صفر باشد.")
	}
	if p.DiscountPrice != nil {
		if *p.DiscountPrice >= p.Price {
			return badInput("قیمت با تخفیف باید کمتر از قیمت اصلی باشد.")
		}
	}

	// The slug is only regenerated when asked for, so editing a title never
	// breaks a link that is already shared.
	want := model.Str(in.Slug, "")
	if want != "" || creating {
		slug, err := s.uniqueSlug(ctx, p.Title, want, exceptID)
		if err != nil {
			return err
		}
		p.Slug = slug
	}

	// Shipping weight of the rules above: keep the counts consistent.
	if p.Stock < 0 {
		return badInput("موجودی نمی‌تواند منفی باشد.")
	}
	return nil
}

// ---------- variants ----------

// CreateVariant adds a size/colour combination and returns the product.
//
// Size and Color are required here even though the input type makes them
// optional, because a create has no previous value to fall back on.
func (s *AdminService) CreateVariant(ctx context.Context, productID int64, in model.AdminVariantInput) (*model.Product, error) {
	if _, err := s.products.GetByID(ctx, productID, true); err != nil {
		return nil, err
	}
	size := derefString(in.Size)
	color := derefString(in.Color)
	if size == "" || color == "" {
		return nil, badInput("اندازه و رنگ واریانت الزامی است.")
	}
	stock := derefInt32(in.Stock)
	if stock < 0 {
		return nil, badInput("موجودی نمی‌تواند منفی باشد.")
	}
	v := &model.ProductVariant{
		ProductID:  productID,
		Size:       size,
		Color:      color,
		ColorHex:   colorHex(derefString(in.ColorHex)),
		Stock:      stock,
		SKU:        derefString(in.SKU),
		ExtraPrice: derefInt64(in.ExtraPrice),
	}
	if err := s.products.CreateVariant(ctx, v); err != nil {
		return nil, err
	}
	return s.products.GetByID(ctx, productID, true)
}

// UpdateVariant patches one variant and returns its product.
//
// Every field is optional: only what the caller actually sent is written, so a
// PATCH that flips one column cannot zero the others.
func (s *AdminService) UpdateVariant(ctx context.Context, id int64, in model.AdminVariantInput) (*model.Product, error) {
	v, err := s.variantProduct(ctx, id)
	if err != nil {
		return nil, err
	}

	if in.Size != nil {
		v.Size = strings.TrimSpace(*in.Size)
	}
	if in.Color != nil {
		v.Color = strings.TrimSpace(*in.Color)
	}
	if in.ColorHex != nil {
		v.ColorHex = colorHex(*in.ColorHex)
	}
	if in.Stock != nil {
		v.Stock = *in.Stock
	}
	if in.SKU != nil {
		v.SKU = strings.TrimSpace(*in.SKU)
	}
	if in.ExtraPrice != nil {
		v.ExtraPrice = *in.ExtraPrice
	}

	if v.Size == "" || v.Color == "" {
		return nil, badInput("اندازه و رنگ واریانت الزامی است.")
	}
	if v.Stock < 0 || v.ExtraPrice < 0 {
		return nil, badInput("موجودی و اختلاف قیمت نمی‌توانند منفی باشند.")
	}
	if _, err := s.products.UpdateVariant(ctx, v); err != nil {
		return nil, err
	}
	return s.products.GetByID(ctx, v.ProductID, true)
}

// derefString trims a pointer-to-string, treating nil as "".
func derefString(p *string) string {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

// derefInt32 reads a pointer-to-int32, treating nil as 0.
func derefInt32(p *int32) int32 {
	if p == nil {
		return 0
	}
	return *p
}

// derefInt64 reads a pointer-to-int64, treating nil as 0.
func derefInt64(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}

// DeleteVariant removes one variant.
func (s *AdminService) DeleteVariant(ctx context.Context, id int64) error {
	v, err := s.variantProduct(ctx, id)
	if err != nil {
		return err
	}
	if err := s.products.DeleteVariant(ctx, id); err != nil {
		return err
	}
	// Removing a variant changes what the product as a whole can sell, so the
	// aggregate has to be recomputed here too.
	return s.products.SyncProductStock(ctx, v.ProductID)
}

// variantProduct loads a variant so its product can be returned to the UI.
func (s *AdminService) variantProduct(ctx context.Context, variantID int64) (*model.ProductVariant, error) {
	return s.products.FindVariant(ctx, variantID)
}

// colorHex normalizes a colour swatch, defaulting to black.
func colorHex(raw string) string {
	h := strings.TrimSpace(raw)
	if h == "" {
		return "#000000"
	}
	if !strings.HasPrefix(h, "#") {
		h = "#" + h
	}
	if len(h) != 4 && len(h) != 7 && len(h) != 9 {
		return "#000000"
	}
	return h
}

// ---------- images ----------

// CreateImage appends a gallery image and returns the product.
//
// The URL is required here even though the input type makes it optional: a
// create has no previous address to keep.
func (s *AdminService) CreateImage(ctx context.Context, productID int64, in model.AdminImageInput) (*model.Product, error) {
	if _, err := s.products.GetByID(ctx, productID, true); err != nil {
		return nil, err
	}
	url, err := validateImageURL(derefString(in.URL))
	if err != nil {
		return nil, err
	}
	img := &model.ProductImage{
		ProductID: productID,
		URL:       url,
		Alt:       derefString(in.Alt),
		IsPrimary: in.IsPrimary != nil && *in.IsPrimary,
		SortOrder: derefInt32(in.SortOrder),
	}
	if err := s.products.CreateImage(ctx, img); err != nil {
		return nil, err
	}
	return s.products.GetByID(ctx, productID, true)
}

// UpdateImage patches one gallery image and returns its product.
//
// Only the fields the caller sent are written. `isPrimary` matters most: the
// image manager promotes an image with a one-field click, and treating an
// absent field as `false` would demote the very image being promoted.
func (s *AdminService) UpdateImage(ctx context.Context, id int64, in model.AdminImageInput) (*model.Product, error) {
	img, err := s.products.FindImage(ctx, id)
	if err != nil {
		return nil, err
	}
	if in.URL != nil {
		url, err := validateImageURL(*in.URL)
		if err != nil {
			return nil, err
		}
		img.URL = url
	}
	if img.URL == "" {
		return nil, badInput("نشانی تصویر را وارد کنید.")
	}
	if in.Alt != nil {
		img.Alt = strings.TrimSpace(*in.Alt)
	}
	if in.IsPrimary != nil {
		img.IsPrimary = *in.IsPrimary
	}
	if in.SortOrder != nil {
		img.SortOrder = *in.SortOrder
	}
	if _, err := s.products.UpdateImage(ctx, img); err != nil {
		return nil, err
	}
	return s.products.GetByID(ctx, img.ProductID, true)
}

// validateImageURL accepts the two shapes a gallery image may legitimately have:
// an absolute http(s) address, or a path rooted at the site ("/products/x.webp",
// which is how the seeded catalogue and the frontend's public directory are
// addressed). The validator tag cannot express this — it rejects the relative
// form outright — so an image that is already stored could never be re-saved.
func validateImageURL(raw string) (string, error) {
	u := strings.TrimSpace(raw)
	if u == "" {
		return "", badInput("نشانی تصویر را وارد کنید.")
	}
	if strings.HasPrefix(u, "/") {
		// Reject protocol-relative ("//evil.example/x.png"), which a browser
		// would otherwise resolve to another host.
		if strings.HasPrefix(u, "//") {
			return "", badInput("نشانی تصویر معتبر نیست.")
		}
		return u, nil
	}
	parsed, err := url.Parse(u)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", badInput("نشانی تصویر باید با http:// یا https:// شروع شود یا یک مسیر داخلی مانند /products/… باشد.")
	}
	return u, nil
}

// DeleteImage removes one image.
func (s *AdminService) DeleteImage(ctx context.Context, id int64) error {
	return s.products.DeleteImage(ctx, id)
}

// ---------- categories ----------

// CreateCategory adds a category.
func (s *AdminService) CreateCategory(ctx context.Context, in model.AdminCategoryInput) (*model.Category, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, badInput("نام دسته‌بندی الزامی است.")
	}
	slug, err := s.uniqueCategorySlug(ctx, name, in.Slug, 0)
	if err != nil {
		return nil, err
	}
	c := &model.Category{Name: name, Slug: slug, ParentID: in.ParentID, SortOrder: in.SortOrder}
	if err := s.categories.Create(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

// UpdateCategory rewrites a category.
func (s *AdminService) UpdateCategory(ctx context.Context, id int64, in model.AdminCategoryInput) (*model.Category, error) {
	cur, err := s.categories.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, badInput("نام دسته‌بندی الزامی است.")
	}
	if in.ParentID != nil && *in.ParentID == id {
		return nil, badInput("دسته‌بندی نمی‌تواند والد خودش باشد.")
	}
	slug, err := s.uniqueCategorySlug(ctx, name, in.Slug, id)
	if err != nil {
		return nil, err
	}
	cur.Name = name
	cur.Slug = slug
	cur.ParentID = in.ParentID
	cur.SortOrder = in.SortOrder
	return s.categories.Update(ctx, cur)
}

// DeleteCategory removes an empty category.
func (s *AdminService) DeleteCategory(ctx context.Context, id int64) error {
	return s.categories.Delete(ctx, id)
}

// uniqueCategorySlug derives a free category slug.
func (s *AdminService) uniqueCategorySlug(ctx context.Context, name, want string, exceptID int64) (string, error) {
	base := slugify(want)
	if base == "" {
		base = slugify(name)
	}
	if base == "" {
		base = "category"
	}
	slug := base
	for i := 2; i < 60; i++ {
		existing, err := s.categories.GetBySlug(ctx, slug)
		if err != nil {
			if err == model.ErrNotFound {
				return slug, nil
			}
			return "", err
		}
		if existing.ID == exceptID {
			return slug, nil
		}
		slug = base + "-" + strconv.Itoa(i)
	}
	return "", model.ErrConflict
}

// ---------- orders ----------

// ListOrders returns a page of every order.
func (s *AdminService) ListOrders(ctx context.Context, f model.AdminOrderFilter) (model.Page[model.AdminOrderSummary], error) {
	f.Page, f.Limit = normalizeAdminPaging(f.Page, f.Limit)
	items, total, err := s.orders.ListForAdmin(ctx, f)
	if err != nil {
		return model.Page[model.AdminOrderSummary]{}, err
	}
	return model.NewPage(items, f.Page, f.Limit, total), nil
}

// GetOrder returns one order with items, payment and shipment.
func (s *AdminService) GetOrder(ctx context.Context, id int64) (*model.Order, error) {
	return s.orders.GetForAdmin(ctx, id)
}

// ListPayments returns a page of gateway attempts for the transactions screen,
// newest first. Status is either one of the payment statuses or "all".
func (s *AdminService) ListPayments(ctx context.Context, f model.AdminPaymentFilter) (model.Page[model.AdminPaymentRow], error) {
	f.Page, f.Limit = normalizeAdminPaging(f.Page, f.Limit)
	items, total, err := s.payments.ListForAdmin(ctx, f)
	if err != nil {
		return model.Page[model.AdminPaymentRow]{}, err
	}
	return model.NewPage(items, f.Page, f.Limit, total), nil
}

// SetOrderStatus moves an order along the pipeline (rules live in the model).
func (s *AdminService) SetOrderStatus(ctx context.Context, id int64, status string) (*model.Order, error) {
	return s.orders.TransitionStatus(ctx, id, status)
}

// SaveShipment records the carrier and tracking code.
func (s *AdminService) SaveShipment(ctx context.Context, id int64, in model.AdminShipmentInput) (*model.Order, error) {
	carrier := strings.TrimSpace(in.Carrier)
	track := strings.TrimSpace(in.TrackingCode)
	if carrier == "" || track == "" {
		return nil, badInput("نام شرکت حمل و کد رهگیری الزامی است.")
	}
	in.Carrier = carrier
	in.TrackingCode = track
	return s.orders.UpsertShipment(ctx, id, in)
}

// ---------- users ----------

// ListUsers returns a page of accounts with their order totals.
func (s *AdminService) ListUsers(ctx context.Context, f model.AdminUserFilter) (model.Page[model.AdminUserRow], error) {
	f.Page, f.Limit = normalizeAdminPaging(f.Page, f.Limit)
	items, total, err := s.users.ListForAdmin(ctx, f)
	if err != nil {
		return model.Page[model.AdminUserRow]{}, err
	}
	return model.NewPage(items, f.Page, f.Limit, total), nil
}

// UpdateUser changes a user's role or access, refusing the changes that would
// leave the panel without an administrator.
func (s *AdminService) UpdateUser(ctx context.Context, actorID, id int64, in model.AdminUserInput) (*model.User, error) {
	target, err := s.users.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	if id == actorID {
		if in.IsActive != nil && !*in.IsActive {
			return nil, badInput("حساب خودتان را نمی‌توانید غیرفعال کنید.")
		}
		if in.Role != nil && *in.Role != model.RoleAdmin {
			return nil, badInput("نقش خودتان را نمی‌توانید تغییر دهید.")
		}
	}

	losingAdmin := target.Role == model.RoleAdmin
	if in.Role != nil && *in.Role == model.RoleAdmin {
		losingAdmin = false
	}
	if in.IsActive != nil && *in.IsActive {
		losingAdmin = false
	}
	if losingAdmin {
		admins, err := s.users.CountAdmins(ctx)
		if err != nil {
			return nil, err
		}
		if admins <= 1 {
			return nil, badInput("حداقل یک مدیر فعال باید باقی بماند.")
		}
	}

	return s.users.UpdateAccess(ctx, id, in)
}

// ---------- coupons ----------

// ListCoupons returns a page of discount codes.
func (s *AdminService) ListCoupons(ctx context.Context, query string, page, limit int) (model.Page[model.Coupon], error) {
	page, limit = normalizeAdminPaging(page, limit)
	items, total, err := s.coupons.ListCoupons(ctx, query, limit, (page-1)*limit)
	if err != nil {
		return model.Page[model.Coupon]{}, err
	}
	return model.NewPage(items, page, limit, total), nil
}

// CreateCoupon validates and stores a discount code.
func (s *AdminService) CreateCoupon(ctx context.Context, in model.AdminCouponInput) (*model.Coupon, error) {
	code := strings.ToUpper(strings.TrimSpace(model.Str(in.Code, "")))
	if code == "" {
		return nil, badInput("کد تخفیف الزامی است.")
	}
	kind := model.Str(in.Type, model.CouponPercent)
	amount := model.I64(in.Amount, 0)
	c := &model.Coupon{
		Code:      code,
		Type:      kind,
		Amount:    amount,
		MinOrder:  model.I64(in.MinOrder, 0),
		MaxUses:   model.I32(in.MaxUses, 0),
		ExpiresAt: in.ExpiresAt,
		IsActive:  model.Bool(in.IsActive, true),
	}
	if err := validateCoupon(c); err != nil {
		return nil, err
	}
	if err := s.coupons.CreateCoupon(ctx, c); err != nil {
		return nil, err
	}
	return c, nil
}

// UpdateCoupon merges a partial input over the stored coupon.
func (s *AdminService) UpdateCoupon(ctx context.Context, id int64, in model.AdminCouponInput) (*model.Coupon, error) {
	cur, err := s.coupons.GetCouponByID(ctx, id)
	if err != nil {
		return nil, err
	}
	next := *cur
	if in.Code != nil {
		next.Code = strings.ToUpper(strings.TrimSpace(*in.Code))
	}
	if in.Type != nil {
		next.Type = *in.Type
	}
	if in.Amount != nil {
		next.Amount = *in.Amount
	}
	if in.MinOrder != nil {
		next.MinOrder = *in.MinOrder
	}
	if in.MaxUses != nil {
		next.MaxUses = *in.MaxUses
	}
	if in.IsActive != nil {
		next.IsActive = *in.IsActive
	}
	if in.ClearExpiry {
		next.ExpiresAt = nil
	} else if in.ExpiresAt != nil {
		next.ExpiresAt = in.ExpiresAt
	}
	// The "cap already reached" rule belongs to changing the cap, not to every
	// edit. Checking it unconditionally made a fully redeemed code impossible to
	// even deactivate or rename — the panel refused everything but raising the
	// limit.
	if in.MaxUses != nil && *in.MaxUses > 0 && int32(*in.MaxUses) < cur.UsedCount {
		return nil, badInput(
			"سقف استفاده را نمی‌توان کمتر از تعداد استفاده‌شده (" +
				model.PersianDigits(int64(cur.UsedCount)) + ") کرد.")
	}
	if err := validateCoupon(&next); err != nil {
		return nil, err
	}
	// The update statement returns used_count as well, so the panel always sees
	// how many times a code has been redeemed.
	return s.coupons.UpdateCoupon(ctx, &next)
}

// validateCoupon enforces the invariants the checkout relies on.
func validateCoupon(c *model.Coupon) error {
	if c.Code == "" {
		return badInput("کد تخفیف الزامی است.")
	}
	switch c.Type {
	case model.CouponPercent:
		if c.Amount <= 0 || c.Amount > 100 {
			return badInput("درصد تخفیف باید بین ۱ تا ۱۰۰ باشد.")
		}
	case model.CouponFixed:
		if c.Amount <= 0 {
			return badInput("مبلغ تخفیف باید بیشتر از صفر باشد.")
		}
	default:
		return badInput("نوع تخفیف باید درصدی یا مبلغی باشد.")
	}
	if c.MinOrder < 0 || c.MaxUses < 0 {
		return badInput("حداقل خرید و سقف استفاده نمی‌توانند منفی باشند.")
	}
	return nil
}

// ---------- stats ----------

// Stats assembles the dashboard: counters, best sellers and the newest orders.
func (s *AdminService) Stats(ctx context.Context) (*model.AdminStats, error) {
	st, err := s.stats.Overview(ctx)
	if err != nil {
		return nil, err
	}

	coupons, err := s.coupons.CountActiveCoupons(ctx)
	if err != nil {
		return nil, err
	}
	st.Coupons = coupons

	top, err := s.stats.TopSellers(ctx, 8)
	if err != nil {
		return nil, err
	}
	st.TopSellers = top

	recent, _, err := s.orders.ListForAdmin(ctx, model.AdminOrderFilter{Limit: 6})
	if err != nil {
		return nil, err
	}
	st.RecentOrders = recent
	return st, nil
}
