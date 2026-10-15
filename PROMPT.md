# 🧾 پرامپت کامل پروژه: فروشگاه اینترنتی فروش شلوار

> این فایل را می‌توانی مستقیم به یک عامل کدنویس (OpenCode / Claude Code / Cursor و ...) بدهی.

## 🧠 مهارت‌های فعال (Skills)
پیش از شروع، این دو مهارت داخل `.opencode/skills/` موجودند و باید هنگام ساخت رابط کاربری از آن‌ها استفاده شود:

- **`frontend-design`** — هدایت طراحی بصری متمایز و غیرکلیشه‌ای (پالت، تایپوگرافی، چیدمان).
- **`shadcn-rtl`** — استانداردهای همین پروژه: shadcn/ui + Tailwind، تم آبی–سفید، دارک‌مود، قواعد RTL فارسی، توکن‌های رنگ، دستورپخت کامپوننت‌های فروشگاهی و قواعد اعداد/تاریخ/متن فارسی. (شاخه‌های `references/` را در جای لازم بخوان.)

## 🎯 هدف پروژه
یک فروشگاه اینترنتی کامل، مدرن و آماده‌ی استقرار (production-ready) بساز که **فقط شلوار** (انواع: جین، کتان، پارچه‌ای، اسلش، کارگو، بگ، اسکینی و...) می‌فروشد. حدود **۵۰ محصول اولیه** با داده‌های نمونه واقعی (Seed Data) به‌همراه تصاویر placeholder داشته باشد. رابط کاربری **فارسی و راست‌چین (RTL)** باشد، تم رنگی **سفید–آبی** داشته باشد و از **دارک‌مود** پشتیبانی کند.

---

## 🏗️ پشته فناوری (Tech Stack)

**فرانت‌اند**
- React 18+ با TypeScript و Vite
- shadcn/ui (روی Tailwind CSS) + Radix UI
- Tailwind CSS v3+ با تم سفارشی و متغیرهای CSS برای دارک‌مود
- React Router v6 برای مسیریابی
- TanStack Query (React Query) برای مدیریت داده و کش سمت سرور
- Zustand برای State مدیریت سبد خرید و UI
- react-hook-form + zod برای فرم‌ها و اعتبارسنجی
- lucide-react برای آیکون‌ها
- اعداد و مبلغ به فارسی با جداکننده هزارگان (مثلاً «۲۵۰٬۰۰۰ تومان»)

**بک‌اند**
- Go 1.22+ با معماری لایه‌ای تمیز (clean/layered architecture)
- Fiber یا Chi یا Echo (یکی را انتخاب کن و یکدست نگه دار) — پیشنهاد: **Fiber**
- pgx یا database/sql + sqlc برای کوئری‌های type-safe
- JWT برای احراز هویت (access + refresh token)
- bcrypt برای هش رمز عبور
- zmigration برای مایگریشن‌ها (یا goose)
- اعتبارسنجی با go-playground/validator
- ساختار پروژه: `cmd/`, `internal/{handler,service,repository,model,middleware,config}`, `pkg/`

**دیتابیس**
- PostgreSQL 15+
- مایگریشن‌ها + فایل Seed برای ۵۰ محصول

**زیرساخت**
- Docker + docker-compose (سرویس‌های: postgres, backend, frontend)
- فایل `.env.example` برای همه‌ی متغیرها
- Makefile برای دستورات رایج (run, migrate, seed, build)
- README کامل به فارسی/انگلیسی با دستورات راه‌اندازی

---

## 🎨 سیستم طراحی

**رنگ‌ها (تم سفید–آبی)**
- رنگ اصلی (Primary): آبی `#2563EB` (آبی ۶۰۰)
- رنگ ثانویه: آبی روشن `#3B82F6`
- پس‌زمینه روشن: سفید / خاکستری بسیار روشن `#F8FAFC`
- پس‌زمینه دارک: `#0B1220` / `#111827`
- متن اصلی، متن ثانویه، border و ring هم در دو حالت تعریف شوند
- تمام رنگ‌ها به‌صورت **CSS Variables** در `:root` و `.dark` تعریف شوند تا دارک‌مود با کلاس `dark` روی `<html>` کار کند

**تایپوگرافی و RTL**
- فونت فارسی: **Vazirmatn** (self-host یا Google Fonts)
- `dir="rtl"` و `lang="fa"` سراسری
- فاصله‌گذاری، سایه‌ها، گردی گوشه‌ها (radius) و انیمیشن‌های نرم و مدرن

**کامپوننت‌های پایه shadcn**
Button, Card, Input, Label, Select, Dialog, Sheet, DropdownMenu, Tabs, Badge, Toast/Sonner, Skeleton, Tooltip, Accordion, Table, Pagination, AlertDialog, Switch, Textarea, Avatar, Separator

**کیفیت UI**
- کاملاً ریسپانسیو (موبایل، تبلت، دسکتاپ)
- حالت‌های Loading (Skeleton)، Empty، و Error برای همه‌ی لیست‌ها
- انیمیشن‌های ظریف (fade/slide) و بازخورد کاربری واضح

---

## 🗄️ اسکیمای دیتابیس (حداقل جداول)

- `users` — id, name, email(unique), phone, password_hash, role(`customer`/`admin`), created_at
- `addresses` — id, user_id, province, city, postal_code, line1, receiver_name, phone, is_default
- `categories` — id, name, slug, parent_id(nullable)
- `products` — id, title, slug, description, category_id, brand, price, discount_price, stock, sku, is_active, created_at
- `product_images` — id, product_id, url, alt, is_primary, sort_order
- `product_variants` — id, product_id, size(۳۰..۴۶ / S..XXL), color, waist, stock, sku, extra_price
- `reviews` — id, product_id, user_id, rating(1..5), comment, status(`pending`/`approved`), created_at
- `carts` / `cart_items` — برای مهمان و کاربر لاگین‌شده (session یا user)
- `wishlists` — user_id, product_id
- `coupons` — code, type(`percent`/`fixed`), amount, min_order, max_uses, expires_at, is_active
- `orders` — id, user_id, address_id, status(`pending`/`paid`/`processing`/`shipped`/`delivered`/`canceled`), subtotal, discount, shipping_cost, total, coupon_id, created_at
- `order_items` — order_id, product_id, variant_id, title, unit_price, quantity
- `payments` — id, order_id, gateway(`zarinpal`), authority, ref_id, amount, status(`initiated`/`verified`/`failed`), created_at
- `shipments` — order_id, tracking_code, carrier, status, shipped_at

ایندکس روی `slug`, `email`, `order_id`, و کلیدهای خارجی. از `soft delete` برای محصولات در صورت لزوم استفاده کن.

---

## 🔌 API بک‌اند (REST، پیشوند `/api/v1`)

**احراز هویت**
- `POST /auth/register` — ثبت‌نام
- `POST /auth/login` — ورود (برگرداندن access + refresh توکن)
- `POST /auth/refresh` — تمدید توکن
- `POST /auth/logout`
- `GET /auth/me` — پروفایل کاربر جاری
- احراز هویت با **JWT**، هش با **bcrypt**، middleware محافظت از مسیرهای خصوصی و نقش `admin`

**محصولات**
- `GET /products` — لیست با فیلترها: `q`, `category`, `size`, `color`, `min_price`, `max_price`, `in_stock`, `sort`, `page`, `limit`
- `GET /products/:slug` — جزئیات + تصاویر + واریانت‌ها + امتیاز میانگین
- `GET /products/:slug/related` — محصولات مشابه
- `GET /categories`
- `GET /search/suggest` — پیشنهاد جستجو

**سبد خرید و علاقه‌مندی‌ها**
- `GET/POST/PATCH/DELETE /cart` و `/cart/items`
- `GET/POST/DELETE /wishlist`

**سفارش و پرداخت**
- `POST /orders` — ایجاد سفارش از سبد (اعتبارسنجی موجودی و مبلغ)
- `GET /orders` و `GET /orders/:id` — فقط سفارش‌های خود کاربر
- `POST /payments/zarinpal/request` — درخواست پرداخت، دریافت `authority` و لینک
- `GET /payments/zarinpal/callback` — تأیید (Verify) با ZarinPal و به‌روزرسانی وضعیت سفارش
- **پیاده‌سازی درست زرین‌پال**: `PaymentRequest` → ریدایرکت به `https://www.zarinpal.com/pg/StartPay/{authority}` → کالبک → `PaymentVerification` با `merchant_id` و `amount` (به ریال) → ذخیره `ref_id`. مدیریت کامل خطاها و کاهش/برگرداندن موجودی در صورت شکست.

**پروفایل**
- `GET/PATCH /users/me`، مدیریت آدرس‌ها `GET/POST/PATCH/DELETE /addresses`

**نظرات**
- `POST /products/:id/reviews` (کاربر لاگین)، فقط پس از خرید یا با وضعیت `pending` برای تأیید

**پنل ادمین (نقش `admin`)**
- `GET /admin/stats` — درآمد، تعداد سفارش، محصولات کم‌موجود، نمودار فروش
- CRUD کامل: `/admin/products`, `/admin/categories`, `/admin/coupons`, `/admin/orders` (تغییر وضعیت + ثبت کد رهگیری), `/admin/reviews` (تأیید/رد), `/admin/users`

**عمومی**
- Pagination استاندارد، فیلترها، مرتب‌سازی، و پاسخ‌های خطای یکدست (`{ error: { code, message } }`)
- مستندات Swagger/OpenAPI تولید شده

---

## 🖥️ صفحات و مسیرهای فرانت‌اند

**فروشگاه (کاربر)**
- `/` صفحه اصلی: Hero آبی، دسته‌بندی‌ها، محصولات ویژه/تخفیف‌دار، پرفروش‌ها، بنر تخفیف
- `/products` لیست محصولات با نوار کنار فیلتر (دسته، سایز، رنگ، قیمت، موجودی) + جستجو + مرتب‌سازی + صفحه‌بندی
- `/products/:slug` جزئیات: گالری تصاویر، انتخاب سایز/رنگ، موجودی، افزودن به سبد/علاقه‌مندی، مشخصات، نظرات و امتیاز، محصولات مشابه
- `/cart` سبد خرید با ویرایش تعداد، حذف، اعمال کد تخفیف، جمع مبلغ
- `/checkout` مراحل تسویه: انتخاب/افزودن آدرس، انتخاب روش ارسال، خلاصه سفارش، پرداخت
- `/payment/result` نتیجه پرداخت (موفق/ناموفق) با شماره سفارش و پیگیری
- `/login` و `/register`
- `/dashboard` پنل کاربر: سفارش‌ها، جزئیات سفارش، آدرس‌ها، علاقه‌مندی‌ها، اطلاعات حساب
- `/wishlist`

**ادمین**
- `/admin` داشبورد با KPI و نمودار
- `/admin/products` (لیست/افزودن/ویرایش/حذف + آپلود تصویر)
- `/admin/categories`, `/admin/orders`, `/admin/coupons`, `/admin/reviews`, `/admin/users`

**عمومی**
- Header با لوگو، منوی دسته‌بندی، جستجوی زنده، سوییچ دارک‌مود، آیکون سبد با badge، پروفایل
- Footer با لینک‌ها، تماس، شبکه‌های اجتماعی، نماد اعتماد
- صفحه 404، صفحه قوانین/درباره/تماس با ما

---

## ⚙️ قابلیت‌های کلیدی (چک‌لیست)
- [x] ثبت‌نام/ورود با ایمیل و رمز + mobile drawer
- [x] سبد خرید مهمان که پس از ورود به حساب کاربر منتقل می‌شود
- [x] جستجو + فیلترینگ چندمعیاره + مرتب‌سازی + صفحه‌بندی
- [x] علاقه‌مندی‌ها (Wishlist)
- [x] کد تخفیف (Coupon) در سبد خرید
- [x] پرداخت آنلاین با **زرین‌پال** (Sandbox قابل تنظیم با env)
- [x] مدیریت موجودی و کاهش خودکار پس از خرید
- [x] نظرات و امتیازدهی کاربران
- [x] داشبورد مدیریت کامل
- [x] دارک‌مود + تم سفید–آبی
- [x] RTL و فارسی‌سازی کامل

---

## 🔐 امنیت و کیفیت
- هش bcrypt، JWT با انقضای مناسب، refresh token امن
- محافظت از مسیرهای ادمین و مالکیت منابع (کاربر فقط داده‌ی خودش)
- Rate limiting روی مسیرهای auth و پرداخت
- اعتبارسنجی کامل ورودی‌ها در بک‌اند و فرانت‌اند (zod + validator)
- جلوگیری از SQL Injection (پارامتریک) و XSS
- مدیریت CORS و متغیرهای محیطی (هیچ سکرتی در کد هاردکد نشود)
- لاگ ساخت‌یافته (structured logging) و مدیریت graceful خطاها
- تست: unit test برای سرویس‌های حیاتی (auth, order, payment) + چند integration test

---

## 📦 خروجی مورد انتظار
1. ریپوی مونو با پوشه‌های `frontend/` و `backend/` و `docker-compose.yml`
2. مایگریشن‌ها + Seed با **۵۰ محصول شلوار واقعی** (عنوان، توضیح فارسی، قیمت، سایز، رنگ، دسته، تصویر placeholder)
3. `.env.example` برای فرانت و بک
4. `README.md` با دستورات: `docker compose up`, `make migrate`, `make seed`, `make dev`
5. داده‌ی نمونه: یک کاربر ادمین (`admin@example.com` / رمز مشخص) و یک کاربر عادی
6. کد تمیز، کامنت‌گذاری‌شده در بخش‌های حساس، و بدون خطای build

---

## ✅ معیارهای پذیرش
- پروژه با یک دستور `docker compose up` بالا می‌آید و سایت کار می‌کند
- می‌توان محصول را مرور، جستجو، فیلتر، به سبد افزود و خرید کرد
- پرداخت زرین‌پال در حالت Sandbox کامل تا صفحه نتیجه و ثبت سفارش کار می‌کند
- ادمین می‌تواند محصول اضافه/ویرایش کند و وضعیت سفارش‌ها را مدیریت کند
- دارک‌مود و تم آبی–سفید در همه‌ی صفحات درست کار می‌کند و کاملاً ریسپانسیو و RTL است
- هیچ خطای کنسول/سِرور در مسیرهای اصلی وجود ندارد

---

**نکته‌ی مهم:** از من نخواه «همه را یکجا» بسازی؛ پیشنهاد می‌کنم پروژه را فازبندی کنی (۱: اسکلت + DB + Auth، ۲: محصولات و فروشگاه، ۳: سبد و پرداخت، ۴: ادمین و تکمیل) و در هر فاز build را تست کنی.
