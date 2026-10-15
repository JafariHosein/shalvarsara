# شلوارسرا — سند وضعیت و ادامهٔ کار

> **این فایل را قبل از هر کاری بخوان.** هدفش این است که اگر کانتکست پاک شد،
> عامل بعدی (یا خودم در نشست بعدی) دقیقاً بداند چه چیزی ساخته شده،
> چه چیزی تأیید شده، و قدم بعدی چیست.
>
> آخرین به‌روزرسانی: **بستهٔ درخواست کارفرما (پشتیبانی، قیمت‌ها، صفحه‌بندی،
> تراکنش‌ها، نقشهٔ آدرس و محتوای صفحات)** انجام و در مرورگر تأیید شد: کادر
> پشتیبانی چسبیده به **پایین-چپ**، «تومان» + جداکنندهٔ سه‌رقمی روی همهٔ
> قیمت‌ها (حتی ورودی‌های پنل)، صفحه‌بندی شماره‌دار با «نمایش ۱–۱۲ از ۵۱
> محصول»، صفحهٔ **تراکنش‌ها** در پنل، بخش **پنل پیامکی (به‌زودی)**، **نقشهٔ
> انتخاب موقعیت** روی فرم آدرس و محتواسازی خانه/محصول با مهارت
> `make-interfaces-feel-better` (بخش ۶ را ببینید).
> پیش از آن: فاز ۴، بستهٔ بازبینی UI و ثبت‌نام با کد پیامکی کامل شده بودند.
> بک‌اند و فرانت‌اند هر دو پاک (`build`/`vet`/`gofmt`/`typecheck`).
> فاز بعدی: **فاز ۵ — نظرات و علاقه‌مندی‌ها**.

---

## ۱) شناسنامهٔ پروژه

| مورد | مقدار |
|---|---|
| نام برند | **شلوارسرا** |
| اسلاگ | `shalvarsara` |
| ماژول Go | `github.com/shalvarsara/backend` |
| حوزهٔ کسب‌وکار | فروشگاه اینترنتی **فقط شلوار** (جین، پارچه‌ای، کتان، کارگو، بگی، فیت، اسکینی، بچگانه) |
| تعداد محصولات seed | **۵۰** محصول |
| معماری | فرانتاند SPA + API جدا (بدون SSR) |
| زبان UI | فارسی، RTL کامل |
| تم | سفید/آبی + حالت تاریک |

### پشتهٔ فنی (قطعی‌شده — تغییر ندهید مگر با دلیل)

**بک‌اند**
- Go 1.27 — Fiber v2
- PostgreSQL 16 — `pgx/v5` + `pgxpool`
- JWT (access + refresh) با `golang-jwt/v5` — bcrypt برای رمز
- `go-playground/validator` برای اعتبارسنجی
- `zerolog` برای لاگ، `godotenv` برای env
- مهاجرت‌های **embed شده** با قفل `pg_advisory_lock` (بدون باینری بیرونی)

**فرانت‌اند**
- React 18 + Vite 5 + TypeScript
- Tailwind CSS **v3.4** (نه v4) با توکن‌های HSL کلاسیک shadcn
- shadcn/ui (۲۶ کامپوننت primitive در `src/components/ui`)
- TanStack Query v5 (state سرور) + Zustand v4 با `persist` (state کلاینت)
- react-hook-form + zod برای فرم‌ها
- ورق‌زدن: `clsx` + `tailwind-merge`؛ Toast: `sonner`

**پول:** در دیتابیس و API همه‌جا **عدد صحیح تومان** است.
تبدیل به ریال (×۱۰) **فقط** در مرز زرین‌پال و در **یک ثابت** انجام می‌شود
(`rialPerToman` در `internal/service/payment.go`)؛ هیچ‌جای دیگری ×۱۰ نزنید.

---

## ۲) محیط این سیستم (بخشد — حتماً بخوانید)

این سیستم ویندوز است و چند نکتهٔ خاص دارد که هر بار وقت زیادی گرفت:

### الف) ترمینال و اجرای دستورها

```powershell
# go روی PATH ارثی نیست — همیشه پیشوند بزن:
$env:Path = "C:\Program Files\Go\bin;" + $env:Path

# npm در PowerShell بلاک است — با cmd اجرا کن:
cmd /c "npm install"
cmd /c "npm run build"

# فایل‌های .ps1 که متن فارسی دارند باید UTF-8 با BOM ذخیره شوند
# وگرنه PowerShell 5.1 آن‌ها را ANSI می‌خواند و خطای Unexpected token می‌دهد:
[IO.File]::WriteAllText($path, $content, (New-Object System.Text.UTF8Encoding $true))

# خروجی کنسول برای متن فارسی mojibake نشان می‌دهد؛ داده سالم است.
# برای بازبینی درست، خروجی را در فایل بنویس و با ابزار read بخوان.
```

### ب) شبکه — دو تلهٔ واقعی

**۱) `localhost` روی این سیستم اول به `::1` (IPv6) حل می‌شود.**
سرور Go فقط روی IPv4 گوش می‌دهد (`127.0.0.1:8080` ✅ / `::1:8080` ❌).
بنابراین هر جا آدرس می‌دهید، **صریحاً `127.0.0.1`** بنویسید.
- `frontend/vite.config.ts` → پروکسی روی `http://127.0.0.1:8080` تنظیم شده ✅
- `CORS_ORIGINS` شامل هر دو حالت `localhost` و `127.0.0.1` است ✅
- PostgreSQL روی `::` گوش می‌دهد، پس DSN با `localhost` کار می‌کند.

**۲) Windscribe (VPN) نصب و در حال اجراست.**
- تنظیمات فعلی: `ProxyEnable=0`، `ProxyServer=127.0.0.1:10808`،
  bypass شامل `<local>;localhost;127.*`، و `NO_PROXY=127.0.0.1,localhost,::1`
- یعنی **در حال حاضر روی localhost اثری ندارد**، ولی چون روشن/خاموش می‌شود
  ممکن است گاهی نوسان لحظه‌ای ایجاد کند. اگر اتصال‌های عجیب دیدید، اول این را چک کنید:
```powershell
netsh winhttp show proxy
Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" |
  Select-Object ProxyEnable, ProxyServer, ProxyOverride
```

### ج) Docker کار نمی‌کند

Docker Desktop نصب شده اما **WSL2 نصب نیست**، پس دیمن بالا نمی‌آید
(خطای `dockerDesktopLinuxEngine`). فعال‌سازی WSL2 نیازمند دسترسی ادمین و ری‌استارت است.

➡️ **راه‌حل انتخاب‌شده:** PostgreSQL 16 بومی روی ویندوز.

```
سرویس ویندوز : postgresql-x64-16  (Running / Automatic)
پورت         : 5432
data dir     : C:\Program Files\PostgreSQL\16\data
```

`docker-compose.yml` نوشته شده و برای **دیپلوی روی سرور** نگه داشته می‌شود،
اما در این سیستم تست نشده است.

### د) ابزار مرورگر (OpenCode browser)

- تب‌ها **بین دو فراخوانی `execute` ممکن است از بین بروند** → همهٔ مراحل
  یک صفحه را داخل **یک** فراخوانی `execute` انجام بده.
- امضای دقیق پارامترها (اشتباه در نام کلید، خطای validation می‌دهد):
  - `browser.wait({ tabID, condition: "load" | "text" | "textGone", text?, timeoutMs? })`
  - `browser.evaluate({ tabID, script })` ← کلید `script` است نه `expression`
  - `browser.network.get({ tabID, id })` ← کلید `id` است نه `requestID`
  - `browser.snapshot({ tabID, depth })` ← `depth` حداکثر **۲۰**
- `browser.screenshot({ tabID, fullPage?, ref?, format?, quality?, maxWidth? })`
  **کار می‌کند** (تصور «اسکرین‌شات ممکن نیست» غلط بود) ولی تب باید فوکوس‌شده و
  پنجره قابل‌مشاهده باشد: اول `browser.tabs.focus({ tabID })` بعد اسکرین‌شات.
  `maxWidth` فقط کوچک می‌کند؛ برای بزرگ‌نمایی موقت، `document.body.style.zoom`
  (توجه: `zoom` عرض layout را عوض می‌کند ولی media queryها را نه).
- 🔴 **تلهٔ واقعی این محیط:** کانکتور مرورگر روی **موج درخواست‌های موازی**
  `502 Bad Gateway` می‌دهد. هر سند تازهٔ SPA (~۱۰۰ ماژول با `?t=`/`?v=`)
  شانسی بالا می‌آید و اگر باخت، `#root` خالی می‌ماند و **رفرش هم کمکی نمی‌کند
  چون همان موج تکرار می‌شود**. درخواست‌های سری (۴ تا با ۴۰۰ms فاصله) همیشه
  ۲۰۰ می‌دهند. پس برای تست صفحه‌های تازه/ریسپانسیو از هارنس CDP (بخش ۷)
  استفاده کن، نه iframe.
- صفحه‌های lazy-loaded بلافاصله رندر نمی‌شوند؛ قبل از snapshot
  با `wait(condition:"text")` منتظر یک متن شناخته‌شده بمان.

---

## ۳) اجرای پروژه (کپی-پیست)

پیش‌نیاز: سرویس PostgreSQL در حال اجرا + `.env`ها ساخته‌شده.

```powershell
# --- بار اول ---
$env:Path = "C:\Program Files\Go\bin;" + $env:Path
powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1   # نقش/دیتابیس/pg_trgm
cd "D:\Projects\E-Commerce Website\backend"; go run ./cmd/seed  # مهاجرت + ۵۰ محصول

# --- اجرای روزمره (دو پنجرهٔ جدا) ---
cd "D:\Projects\E-Commerce Website\backend"
$env:Path = "C:\Program Files\Go\bin;" + $env:Path
go run ./cmd/api            # → http://127.0.0.1:8080

cd "D:\Projects\E-Commerce Website\frontend"
cmd /c "npm run dev"        # → http://localhost:5173
```

دستورهای دیگر:

```powershell
cd backend;  go run ./cmd/migrate    # فقط مهاجرت
cd backend;  go run ./cmd/seed       # مهاجرت + seed (idempotent)
cd backend;  go build ./... ; go vet ./...
cd frontend; cmd /c "npm run build"  # tsc --noEmit + vite build
cd frontend; cmd /c "npm run typecheck"
```

> `make` روی این سیستم نصب نیست. اهداف Makefile معادل دستورهای بالا هستند.

---

## ۴) دسترسی‌ها و کلیدها

```
# پایگاه داده
DSN          : postgres://shalvarsara:shalvarsara@localhost:5432/shalvarsara?sslmode=disable
سوپریوزر     : postgres / postgres
نقش اپ       : shalvarsara / shalvarsara (superuser)

# حساب‌های نمونه
مدیر   : admin@example.com    / Admin@12345
مشتری  : customer@example.com / Customer@12345

# کوپن‌های seed شده
WELCOME10   و   OFF50000
```

متغیرهای محیطی مهم در `backend/.env`:

| کلید | مقدار پیش‌فرض |
|---|---|
| `APP_ENV` | `development` |
| `HTTP_PORT` | `8080` |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173` |
| `JWT_ACCESS_TTL` | `15m` |
| `JWT_REFRESH_TTL` | `720h` (۳۰ روز) |
| `RUN_MIGRATIONS` | `true` |
| `SEED_ON_START` | `false` |
| `ZARINPAL_SANDBOX` | `true` |
| `ZARINPAL_MERCHANT_ID` | placeholder — **باید جایگزین شود** |
| `ZARINPAL_CALLBACK_URL` | `http://localhost:5173/payment/callback` |
| `ZARINPAL_RESULT_URL` | `http://localhost:5173/payment/result` |

> ⚠️ سرور API که الان در حال اجراست با مقدار **قدیمی** `CORS_ORIGINS` بالا آمده.
> در حالت توسعه اهمیت ندارد (همه‌چیز از پروکسی Vite می‌رود و same-origin است)،
> ولی برای اعمال مقدار جدید یک بار API را ری‌استارت کنید.

---

## ۵) ساختار پروژه

```
E-Commerce Website/
├── PROMPT.md                 # شرح خواسته‌های اصلی پروژه
├── PROGRESS.md               # ← همین فایل
├── README.md                 # مستندات فارسی کاربردی (نصب/اجرا/عیب‌یابی)
├── Makefile                  # دستورهای پرکاربرد (make نصب نیست)
├── docker-compose.yml        # db + backend + frontend (روی این سیستم اجرا نشد)
├── .env.example
├── scripts/dev-db.ps1        # ساخت نقش/دیتابیس/pg_trgm روی PostgreSQL بومی
├── .opencode/skills/         # دو اسکیل نصب‌شدهٔ پروژه
└── backend/  frontend/
```

### بک‌اند — فهرست کامل فایل‌ها

```
cmd/api/main.go                 نقطهٔ ورود API
cmd/migrate/main.go             مهاجرت مستقل (make migrate)
cmd/seed/main.go                مهاجرت + seed (make seed)
migrations/embed.go             جاسازی فایل‌های SQL
migrations/000001_init.up.sql   کل اسکیمای اولیه (۱۵ جدول)
migrations/000001_init.down.sql
migrations/000002_order_code.up.sql    order_code_seq + orders.paid_at + ایندکس یکتای authority
migrations/000002_order_code.down.sql
migrations/000003_phone_verification.up.sql    phone_verifications + users.phone_verified_at
migrations/000003_phone_verification.down.sql
internal/config/config.go       خواندن env + اعتبارسنجی + ZarinPalConfig.BaseURL()
                                + ShippingConfig (FlatCost/FreeFrom/Cost)
                                + SMSConfig (TestMode/CodeTTL/ResendAfter)
internal/database/database.go   pgxpool + health check
internal/database/migrate.go    اجراکنندهٔ مهاجرت با advisory lock
internal/model/                 address, admin (DTOهای پنل + CanTransition),
                                cart, category, errors, order, pagination, product, user
internal/repository/            address, admin_product (محصول/گونه/تصویر + ProductSlugTaken),
                                admin_order (ListForAdmin/TransitionStatus/restoreStock/UpsertShipment/statusFa),
                                admin_user, admin_coupon, admin_stats,
                                cart, category, coupon, errors, order, payment, product, user,
                                verification (کد یکبارمصرف ثبت‌نام: Issue/LastIssuedAt/Verify)
internal/service/               address, admin (قواعد پنل + اسلاگ‌ساز translit/slugify)،
                                auth (ورود/ثبت‌نام + کد تأیید پیامکی), cart, category,
                                coupon, order, payment, product, token, user
internal/handler/               address, admin, auth, cart, category, health, order, payment, product, user
                                + query.go (parse صفحه‌بندی/مرتب‌سازی)
                                + response.go و validator.go (واسط نازک روی httpx)
internal/httpx/                 response.go, validate.go, format.go (ارقام فارسی) ← مشترک handler/middleware
internal/zarinpal/zarinpal.go   کلاینت v4 درگاه: Request, Verify, StartPayURL, کدهای خطا
internal/middleware/            auth.go (RequireAuth/RequireAdmin/OptionalAuth), logger.go
internal/router/router.go       سیم‌کشی همهٔ مسیرها + CORS + rate limit + fallback 404
internal/seeder/seeder.go       ساخت ۵۰ محصول، ۳ دسته، ۲ کوپن، ۲ کاربر
```

**چرا `httpx` جدا شد؟** `handler` به `middleware` و `middleware` به `handler`
وابستگی می‌خواست → import cycle. کد پاسخ/اعتبارسنجی مشترک به `internal/httpx`
منتقل شد و `handler` فقط wrapper نازک دارد.

### فرانت‌اند — فهرست کامل فایل‌ها

```
src/main.tsx                    React Query + Router (future flags v7) + ThemeProvider
src/App.tsx                     جدول مسیرها، همه lazy() به‌جز HomePage
src/index.css                   توکن‌های HSL طراحی، لایت/دارک
src/lib/api.ts                  fetch wrapper، ApiError، refresh شفاف ۴۰۱
src/lib/token.ts                ذخیره/خواندن توکن‌ها در localStorage
src/lib/query-client.ts         تنظیمات TanStack Query
src/lib/cart-cache.ts           کلید کش سبد + syncGuestCart() (ادغام سبد مهمان)
src/lib/shipping.ts             هزینهٔ ارسال و آستانهٔ ارسال رایگان (آینهٔ سرور، فقط برای نمایش)
src/lib/payment-session.ts      نگه‌داشتن آخرین شروع پرداخت در sessionStorage برای صفحهٔ نتیجه
src/lib/format.ts               اعداد فارسی، قیمت تومان، تاریخ جلالی
src/lib/schemas.ts              اسکیم‌های zod فرم‌ها (ورود/پروفایل + admin: محصول، واریانت،
                                تصویر، دسته‌بندی، کوپن + مبدل‌های تاریخ و `digitsToNumber`)
src/lib/utils.ts                cn()
src/types/api.ts                تایپ‌های API + Order/Payment/OrderPreview/Shipment/Coupon +
                                ORDER_STATUS_LABELS + ORDER_NEXT_STEPS
src/store/auth-store.ts         کاربر + توکن‌ها؛ پس از ورود syncGuestCart() را صدا می‌زند
src/store/cart-store.ts         سبد مهمان (persist در localStorage، version=2)
src/services/                   auth, cart, products, categories, addresses, orders, payments, admin
src/hooks/                      use-cart (واسط یکپارچهٔ سبد), use-products, use-categories,
                                use-orders (preview/list/detail), use-admin (کوچ‌ها + جهش‌ها)
src/providers/theme-provider.tsx
src/components/ui/              ۲۶ کامپوننت shadcn (accordion … tooltip)
src/components/layout/          header, footer, site-layout, search-bar, theme-toggle
                                (سوئیچ دوحالتهٔ روشن/تیره)، user-menu, auth-shell
src/components/product/         product-card, product-grid, price, rating-stars,
                                filter-panel
src/components/common/          smart-image, empty-state, logo, protected-route,
                                order-status-badge (مشترک بین پنل و حساب کاربری)
src/components/account/         addresses-tab, orders-tab (+ AddressDialog صادرشده برای checkout)
src/components/admin/           page-header, table-pagination, confirm-dialog,
                                variant-manager (UI: «گونه»), image-manager
src/pages/                      home, products, product-detail, cart, checkout,
                                payment-result, login, register (دو مرحله‌ای با کد
                                پیامکی), account (منوی عمودی + سه بخش), not-found
src/pages/admin/                layout (پوسته + نویگیشن عمودی + Outlet), dashboard, products,
                                product-form, categories, orders, order-detail,
                                users, coupons
```

---

## ۶) کارهای انجام‌شده ✅

### زیرساخت
- [x] نصب Go 1.27، PostgreSQL 16 (سرویس ویندوزی)، Docker Desktop (بی‌استفاده)
- [x] `scripts/dev-db.ps1` — ساخت نقش، دیتابیس و افزونهٔ `pg_trgm`
- [x] `.env.example` ریشه + `backend/.env.example` + `frontend/.env.example`
- [x] `docker-compose.yml`، `Makefile`، `.gitignore`، `README.md` فارسی
- [x] دو اسکیل پروژه در `.opencode/skills/` (`frontend-design`، `shadcn-rtl`)

### بک‌اند (کامل و تست‌شده)
- [x] اسکیمای کامل: ۱۵ جدول — `users`, `addresses`, `categories`, `products`,
      `product_images`, `product_variants`, `reviews`, `carts`, `cart_items`,
      `wishlists`, `coupons`, `orders`, `order_items`, `payments`, `shipments`
- [x] ایندکس‌ها شامل جست‌وجوی سه‌گرام: `products_title_trgm_idx (gin)`
- [x] مهاجرت embed شده + قفل advisory (اجرای هم‌زمان امن)
- [x] احراز هویت: ثبت‌نام، ورود، refresh چرخشی، خروج، `me`، تغییر رمز
- [x] پروفایل کاربر، CRUD آدرس‌ها با اعتبارسنجی
- [x] کاتالوگ: دسته‌ها، لیست محصولات با فیلتر/مرتب‌سازی/صفحه‌بندی،
      جزئیات با واریانت و تصاویر، `suggest` (جست‌وجوی خودکار)، `related`
- [x] Rate limit روی مسیرهای اعتبارنامه (۲۰ درخواست در دقیقه به‌ازای IP)
- [x] قالب خطای یکسان: `{"error":{"code","message","details?"}}` با پیام فارسی
- [x] Seeder idempotent: ۵۰ محصول، ۳ دسته (۱۷/۱۷/۱۶)، ۲ کوپن، مدیر + مشتری
- [x] `go build ./...` و `go vet ./...` پاک

### فرانت‌اند (کامل و تست‌شده)
- [x] تم ایران‌سایتی: RTL سراسری، توکن‌های HSL سفید/آبی، حالت تاریک با
      `ThemeProvider` (ذخیره در `localStorage`)
- [x] ۲۶ کامپوننت shadcn/ui
- [x] هدر چسبان با جست‌وجوی زنده، سوییچ تم، منوی کاربر، ناوبری موبایل
- [x] صفحهٔ خانه: هِیرو، آمار، ۳ کارت دسته، پیشنهاد ویژه، تخفیف‌های امروز
- [x] فهرست محصولات: فیلتر دسته/قیمت/موجودی، مرتب‌سازی، صفحه‌بندی
- [x] جزئیات محصول: گالری، انتخاب سایز/رنگ با غیرفعال‌سازی ترکیب ناموجود،
      تعداد، آکاردئون مشخصات، محصولات مشابه
- [x] سبد خرید: مهمان در مرورگر با persist، کاربر واردشده روی سرور — جزئیات در «فاز ۲» پایین‌تر
- [x] ورود/ثبت‌نام با zod + پیام‌های فارسی، مسیرهای محافظت‌شده و نقش مدیر
- [x] صفحهٔ حساب کاربری: پروفایل + تب آدرس‌ها + تب سفارش‌ها (خالی/آینده)
- [x] ۴۰۴ اختصاصی
- [x] تقسیم کد: `manualChunks` + `React.lazy` برای همهٔ صفحه‌ها به‌جز خانه؛
      بزرگ‌ترین قطعه ۱۶۴KB (بدون هشدار ۵۰۰KB)
- [x] `npx tsc --noEmit` و `npm run build` پاک

### فاز ۲ — سبد خرید سمت سرور ✅ (تمام و تست‌شده)

مدل دوگانه: **مهمان** سبدش را در `localStorage` نگه می‌دارد
(`shalvarsara.cart`)، **کاربر واردشده** سبدش را روی سرور دارد. لحظهٔ ورود،
سبد مرورگری با `POST /cart/merge` به حساب منتقل می‌شود.

- [x] `internal/model/cart.go` — `Cart`, `CartLine`, `CartView`, `CartLineInput`
- [x] `internal/repository/cart.go` — `GetByUser`, `GetOrCreateByUser` (upsert
      اتمیک)، `LoadLines` (join با محصول/واریانت/تصویر اصلی)، `AddItem`
      (کلیمپ موجودی **داخل خود SQL** با `LEAST` تا دو درخواست هم‌زمان از
      موجودی رد نشوند)، `SetQuantity`, `DeleteItem`, `Clear`
- [x] `internal/service/cart.go` — `resolve()` محصول را فعال و واریانت را
      متعلق به همان محصول چک می‌کند، تعداد را به موجودی و سقف ۹۹ کلیمپ می‌کند؛
      `Merge()` خطوط ناموجود را **رد می‌کند** و تعداد رد‌شده‌ها را برمی‌گرداند
      (ورود را شکست نمی‌دهد)
- [x] `internal/handler/cart.go` — اعتبارسنجی بدنه + `mergeCartResponse`
- [x] مسیرها زیر `RequireAuth`:
      `GET /cart`, `DELETE /cart`, `POST /cart/items`,
      `PATCH /cart/items/:id`, `DELETE /cart/items/:id`, `POST /cart/merge`
- [x] **هر endpoint کل سبد را برمی‌گرداند** (`CartView`)، پس کلاینت بدون
      درخواست دوم کش را جایگزین می‌کند و صفحه فلش نمی‌زند.
- [x] `src/services/cart.ts` + `src/lib/cart-cache.ts` (`syncGuestCart`)
- [x] `src/hooks/use-cart.ts` — واسط یکپارچه: مهمان → استور zustand،
      واردشده → React Query؛ کامپوننت‌ها نمی‌دانند کدام فعال است
- [x] `auth-store` پس از `login`/`register`/`bootstrap` سبد مهمان را منتقل
      می‌کند و `logout` کش سبد را پاک می‌کند
- [x] صفحهٔ سبد: نشان «ناموجود»، هشدار کمبود موجودی، دکمهٔ «خالی کردن سبد»،
      غیرفعال بودن دکمهٔ پرداخت وقتی قلمی ناموجود است
- [x] هزینهٔ ارسال به `src/lib/shipping.ts` منتقل شد (در فاز ۳ تک‌منبع حقیقت به سرور رفت)
- [x] **معیار پذیرش برآورده شد:** مهمان ۲ عدد افزود → ورود →
      `POST /cart/merge → 200` → سبد سرور دقیقاً ۲ عدد (نه ۴)

**باگ واقعی که در همین مسیر پیدا و رفع شد:** زیر `StrictMode` افکت mount
دو بار اجرا می‌شود، پس `syncGuestCart()` هم دو بار صدا زده می‌شد و چون سرور
تعدادها را **جمع** می‌کند، هر قلم دو برابر می‌شد. با یک گارد in-flight
(`inFlight ??= runMerge()`) یک‌بارسازی شد.

### فاز ۳ — سفارش‌ها و پرداخت ✅ (تمام و تست‌شده)

**قاعدهٔ اصلی: قیمت‌گذاری فقط سمت سرور است.** `POST /orders/preview` و
`POST /orders` از یک تابع خصوصی مشترک (`price()`) رد می‌شوند، پس صفحهٔ تسویه
حساب دقیقاً همان عددی را نشان می‌دهد که در سفارش ذخیره می‌شود.

- [x] `internal/model/order.go` — `Order`, `OrderItem`, `OrderPreview`,
      `Payment`, `PaymentStart` (و در فرانت `ORDER_STATUS_LABELS`)
- [x] `migrations/000002_order_code.up.sql` — دنبالهٔ `order_code_seq`
      (`START 1001`)، ستون `orders.paid_at` و ایندکس یکتای `authority`
- [x] `internal/repository/order.go` — `CreateFromCart` که **همه‌چیز** را در
      یک تراکنش می‌نویسد: قفل ردیف واریانت‌ها با `SELECT … FOR UPDATE` به
      ترتیب قطعی (شناسهٔ محصول، سپس واریانت)، کسر موجودی و افزایش
      `sold_count`، مصرف کوپن، درج `order_items` با اسنپ‌شات
      عنوان/واریانت/قیمت، و خالی‌کردن سبد. محصولات بدون واریانت با
      `UPDATE … WHERE stock >= $2` محافظت می‌شوند. `GetByIDUnscoped` برای
      callback درگاه (بدون توکن) در همان فایل است.
- [x] `internal/repository/coupon.go` — مصرف کوپن با
      `UPDATE … WHERE is_active AND (max_uses = 0 OR used_count < max_uses)
      AND (expires_at IS NULL OR expires_at > now()) AND min_order <= $2`؛
      صفر ردیف ⇒ `ErrInvalidCoupon` (تعداد مصرف به‌صورت مسابقه‌ای قابل عبور نیست)
- [x] `internal/service/order.go` — `Preview`/`Create` روی `price()` مشترک؛
      `List`/`Get` همراه بررسی مالکیت (سفارش دیگری ⇒ 404)
- [x] کد سفارش `SS-<سال جلالی>-<۶ رقم>` با `model.JalaliYear`
      (قاعدهٔ نوروز: پیش از ۲۱ مارس `year-622` وگرنه `year-621`) —
      نمونهٔ واقعی: `SS-1405-001004`
- [x] **هزینهٔ ارسال سمت سرور** — `config.ShippingConfig{FlatCost: 65000,
      FreeFrom: 2000000}`؛ آستانه روی **جمع کالاها پیش از تخفیف** سنجیده
      می‌شود تا کوپن هیچ‌وقت هزینهٔ ارسال اضافه نکند.
      `frontend/src/lib/shipping.ts` فقط آینهٔ نمایشی است.
- [x] `internal/zarinpal/zarinpal.go` — کلاینت v4 (`request.json`/
      `verify.json`)، سندباکس‌آگاه، با `Error.Persian()` برای پیام فارسی
      کدهای درگاه؛ پاسخ `data: []` در خطا هم هندل شده
- [x] `internal/service/payment.go` — `Start`/`Callback`/`Status`؛ تبدیل
      تومان به ریال **فقط در یک ثابت** (`rialPerToman`) و مبلغ **از خود
      سفارش** خوانده می‌شود، نه از درخواست کاربر
- [x] `Callback` ایدمپوتنت است: بازگشت تکراری از درگاه، تماس تازه با درگاه
      ندارد و همان موفقیت را برمی‌گرداند؛ کد ۱۰۱ نیز موفقیت است
- [x] `model.UserFacingError{Err, Text}` برای چسباندن پیام فارسی مشخص به یک
      خطای سنجه‌ای، بدون از دست دادن کد/وضعیت در `httpx.MapError`
- [x] مسیرها: `POST /orders/preview`, `POST /orders`, `GET /orders`,
      `GET /orders/:id`, `GET /orders/:id/payment`,
      `POST /payments/request`, `GET /payments/callback` (عمومی)
- [x] فرانت: `pages/checkout.tsx` (آدرس + کوپن + توضیحات + خلاصهٔ سروری)،
      `pages/payment-result.tsx` (رسید)، `components/account/orders-tab.tsx`،
      `lib/payment-session.ts` برای نگه‌داشتن شروع پرداخت در `sessionStorage`
      (صفحهٔ نتیجه بلافاصله مبلغ و نشان سندباکس را نشان می‌دهد)
- [x] تب‌های حساب کاربری به URL گره خوردند
      (`/account`, `/account/addresses`, `/account/orders`) چون فوتر و منوی
      کاربر از قبل به «پیگیری سفارش» ⇒ `/account/orders` لینک می‌دادند
- [x] **معیار پذیرش برآورده شد:** خرید کامل در مرورگر روی **سندباکس** —
      سفارش `SS-1405-001004` با کوپن `WELCOME10` (۱۰٪ = ۳۴۷٬۰۰۰) و ارسال
      رایگان، گذار `pending → paid`، `ref_id=527673201`،
      `card_pan=999999******9999` — و همان سفارش سپس در تب «سفارش‌ها» با
      دکمهٔ «ادامهٔ پرداخت» برای سفارش‌های `pending` دیده شد

### بازبینی RTL و متن‌های ترکیبی ✅ (پیش از فاز ۴)

- [x] **`DirectionProvider dir="rtl"`** در `src/main.tsx` — رادیکس بدون آن
      جهت را LTR فرض می‌کند (سمت باز شدن زیرمنو، رفتار کلیدهای جهت‌دار).
- [x] **ستاره‌های امتیاز درست شدند.** ردیف پرشده داخل جعبهٔ کلیپ‌شده بود و
      پنج آیکون به‌عنوان flex item در عرض کم **فشرده** می‌شدند (ستاره‌ها توی
      هم می‌رفتند). حالا ردیف داخلی `w-max` + `shrink-0` دارد و از لبهٔ
      **شروع خط (راست در RTL)** کلیپ می‌شود.
- [x] **حذف «N فروش موفق»** از کارت محصول و از صفحهٔ محصول.
- [x] **اعشار امتیاز فارسی شد** — `formatRating` ⇒ «۴٫۵» با ممیز فارسی
      (U+066B) به‌جای «4.5» لاتین؛ متن صفحه‌خوان هم `aria-label` تمیز گرفت.
- [x] **ارقام فارسی در نمایش دادهٔ لاتین:** عنوان محصول، توضیح، سایز، برچسب
      واریانت و توست‌ها در کارت/صفحهٔ محصول/سبد/تسویه/سفارش‌ها/رسید با
      `toFaDigits` نمایش داده می‌شوند. پایگاه داده و API دست‌نخورده‌اند
      (نرمال‌سازی در ورودی)، پس جست‌وجو با هر دو دسته رقم کار می‌کند.
      نتیجهٔ اندازه‌گیری: **صفر رقم لاتین** در متن دیدنی صفحات.
- [x] **جهت آیکون‌ها:** بردکرامب، صفحه‌بندی و زیرمنوی کشویی با الگوی
      «آیکون با معنای LTR + `rtl:-scale-x-100`» مرتب شدند (قبلی برعکس بود:
      «قبلی/بعدی» و جداکنندهٔ بردکرامب در جهت اشتباه بودند).
- [x] **`switch.tsx`:** جابه‌جایی انگشتی در LTR و RTL جدا شد
      (`translate-x-5` + `rtl:-translate-x-5`).
- [x] **`sheet.tsx`:** کلاس‌های فیزیکی `slide-in/out` با سمت منطقی هم‌تراز
      شدند (`start` = راست ⇒ `slide-in-from-right`، `end` = چپ ⇒
      `slide-in-from-left`). دراور فیلترها به `side="end"` رفت (هم‌سمت دکمهٔ
      «فیلترها») و دراور ناوبری موبایل روی `start` ماند (هم‌سمت همبرگر).
- [x] بازبینی همهٔ صفحات: **هیچ سرریز افقی** و **هیچ ظرف LTR ناخواسته**‌ای
      نماند (چک خودکار `scrollWidth` و پیمایش `direction` تمام عناصر).

### دو بهبودی که در بازبینی مرورگر پیدا و رفع شد
- [x] **`SmartImage` بازنویسی شد.** قبلاً تا لود شدن تصویر، کارت محصول یک
      مستطیل خالی بود. حالا یک جای‌نگهدار SVG **درون‌خطی** (گلیف شلوار با
      `text-primary/25` روی `bg-muted`) بلافاصله دیده می‌شود و عکس روی آن
      fade می‌شود. چون inline است، با تم روشن/تاریک هم‌رنگ می‌شود.
      همچنین تصویر کش‌شده با بررسی `naturalWidth` هندل می‌شود.
      فایل `src/lib/placeholder.ts` حذف شد.
- [x] هشدارهای React Router با future flags حذف شد؛ کنسول کاملاً تمیز است.

### فاز ۴ — پنل مدیریت ✅ (تمام و تست‌شده)

**قاعدهٔ اصلی: تمام مسیرهای `/admin` زیر `RequireAuth` + `RequireAdmin` هستند**
و نقش در هر درخواست تازه از توکن خوانده می‌شود (مدیر غیرفعال‌شده بلافاصله قطع می‌شود).

**بک‌اند**
- [x] `internal/model/admin.go` — DTOهای ورودی/خروجی پنل، `CanTransition`
      (نمودار مجاز گذار وضعیت) و `AdminStats`
- [x] `internal/repository/admin_product.go` — نوشتن محصول/واریانت/تصویر،
      `ProductSlugTaken`، `FindVariant`، `FindImage`
- [x] `internal/repository/admin_order.go` — `ListForAdmin`، `TransitionStatus`
      زیر `SELECT … FOR UPDATE`، `restoreStock` (معکوس `reserveStock` با همان
      ترتیب قفل)، `UpsertShipment`، `statusFa`
- [x] `internal/repository/admin_user.go` / `admin_coupon.go` / `admin_stats.go`
      — آمار تجمیعی (درآمد، سفارش‌ها، پرفروش‌ها، نمودار ۱۴ روزه، کاربران)
- [x] `internal/service/admin.go` — قواعد پنل: `mergeProduct` (PATCH =
      ادغام جزئی؛ `nil` یعنی «دست نزن»، `discountPrice: 0` یعنی «تخفیف را
      بردار»)، اعتبارسنجی تخفیف/موجودی، و **اسلاگ‌ساز**
- [x] **اسلاگ‌ها ASCII هستند:** `persianToLatin` (نقشهٔ دستی حروف فارسی/عربی
      + ارقام فارسی) و بعد فیلتر `[a-z0-9-]`. چرا؟ Fiber پارام‌های مسیر را
      unescape نمی‌کند، پس اسلاگ فارسی در `GET /products/:slug` **۴۰۴** می‌شد.
      نمونهٔ زنده: `shlvar-jyn-kargv-mrdanh-mdl-majrajv`.
      برخورد با `-2`، `-3`… حل می‌شود.
- [x] `ProductSlugTaken` **`deleted_at` را نادیده می‌گیرد** تا با قید
      `UNIQUE (slug)` هم‌خوان باشد؛ محصول حذف‌شده اسلاگش را رزرو نگه می‌دارد
      (اسلاگ بازیافتی یعنی برگشتن پیوندهای قدیمی به محصول اشتباه).
- [x] `internal/handler/admin.go` + گروه مسیر در `router.go` + سیم‌کشی
      `cmd/api/main.go`
- [x] **حذف محصول نرم است** (`is_active=false` + `deleted_at=now()`)، پس
      `order_items` قدیمی سالم می‌مانند.
- [x] گاردهای انسانی روی `PATCH /admin/users/:id`: نه خودت را غیرفعال/تنزل
      می‌دهی، نه آخرین مدیر فعال را (رد با ۴۲۲ و پیام فارسی).
- [x] `AdminCouponInput.ClearExpiry` — چون JSON `null` از «ارسال نشده»
      قابل تشخیص نیست وگرنه هرگز نمی‌شد انقضا را برداشت.
- [x] `ProductFilter.IsActive` + احترام به `IncludeInactive` در
      `buildProductFilter`

**فرانت‌اند** (`pages/admin/` جای `pages/admin.tsx` را گرفت)
- [x] پوستهٔ `pages/admin/layout.tsx`: ناوبری با `NavLink` (نشان فعال)،
      **روی دسکتاپ ستون چسبان، روی موبایل ردیف افقی اسکرول‌شو** (سایدبار
      غیرقابل‌بستن روی موبایل نداریم)، دکمهٔ «مشاهده فروشگاه»
- [x] مسیرهای تودرتو با `Outlet` و **هر صفحه جدا lazy**:
      `/admin`, `/admin/products`, `/admin/products/new`,
      `/admin/products/:id`, `/admin/categories`, `/admin/orders`,
      `/admin/orders/:id`, `/admin/users`, `/admin/coupons`
- [x] `dashboard.tsx`: چهار کارت اصلی + پنج کاشی وضعیت (لینک‌دار)، هشدار
      موجودی کم، **نمودار میله‌ای ۱۴ روزه** (سبد `dir="ltr"` چون سری زمانی
      است)، پرفروش‌ها، آخرین سفارش‌ها
- [x] `products.tsx`: جست‌وجو + فیلتر دسته/وضعیت + ترتیب، جدول با تامبنیل،
      کلید سریع فعال/غیرفعال و حذف با تأیید
- [x] `product-form.tsx`: یک صفحه برای ساخت و ویرایش؛ بخش‌های اطلاعات/قیمت/
      وضعیت، دکمهٔ ذخیره در هدر (با `form="product-form"`)، پیشخوان
      «نمایش در فروشگاه»
- [x] `components/admin/variant-manager.tsx` و `image-manager.tsx`: جدول
      واریانت‌ها با دیالوگ افزودن/ویرایش و سواچ رنگ، گالری با «اصلی کن»
- [x] `orders.tsx` / `order-detail.tsx`: فیلتر وضعیت، **تایم‌لاین سفارش**،
      دکمه‌های گام بعدی از `ORDER_NEXT_STEPS`، لغو با تأیید، فرم مرسوله
      (شرکت حمل + کد رهگیری با `dir="ltr"`)، کارت پرداخت (مبلغ ریالی نمایش
      داده‌شده به تومان، `refId`/`cardPan`/`authority` لاتین)
- [x] `users.tsx` (نقش با Select درجا + سوییچ فعال)، `coupons.tsx`
      (درصدی/مبلغی، حداقل سفارش، سقف استفاده، انقضا با `input[type=date]` —
      خالی‌کردن تاریخ با `clearExpiry` می‌رود)،
      `categories.tsx` (با والد و ترتیب)
- [x] `components/common/order-status-badge.tsx` مشترک شد؛ پالت رنگ وضعیت
      دیگر در دو جا تکرار نمی‌شود (تب «سفارش‌ها» هم از همان استفاده می‌کند)
- [x] تب «سفارش‌ها»ی مشتری: **کد رهگیری و شرکت حمل حتی در حالت بستهٔ کارت
      دیده می‌شود** (مشتری برای دیدن آن نیازی به باز کردن جزئیات ندارد)
- [x] برچسب وضعیت `processing` در فرانت با بک‌اند یکسان شد:
      «در حال آماده‌سازی» (قبلاً «در حال پردازش» بود)

**معیار پذیرش — برآورده شد (سرتاسری در مرورگر)**
- [x] ساخت محصول از UI (عنوان/دسته/قیمت/تخفیف/موجودی) → توست
      «محصول ایجاد شد.» و انتقال به `/admin/products/55`
- [x] ویرایش در UI: فرم مقادیر ذخیره‌شده را برگرداند، اسلاگ خودکار ساخته شد،
      افزودن واریانت (`۳۲/مشکی` و `۳۴/سرمه‌ای`) و تصویر اصلی از دیالوگ‌ها
      → توست‌های «واریانت اضافه شد.» / «تصویر اضافه شد.»
- [x] محصول تازه بلافاصله در فروشگاه دیده شد:
      `/products/shlvar-jyn-kargv-mrdanh-mdl-majrajv` با نشان ۲۱٪ و
      قیمت ۱٬۲۵۰٬۰۰۰ → ۹۹۰٬۰۰۰ تومان
- [x] `SS-1405-001004` از «پرداخت‌شده» به «در حال آماده‌سازی» رفت
      (تایم‌لاین سه گام پرشده) و کد رهگیری `IR-1405-778812` با شرکت
      «پست پیشتاز» ثبت شد
- [x] مشتری همان را در تب «سفارش‌ها» دید: «در حال آماده‌سازی» +
      «پست پیشتاز — کد رهگیری: IR-1405-778812»

**دو باگ واقعی که در همین پذیرش مرورگر پیدا و رفع شد**
- [x] **`FormControl` نباید دور چند عنصر بپیچد.** در دیالوگ واریانت،
      `FormControl` دور `<div><span/>+<Input/></div>` بود؛ `Slot` شناسه را به
      `div` می‌داد، پس برچسب «کد رنگ» به ورودی وصل **نبود** (کلیک روی برچسب
      فوکوس نمی‌داد و تست هم شناسه را روی عنصر غیرورودی می‌دید). حالا
      `FormControl` فقط دور `Input` است و چیدمان یک `div` جداگانه دارد.
- [x] **دیالوگِ داخل `<form>` باعث ذخیرهٔ ناخواستهٔ محصول می‌شد.** محتوای
      دیالوگ رادیکس در portal رندر می‌شود، ولی رویداد در **درخت React** بالا
      می‌رود؛ پس `submit` فرم دیالوگ به `#product-form` هم می‌رسید و با هر
      افزودن واریانت/تصویر یک `PATCH /admin/products/:id` اضافه می‌رفت
      (توست «تغییرات ذخیره شد.» کنار توست واریانت). حالا `VariantManager` و
      `ImageManager` **بیرون** از تگ `<form>` رندر می‌شوند. تأیید با
      `browser.network.list`: فقط `POST …/variants` می‌رود، بدون PATCH.

### بازبینی UI + ثبت‌نام با کد پیامکی ✅ (تمام و تست‌شده — درخواست کارفرما)

این بسته درخواست‌های کارفرما را یک‌جا انجام می‌دهد: ظاهر پنل کاربری، سوئیچ
پوسته، واژه‌نامه، حساب‌های آزمایشی روی صفحهٔ ورود و ثبت‌نام پیامکی.

- [x] **سوئیچ پوسته دوحالته (نه سه گزینه).** `ThemeToggle` دیگر منوی کشویی
      نیست؛ یک دکمه که بین روشن/تیره جابه‌جا می‌کند. «مطابق سیستم» به‌عنوان
      **پیش‌فرض اولین بازدید** باقی ماند، ولی در UI گزینه‌ای برایش نیست:
      اگر `theme` در `localStorage` نباشد، هم اسکریپت درون `index.html` و هم
      `ThemeProvider` از `prefers-color-scheme` پیروی می‌کنند و اولین کلیک
      انتخاب را قطعی می‌کند.
      *(باگ رفع‌شده: اسکریپت `index.html` مقدار `"system"` را «روشن» تفسیر
      می‌کرد → پرش رنگ در اولین بازدید با سیستم تیره.)*
- [x] **ناوبری حساب کاربری و پنل مدیریت عمودی شد (خواستهٔ کارفرما).**
      `Tabs` افقی از `/account` حذف شد؛ حالا هر دو پنل
      `grid … lg:grid-cols-[…_1fr]` هستند با منوی چسبان سمت **راست**
      (`NavLink`، URL-محور) و **آیکون برای هر بخش**: اطلاعات کاربری
      (`UserRound`)، آدرس‌ها (`MapPin`)، سفارش‌ها (`Receipt`) — ادمین:
      داشبورد، محصولات، دسته‌بندی‌ها، سفارش‌ها، کاربران، کدهای تخفیف.
      روی موبایل منو **بالای** محتوا و همچنان عمودی است (ادمین دو ستون
      جمع‌وجور تا ارتفاع کم شود). کارت کوچک کاربر (حرف اول نام + ایمیل) بالای
      منوی حساب اضافه شد.
- [x] **کارت «اطلاعات کاربری» جمع‌وجور شد.** به‌جای کارت تمام‌عرض با فضای
      خالی: `max-w-2xl`، دو ستون برای نام/موبایل، ایمیل فقط‌خواندنی با آیکون
      قفل، `Separator` و نوار پایانی با راهنمای وضعیت («تغییرات ذخیره نشده
      دارید.» / «همه‌چیز ذخیره شده است.»).
- [x] **هم‌پوشانی آیکون حذف و نشان «پیش‌فرض» در آدرس‌ها رفع شد.** علت: نشان با
      `justify-between` به لبهٔ چپ (انتهای RTL) می‌رفت و دکمهٔ حذف
      `absolute end-2 top-2` هم دقیقاً همان‌جا بود. حالا هر دو داخل ردیف
      سرصفحه و با `shrink-0` کنار هم می‌نشینند (چک هندسی: فاصلهٔ ۴px،
      بدون هم‌پوشانی).
- [x] **واژه‌نامه: «واریانت» → «گونه»** در همهٔ متن‌های دیده‌شدنی (۲۰ نقطه در
      ۵ فایل: `variant-manager`, `product-form`, `order-detail`, `dashboard`,
      `use-admin`). نام فایل‌ها/توابع/مسیرهای API دست‌نخورده مانده‌اند
      (شناسهٔ کد است، نه متن UI).
- [x] **صفحهٔ ورود: هر دو حساب آزمایشی** (مشتری و مدیر) داخل یک کادر با
      `dir="ltr"` نوشته شده‌اند.
- [x] **ثبت‌نام دو مرحله‌ای با کد پیامکی — آمادهٔ اتصال به پنل پیامکی.**
      `POST /auth/register/code` کد ۶ رقمی می‌سازد (CSPRNG)، در جدول
      `phone_verifications` نگه می‌دارد (TTL ۲ دقیقه، حداکثر ۵ تلاش،
      فاصلهٔ ۶۰ ثانیه بین درخواست‌ها، هر کد یک‌بارمصرف) و
      `POST /auth/register` بدون کد معتبر **۴۲۲** می‌دهد. شمارهٔ تأییدشده در
      `users.phone_verified_at` ثبت می‌شود. تا اتصال پنل پیامکی،
      `SMS_TEST_MODE=true` است و کد **در پاسخ API و روی همان صفحه** با توضیح
      فارسی «این نسخهٔ آزمایشی است …» نمایش داده می‌شود؛ برای تولید فقط
      `SMS_TEST_MODE=false` (و وصل کردن پنل به `RequestRegisterCode`) لازم است.
- [x] **بازبینی ریسپانسیو در ۳۶۰/۴۱۴/۷۶۸/۱۰۲۴/۱۴۴۰.** چون پنجرهٔ مرورگر این
      محیط قابل تغییر اندازه نیست، هر مسیر داخل **iframe هم‌مبدأ** با عرض
      دلخواه بارگذاری شد و سرریز افقی (`scrollWidth - clientWidth`) و
      عناصر بیرون‌زده سنجیده شدند. دو سرریز واقعی پیدا و رفع شد
      (جدول پایین را ببینید): کمبود **`min-w-0` روی آیتم‌های grid** که جدول
      پهن را به کل صفحه تحمیل می‌کرد.

### بستهٔ درخواست کارفرما — پشتیبانی، قیمت، صفحه‌بندی، تراکنش و نقشهٔ آدرس ✅ (تمام و تست‌شده)

بستهٔ دوم درخواست‌های کارفرما: چهار باگ/کمبود دیده‌شده در مرورگر، دو صفحهٔ
تازه در پنل، یک قابلیت تازه روی آدرس‌ها و یک پاس محتوایی روی صفحات فروشگاه.
**مهارت `make-interfaces-feel-better` هم در همین بسته به پروژه اضافه شد**
(`.opencode/skills/make-interfaces-feel-better/`) و در پاس محتوایی به‌کار رفت.

- [x] **قیمت‌ها: «تومان» + جداکنندهٔ سه‌رقمی — همه‌جا، حتی داخل ورودی‌ها.**
      `components/ui/money-input.tsx` اضافه شد: مقدارِ فرم **فقط رقم لاتین**
      می‌ماند (سازگار با API و `{...field}` ری‌اکت-هوک-فرم)، ولی نمایش
      `1,250,000` با پسوند «تومان» داخل خود فیلد است (جزیرهٔ `dir="ltr"` +
      `text-end`). جاهایی که برچسبْ واحد را گفته، `suffix={null}`.
      به‌کار رفته در: قیمت/قیمت با تخفیف محصول، اختلاف قیمت گونه، مبلغ و
      حداقل سفارش کد تخفیف، و بازهٔ قیمت فیلتر فروشگاه.
- [x] **صفحه‌بندی محصولات درست شد.** ریشهٔ مشکل، `ui/pagination.tsx` بود که
      `size-10` می‌داد و با `line-height` سراسری `li` برچسب‌ها را می‌برید و
      شماره‌ها را از قاب بیرون می‌زد. بازنویسی شد: `h-10 min-w-10 px-3`
      (دکمه به اندازهٔ متن کش می‌آید)، `leading-none`، `flex-wrap`،
      شورون‌ها آینه‌شدهٔ RTL. کامپوننت مشترک
      `components/common/pagination-bar.tsx` اضافه شد که هم **شماره‌ها** را
      می‌دهد و هم خلاصهٔ «نمایش ۱–۱۲ از ۵۱ محصول». روی همهٔ صفحه‌بندی‌ها
      (محصولات، سفارش‌ها/محصولات/کاربران/کدهای تخفیف/تراکنش‌های پنل) اعمال شد
      و `components/admin/table-pagination.tsx` حذف شد.
- [x] **کادر پشتیبانی چسبیده به پایین-چپ.**
      `components/layout/support-widget.tsx`: دکمهٔ شناور + پنل بازشو با
      شناسهٔ تلگرام («@shalvarsara_support»)، دو شمارهٔ تماس (`tel:`)، ایمیل و
      ساعات کاری؛ روی `left-5` (فیزیکی، نه منطقی) پین است چون خواستهٔ صریح
      «پایین-چپ» بود. همهٔ مقادیر در `lib/contact.ts` متمرکز شده‌اند
      (**مقادیر نمونه‌اند و پیش از راه‌اندازی باید عوض شوند** — بخش ۸).
- [x] **فوتر بازنویسی شد.** ردیف اعتماد (۴ قلم)، ۴ ستون لینک، اطلاعات تماس،
      یادداشت زرین‌پال و **امضای «ساخته‌شده با ❤ توسط حسین جعفری»**.
- [x] **همهٔ آیکون/متن‌های روی‌هم‌افتاده بازبینی شد.** باگ اصلی در
      کدهای تخفیف بود: آیکون جست‌وجو `end-3` داخل بستهٔ RTL بود ولی خود
      `input`، `dir="ltr"` + `pe-9` داشت → آیکون روی متن می‌نشست. قاعدهٔ
      ثابت پروژه: **سمت آیکون و پدینگ ورودی باید در یک جزیرهٔ هم‌جهت باشند**
      (`start-3`/`ps-9` یا `end-3`/`pe-9`). بقیهٔ صفحات پاک بودند؛ در بازبینی
      مرورگر هم هیچ هم‌پوشانی هندسی پیدا نشد.
- [x] **صفحهٔ «تراکنش‌ها» در پنل مدیریت.** بک‌اند: `repository/admin_payment.go`
      (`ListForAdmin` + فیلتر جست‌وجو روی کد سفارش/authority/refId) و
      `GET /admin/payments` (زیر `RequireAdmin`). فرانت‌اند:
      `pages/admin/payments.tsx` با فیلتر وضعیت، جست‌وجو، لینک کد سفارش به
      جزئیات سفارش و **به‌روزرسانی خودکار هر ۳۰ ثانیه** تا ردیف «در انتظار
      پرداخت» کهنه نماند. رنگ/برچسب‌ها در
      `components/common/payment-status-badge.tsx` یک‌جا شدند (قبلاً داخل
      `order-detail.tsx` بودند).
- [x] **بخش «پنل پیامکی» با برچسب «به‌زودی».** `pages/admin/sms.tsx` + آیتم
      ناوبری با نشان «به‌زودی»؛ صفحه توضیح می‌دهد چه چیزی ساخته می‌شود
      (قالب، گزارش ارسال، اعتبار) و وضعیت فعلی کد (کد ۶ رقمی ثبت‌نام،
      `SMS_TEST_MODE`) را صادقانه می‌گوید — به‌جای یک جدول خالی.
- [x] **نقشهٔ انتخاب موقعیت روی آدرس (اختیاری).** مایگریشن
      `000004_address_coords` دو ستون `latitude`/`longitude` (DOUBLE PRECISION)
      با CHECK دامنه و **CHECK زوجی** اضافه کرد. API: `latitude`/`longitude`
      اختیاری در `AddressRequest`؛ فرستادن فقط یکی از دو → **۴۲۲** با پیام
      فارسی. فرانت: `components/account/address-map.tsx` با **Leaflet + کاشی
      OSM** (آیکون پین SVG درون‌خطی، نه فایل PNG پیش‌فرض)، دکمهٔ «موقعیت فعلی
      من»، «حذف نشان» و **دو فیلد دستی lat/lng** برای وقتی کاشی‌ها بارگذاری
      نشوند؛ اگر `tileerror` بدهد هشدار فارسی نشان داده می‌شود ولی ذخیره
      هرگز بلاک نمی‌شود. Leaflet با `React.lazy` جدا شد (چانک ۱۵۵KB فقط وقتی
      دیالوگ آدرس باز شود). روی کارت آدرس، «مشاهدهٔ نشانی روی نقشه» به OSM
      لینک می‌دهد.
- [x] **صفحات از حالت «ساخته‌شده توسط AI» خارج شدند (پاس محتوایی).**
      خانه سه بخش تازه گرفت: **راهنمای سایز با جدول واقعی تبدیل
      اینچ→سانتی‌متر** (`#size-guide`)، **پرسش‌های پرتکرار** (`#faq`،
      آکاردئون) و **نظر مشتری‌ها**؛ به‌علاوه ردیف خدمات (`#services`)،
      «پرفروش‌های این فصل» و هیرو با آمار و بافت نقطه‌ای. صفحهٔ محصول:
      جدول سایز (دور کمر هر سایز + موجودی) و ردیف اعتماد (اصالت/بازگشت/پرداخت
      امن/پشتیبانی). لینک‌های فوتر و صفحهٔ محصولات به همین لنگرها اشاره
      می‌کنند و `site-layout.tsx` اسکرول به `#hash` را (با تلاش مجدد برای
      مسیرهای lazy) انجام می‌دهد.
      زبان طراحی اعمال‌شده از مهارت: تُکِن‌های ارتفاع `--shadow-border`
      (حلقهٔ مشکی/سفید به‌جای بوردر رنگی)، کلاس‌های `.surface`/`.surface-hover`،
      شعاع‌های هم‌مرکز، `text-balance`/`text-pretty`، «tabular-nums روی
      اعداد» (**بعداً حذف شد** — ویرایش‌های بازبینی کارفرما را پایین‌تر ببینید)،
      ضخامت ۱٫۷۵ برای آیکون‌های کنار متن کم‌رنگ و انتقال‌های صریح.
- [x] **دو سرریز افقی واقعی پیدا و رفع شد.** (۱) جدول‌های تازه و کارت‌های
      بلند در ۳۶۰px — با `min-w-0` و اسکرول داخلی کارت. (۲) **هدر مهمان در
      ۳۶۰px** ۵۰px سرریز می‌داد چون دکمهٔ «ورود / ثبت‌نام» با متن کامل جا
      نمی‌شد؛ حالا زیر `sm` فقط آیکون نشان داده می‌شود (متن برای صفحه‌خوان
      با `sr-only` می‌ماند). این باگ از بستهٔ قبلی جا مانده بود، چون آن تست
      با نشستِ واردشده اجرا شده بود.

### ویرایش‌های بازبینی کارفرما — پشتیبانی، تراز، اعداد، فوتر، پس‌زمینهٔ پویا ✅ (تمام و تست‌شده)

پنج ایراد کارفرما بعد از بستهٔ قبلی. هر پنج مورد **ریشه‌یابی** شد (اندازه‌گیری
در مرورگر)، نه وصله‌کاری:

- [x] **«دکمهٔ پشتیبانی خیلی از سمت چپ فاصله دارد.»** علت واقعی: کانتینر
      `flex flex-col items-start` در RTL یعنی «راست»، پس دکمه در سمت راستِ
      ستونی می‌نشست که عرضش را از **کارت ۳۲۰pxی** می‌گرفت → فاصلهٔ
      **۲۲۸px** از لبهٔ چپ (اندازه‌گیری‌شده). حالا کارت
      `absolute bottom-[calc(100%+0.75rem)] left-0` است و فقط دکمه در جریان
      می‌ماند؛ یعنی جعبهٔ کلیک دقیقاً اندازهٔ دکمه است (قبلاً ۳۲۰×۳۴۰ فضای
      مرده بود) و کارت از **همان لبهٔ چپ** بالا باز می‌شود. نشست دکمه:
      `left-4` موبایل / `sm:left-5` دسکتاپ = **۱۶/۲۰px** (قبلاً ۲۲۸px).
- [x] **«متن‌های داخل باکس‌های ارسال سریع / ۷ روز بازگشت تراز نیستند.»**
      آیکون ۴۰px با `items-start` هم‌ترازِ خط اول بود و انتهایش ۸px پایین‌تر
      از متن (در متن سه‌خطی ۱۶px) می‌افتاد. در **هر دو** جای این چهار قول
      (نوار `#services` خانه و ردیف اعتماد فوتر) `items-center` شد تا آیکون
      نسبت به کل بلوک متن وسط بیفتد.
- [x] **«اعداد فونت عجیب و فاصلهٔ زیاد دارند.»** ریشه:
      `font-variant-numeric: tabular-nums`. ارقام جدولی وزیرمتن **۲۶٪
      عریض‌ترند** و **جداکنندهٔ هزارگان را تمام‌عرض** می‌کنند؛ اندازه‌گیری
      «۲٬۴۵۷٬۰۰۰» در ۱۶px: عادی **۶۵٫۰px** / جدولی **۸۲٫۱px** (و کاما لاتین
      ۶۲٫۹px). کلاس `.tnum` از `index.css` حذف شد و **همهٔ ۲۰ مورد
      `tabular-nums` در ۱۱ فایل** برداشته شد. `font-mono` فقط برای
      شناسه/کد (سفارش، تراکنش) ماند که تصمیم آگاهانه است.
- [x] **«اطلاعات سوشیال/تماس در فوتر چندبار تکرار شده و فوتر بزرگ است.»**
      تلگرام و ایمیل هم آیکون بودند هم ردیف متنی، و بلوک تماس جدا؛ گرید
      ۴-کارتهٔ قول‌ها هم کاملاً تکرار `#services` خانه بود. حالا: آیکون‌های
      سوشیال (اینستاگرام/تلگرام/ایمیل) **تنها** جای این اطلاعات‌اند، بلوک
      تماس فقط تلفن/موبایل/ساعات کاری/آدرس دارد، و قول‌ها به یک **نوار
      تک‌خطی** بالای colophon تبدیل شدند. `py-12→py-10`، دو `Separator` و
      بلوک کارت‌ها حذف شدند: ارتفاع فوتر دسکتاپ ~۷۰۰px → **~۴۷۰px**
      (موبایل یک‌ستونه ~۱۲۵۶px؛ قبلاً ~۱۵۰۰px).
- [x] **«پس‌زمینه حس پویایی بدهد.»** لایهٔ ثابت `body::before` با سه میدان
      رنگی radial از تُکِن‌های چارت (پس روشن/تیره هرکدام شدت خودش را دارد)
      که در **۵۲ ثانیه** آرام pan و breathe می‌شود + شبکهٔ نقطه‌ای هیرو که
      هر **۶۰ ثانیه یک کاشی (۱۸px)** می‌لغزد (`.dot-drift`). هر دو فقط
      `transform` انیمیت می‌کنند (کامپوزیت، بدون repaint) و فریم اول و آخر
      یکی است تا `prefers-reduced-motion` — که با قاعدهٔ پایه مدت را ۰٫۰۱ms
      می‌کند — هیچ پرشی نسازد. `z-index: -1` + `pointer-events: none`.
- [x] **«ریسپانسیو خصوصاً اندروید را کامل چک کن.»** هارنس تازهٔ CDP با
      وین‌دوی **واقعی** موبایل: ۱۹ مسیر × ۴ عرض (۳۲۰/۳۶۰/۳۹۰/۴۱۲) →
      `mounted=true` و `overflow=0` در همه (جدول شواهد در بخش ۷).

---

## ۷) شواهد تست — چه چیزی **قطعاً** کار می‌کند

این‌ها را دوباره تست نکنید مگر چیزی تغییر کند.

### تست API (cURL/fetch)
| مورد | نتیجه |
|---|---|
| `GET /health` | 200 |
| `GET /categories` | 200 — «شلوار مردانه/زنانه/بچگانه» |
| `GET /products` | 200 — `total=50`، `totalPages=17` با `limit=3` |
| `GET /products/:slug` | 200 — با واریانت‌ها و تصاویر |
| `GET /products/suggest?q=` | 200 |
| `GET /products/:slug/related` | 200 |
| `POST /auth/login` | 200 — `accessToken` (طول ۲۴۵)، `expiresIn=900` |
| `GET /auth/me` | 200 |
| `POST/PATCH/DELETE /addresses` | 200 |
| بدون توکن روی مسیر محافظت‌شده | **401** |
| بدنهٔ نامعتبر | **422** با `{"error":{"code":"validation_error","message":"داده‌های ورودی نامعتبر است.","details":{…}}}` |
| محصول/مسیر ناموجود | **404** |
| `GET /cart` (سبد خالی) | 200 — `{"items":[],"itemCount":0,"subtotal":0}` |
| `POST /cart/items` دو بار با همان واریانت | 200 — تعداد **جمع** می‌شود (۱ → ۲)، `maxQuantity` از موجودی واریانت |
| `PATCH /cart/items/:id` با `quantity=99` | 200 — به موجودی واقعی کلیمپ شد (۴) |
| `POST /cart/items` با `productId=0, quantity=0` | **422** با `details.productId` و `details.quantity` |
| `POST /cart/items` با محصول ناموجود | **404** |
| `POST /cart/items` با واریانتی که به محصول تعلق ندارد | **404** |
| `GET /cart` بدون توکن | **401** |
| `POST /cart/merge` با یک قلم سالم + یک قلم ناموجود | 200 — `{"cart":{…},"skipped":1}` |
| `DELETE /cart/items/:id` و `DELETE /cart` | 200 — `itemCount` صفر |

شکل پاسخ ورود دقیقاً با تایپ `AuthResponse` فرانت می‌خواند:
```json
{ "user": { "id","name","email","phone","role","isActive","createdAt","updatedAt" },
  "tokens": { "accessToken","refreshToken","expiresIn" } }
```

### تست API — فاز ۳ (اسکریپت‌های `order-smoke.ps1` و `payment-smoke.ps1`)
| مورد | نتیجه |
|---|---|
| `POST /orders/preview` (سبد ۲ قلمی) | 200 — جمع/تخفیف/ارسال/مبلغ نهایی دقیقاً همان عددی که در سفارش ذخیره شد |
| `POST /orders` | 200 — کد `SS-1405-001003`، سبد خالی شد، موجودی واریانت کم و `sold_count` زیاد شد |
| کوپن ناشناس | **400** `invalid_coupon` |
| کوپن زیر حداقل سفارش | **400** `coupon_min_order` با مبلغ حداقل به ارقام فارسی |
| سبد خالی | **400** `empty_cart` |
| خواندن سفارش کاربر دیگر | **404** |
| آستانهٔ ارسال رایگان | هر دو طرف آستانه تست شد: زیر ۲٬۰۰۰٬۰۰۰ ⇒ ۶۵٬۰۰۰ تومان، بالای آن ⇒ رایگان |
| اقلام ناکافی زیر قفل | **409** `out_of_stock` (بدون کسر نصفه‌نیمه — تراکنش برمی‌گردد) |
| `POST /payments/request` بدون توکن | **401** |
| `POST /payments/request` روی سفارش دیگران | **404** |
| `POST /payments/request` بدون `orderId` | **422** |
| شروع پرداخت سندباکس | `authority` با پیشوند `S…` و `amountRial = total × 10` |
| بازگشت با `Status=NOK` | **303** به `?status=failed`؛ ردیف پرداخت `failed` و سفارش همچنان `pending` |
| درخواست دوبارهٔ پرداخت روی همان سفارش | `authority` **تازه** صادر شد |
| `authority` ناشناس | **303** به `?status=error` |
| بازگشت تکراری با `Status=OK` (تکرار callback) | **303** به `?status=ok` **بدون** تماس با درگاه — ایدمپوتنت |
| `POST /payments/request` روی سفارش پرداخت‌شده | **409** `conflict` با پیام فارسی «این سفارش قابل پرداخت نیست…» |
| `GET /orders/:id/payment` | 200 برای صاحب سفارش / **404** برای کاربر دیگر |
| رکوردهای پایگاه داده پس از خرید | `payments.status=verified` با `ref_id`، `orders.status=paid`، `paid_at` پر، `WELCOME10.used_count` یک واحد بیشتر، `carts` بدون قلم |

### تست مرورگر (Playwright، سرتاسری)
- **خانه** → همهٔ بخش‌ها رندر شد، اعداد فارسی (۱۷/۱۷/۱۶)، چیپ‌های تخفیف
  (۴۱٪، ۳۱٪، ۵۰٪، ۴۵٪)، فوتر با سال جلالی ۱۴۰۵، **صفر خطا در کنسول**
- **فهرست محصولات** (`/products?sort=discount`) → رندر صحیح + صفحه‌بندی
- **ورود** → `POST /api/v1/auth/login → 200`، انتقال به `/`، هدر از
  «ورود / ثبت‌نام» به دکمهٔ «حساب کاربری» تغییر کرد،
  `localStorage` شامل `shalvarsara.access_token` و `shalvarsara.refresh_token`
- **حساب کاربری** (مسیر محافظت‌شده) → نشست از localStorage بازیابی شد،
  `/auth/me → 200`، تب‌ها و فرم پروفایل درست
- **افزودن به سبد** → ذخیرهٔ درست واریانت و قیمت در `shalvarsara.cart`
  (نمونه: محصول ۳۳، سایز ۴، سرمه‌ای، ۵۵۰٬۰۰۰ از ۱٬۱۱۰٬۰۰۰ تومان)

### تست مرورگر — فاز ۲ (پذیرش)
| سناریو | نتیجه |
|---|---|
| افزودن مهمان (دو بار روی همان محصول) | `shalvarsara.cart` با `version:2`، `quantity:2`، `isAvailable:true`؛ نشان هدر **۲**؛ هیچ درخواستی به `/api/v1/cart` نرفت |
| ورود پس از آن | `GET /cart → 200` سپس `POST /cart/merge → 200`؛ سبد مرورگری خالی شد (`lines.length=0`) |
| سبد سرور بعد از ادغام | دقیقاً ۱ قلم با `quantity:2`، `subtotal:1900000` — **بدون دوبرابر شدن** |
| بازخوانی سرد `/cart` (مسیر bootstrap) | `GET /cart → 200`، ۱ قلم، نشان هدر **۲**، کنسول تمیز |
| افزودن در حالت واردشده | `POST /cart/items → 200` مستقیماً روی سرور؛ نشان ۲ → **۳**؛ صفحهٔ سبد ۲ قلم |
| خروج از حساب | `hasToken:false`، نشان صفر شد، کش سبد پاک |
| افزودن پس از خروج (مهمان) | فقط در `localStorage` نشست، **صفر** درخواست به `/api/v1/cart` |

### تست مرورگر — فاز ۳ (پذیرش، خرید واقعی روی سندباکس)
| گام | نتیجه |
|---|---|
| ورود + افزودن ۴ قلم (۳ خط) | `POST /cart/items → 200`، نشان هدر **۴**، ادغام سبد مهمان باقی‌مانده هم انجام شد |
| دکمهٔ «ادامه فرآیند خرید» در `/cart` | به `/checkout` رفت (قبلاً فقط toast می‌داد) |
| `/checkout` | مسیر محافظت‌شده؛ آدرس پیش‌فرض از قبل انتخاب، خلاصه **کاملاً از سرور** |
| اعمال `WELCOME10` | «کد «WELCOME10» اعمال شد؛ ۳۴۷٬۰۰۰ تومان تخفیف لحاظ شده است.» — ۱۰٪ از ۳٬۴۷۰٬۰۰۰ |
| هزینهٔ ارسال | «رایگان» (جمع ۳٬۴۷۰٬۰۰۰ > آستانه) — مبلغ نهایی ۳٬۱۲۳٬۰۰۰ |
| «پرداخت و انتقال به درگاه» | مرورگر به `sandbox.zarinpal.com/pg/StartPay/S000…` رفت (generation جدید تب) |
| پرداخت در صفحهٔ سندباکس | بازگشت به `localhost:5173/payment/result?order=4&status=ok` |
| صفحهٔ نتیجه | نشان «پرداخت آزمایشی (سندباکس زرین‌پال)»، `SS-1405-001004`، «پرداخت‌شده»، تخفیف `−۳۴۷٬۰۰۰`، ارسال «رایگان»، **مبلغ پرداخت‌شده ۳٬۱۲۳٬۰۰۰**، شمارهٔ پیگیری `527673201`، کارت `999999******9999`، زمان `۲۳ مهر ۱۴۰۵، ۱۹:۲۴`، آدرس ارسال |
| نشان سبد پس از خرید | صفر شد (سبد سمت سرور خالی شده) |
| `/account/orders` | تب «سفارش‌ها» با URL انتخاب شد؛ `SS-1405-001004` و `SS-1405-001003` «پرداخت‌شده» و سفارش‌های `pending` با دکمهٔ «پرداخت سفارش» |

### تست مرورگر — بازبینی RTL (چک هندسی DOM؛ اسکرین‌شات در این محیط ممکن نیست)
| مورد | نتیجه |
|---|---|
| ستاره‌های کارت محصول | هر ستاره **۱۴px** (قبلاً داخل جعبهٔ کلیپ فشرده می‌شد)؛ عرض جعبهٔ پرشده ۸۲٪ برای امتیاز ۴٫۱ و لبهٔ راست آن **دقیقاً منطبق** با لبهٔ راست ردیف پایه |
| صفحه‌بندی | «صفحه قبل» در **راست‌ترین** جای نوار با چورون آینه‌شده (⇒) و «صفحه بعد» در چپ‌ترین با چورون آینه‌شده (⇐)؛ اعداد ۱..۵ بین آن‌ها |
| بردکرامب صفحهٔ محصول | سه جداکنندهٔ `chevron-right` آینه‌شده ⇒ «<» |
| سوییچ فیلتر | `unchecked`: انگشتی ۲px از لبهٔ راست (شروع خط)؛ `checked`: `--tw-translate-x = -1.25rem` (به سمت چپ) |
| دراور فیلتر موبایل (`side="end"`) | فریم شروع انیمیشن در **چپ بیرون کادر** (x = -320) ⇒ از چپ وارد می‌شود |
| دراور ناوبری موبایل (`side="start"`) | فریم شروع انیمیشن در **راست بیرون کادر** (x = +800) ⇒ از راست وارد می‌شود |
| سبد مهمان پس از افزودن | `shalvarsara.cart` با `size:"36"`؛ صفحهٔ سبد: «سایز ۳۶» و «رنگ مشکی»؛ **صفر رقم لاتین** در متن دیدنی |
| سبد خالی مهمان | پیام «سبد خرید شما خالی است» — اسپینر «در حال بارگذاری…» فقط تأخیر ترنسفورم dev سرور بود و رفع شد |
| سرریز افقی / ظرف LTR | `/products`, `/products/:slug`, `/cart`, `/login` → هیچ‌کدام (صفر) |

### تست API — فاز ۴ (`admin-smoke.mjs` — **۵۹/۵۹ قبول**)
فایل اسکریپت: `C:\Users\Hosein\AppData\Local\Temp\opencode\admin-smoke.mjs`
(گزارش JSON در همان پوشه). دوباره‌اجراشدنی است: کوپن هر بار کد تازه می‌گیرد و
سفارش هدف را طوری انتخاب می‌کند که `SS-1405-001004` دست‌نخورده بماند.

| مورد | نتیجه |
|---|---|
| ورود مدیر / مشتری | 200 |
| `/admin/*` بدون توکن / با توکن مشتری | **401** / **403** |
| `GET /admin/stats` | 200 — درآمد، شمارش وضعیت‌ها، پرفروش‌ها، نمودار ۱۴ روزه |
| `POST /admin/products` | 201 — اسلاگ ASCII `shlvar-tst-mdyr` |
| عنوان کوتاه / قیمت صفر | **422** با پیام فارسی («مقدار واردشده کوتاه است.») |
| `POST /admin/products/:id/variants` | 201 — همان واریانت دوباره ⇒ **409** |
| `POST /admin/products/:id/images` | 201 — `url` بی‌اعتبار ⇒ **422** |
| `PATCH /admin/products/:id` قیمت+تخفیف | 200 |
| `discountPrice: 0` | تخفیف پاک شد (`discount: null`) |
| تخفیف بیشتر از قیمت | **422** «قیمت با تخفیف باید کمتر از قیمت اصلی باشد.» |
| تغییر عنوان، بدون فرستادن اسلاگ | **اسلاگ تغییر نکرد** (پیوندهای اشتراکی زنده ماندند) |
| `GET /admin/products` با `q` / `active=false` | 1 نتیجه / 0 (محصول غیرفعال از فروشگاه پنهان است) |
| ساخت/ویرایش/حذف دسته‌بندی | 201/200/204 — حذف دستهٔ در حال استفاده ⇒ **409** |
| `GET /admin/orders?status=paid` | 200 |
| `PATCH …/status` `paid→processing` | 200 — گذار **معکوس** و وضعیت ناشناس ⇒ **422** |
| `POST …/shipment` | 200 — ثبت و **اصلاح** (`SMOKE-TRACK-001` → `SMOKE-TRACK-002`) |
| مرسوله بدون شرکت حمل | **422** «این فیلد الزامی است.» |
| `GET /admin/orders/:id` | 200 — اقلام + آدرس؛ id ناموجود ⇒ **404** |
| همان سفارش از دید مشتری (`GET /orders/:id`) | کد رهگیری ثبت‌شده دیده شد |
| `GET /admin/users` | 200 — `passwordHash` **هرگز** در پاسخ نیست |
| غیرفعال‌کردن خودِ مدیر / تنزل آخرین مدیر فعال | **422** (هر دو) |
| `POST /admin/coupons` با `smk…` | 201 — کد **UPPERCASE** ذخیره شد |
| درصد بیشتر از ۱۰۰ | **422**؛ غیرفعال‌سازی کوپن ⇒ 200 |
| حذف نرم محصول | 204 — از فهرست عمومی ناپدید شد و اسلاگش **رزرو ماند** |
| فروشگاه بعد از همهٔ این‌ها | همان تعداد محصول اولیه (بدون نشت محصول تستی) |

### تست مرورگر — فاز ۴ (پذیرش؛ اسکرین‌شات ممکن نیست، چک DOM)
| گام | نتیجه |
|---|---|
| ورود مدیر از UI | `POST /auth/login → 200`، انتقال به `/`، توکن در `localStorage` |
| `/admin` (داشبورد) | چهار کارت + پنج کاشی + **۱۴ میلهٔ** نمودار، «پرفروش‌ترین محصولات»، «آخرین سفارش‌ها»، بدون خطا |
| `/admin/products` | جدول RTL: ستون «محصول» در **راست** (right=744) و «عملیات» در **چپ**؛ سرریز افقی صفحه **صفر** (`scrollWidth == clientWidth`) |
| `/admin/categories` | ۳ ردیف — ۱۸/۱۷/۱۶ محصول (جمعاً ۵۱ = ۵۰ seed + محصول تازه) |
| `/admin/users` | ۲ ردیف، موبایل/ایمیل با `dir="ltr"`، نشان «(شما)» روی ردیف خودِ مدیر |
| `/admin/coupons` | ۴ ردیف — «۵٪»، «۵۰٬۰۰۰ تومان»، «۰ از ۱»، «۰ (نامحدود)»، انقضای جلالی |
| ساخت محصول از UI | «محصول ایجاد شد.» → `/admin/products/55`؛ اسلاگ خودکار `shlvar-jyn-kargv-mrdanh-mdl-majrajv` |
| ویرایش از UI | مقادیر برگشتی درست (قیمت ۱۲۵۰۰۰۰، تخفیف ۹۹۰۰۰۰، موجودی ۲۴، دسته «شلوار مردانه»، جنسیت «مردانه»، نوع «کارگو») |
| واریانت/تصویر از UI | جدول «۳۲/مشکی/۱۰» و «۳۴/سرمه‌ای/۸ (+۵۰٬۰۰۰ تومان)»؛ تصویر با نشان «تصویر اصلی» |
| شبکه پس از افزودن واریانت | فقط `POST /admin/products/55/variants` — **بدون PATCH اضافه** (بعد از رفع باگ) |
| نمایش در فروشگاه | `/products/<اسلاگ>` — عنوان، بردکرامب «شلوار مردانه»، ۲۱٪، ۱٬۲۵۰٬۰۰۰ → ۹۹۰٬۰۰۰، «برند دنیزو» |
| حالت تاریک | `documentElement.classList` شامل `dark`, `body` = `rgb(10,17,30)`، متن `rgb(241,245,249)` |
| پذیرش نهایی (مدیر) | `SS-1405-001004`: «پرداخت‌شده» → «در حال آماده‌سازی» (تایم‌لاین ۳ گام)، مرسوله «پست پیشتاز» + `IR-1405-778812` |
| پذیرش نهایی (مشتری) | تب «سفارش‌ها» فعال؛ کارت `SS-1405-001004` بدون باز کردن جزئیات: «در حال آماده‌سازی» + «پست پیشتاز — کد رهگیری: IR-1405-778812» (`dir="ltr"`) |

### تست API — ثبت‌نام با کد پیامکی (`register-smoke.mjs` — **۱۷/۱۷ قبول**)

اسکریپت: `…\Temp\opencode\register-smoke.mjs` (قابل اجرای دوباره؛ گزارش در
`register-smoke-report.json`).

| مورد | نتیجه |
|---|---|
| شمارهٔ نامعتبر (`12345`) | **422** — «شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.» |
| `POST /auth/register/code` | 200 — `testMode: true`، کد ۶ رقمی، `expiresInSeconds = 119` |
| درخواست دوبارهٔ فوری | **429** — «کد قبلی هنوز معتبر است…» (فاصلهٔ اجباری) |
| کد اشتباه / بدون کد | **422** با پیام فارسی «کد تأیید نادرست یا منقضی شده است…» |
| ثبت‌نام با کد درست | **201** + `phoneVerifiedAt` + توکن دسترسی |
| استفادهٔ دوباره از همان کد | **422** (کد یک‌بارمصرف) |
| شمارهٔ قبلاً ثبت‌شده | **409** — «این شماره موبایل قبلاً ثبت شده است.» |
| ورود به حساب تازه + `GET /auth/me` | 200 و `phoneVerifiedAt` برگشت |
| ارقام فارسی (`۰۹۱۲…۰۲`) | همان شمارهٔ کانونیکال `09123456702` در پاسخ |

### تست مرورگر — بازبینی UI (چک DOM؛ اسکرین‌شات ممکن نیست)

| مورد | نتیجه |
|---|---|
| `/account` (پنجرهٔ ۷۸۵px) | منو بالای محتوا و **عمودی**؛ هر ۳ آیتم آیکون دارند؛ «اطلاعات کاربری» فعال؛ `[role="tablist"]` وجود ندارد |
| ذخیرهٔ پروفایل | فرم مقادیر واقعی را نشان می‌دهد: نام «مدیر فروشگاه»، موبایل `09120000000`، ایمیل `readOnly` + `disabled`، دکمهٔ «ذخیره تغییرات» |
| `/account/addresses` | ساخت آدرس از دیالوگ → «آدرس جدید ثبت شد.»؛ نشان «پیش‌فرض» و دکمهٔ حذف با فاصلهٔ **۴px** و بدون هم‌پوشانی؛ حذف از UI کار کرد و حالت خالی برگشت |
| سوئیچ پوسته | با `theme = system` و سیستم تیره: `dark` فعال ✓؛ کلیک ۱ → `light` (state `light`)، کلیک ۲ → `dark` (state `dark`)؛ هیچ `[role="menu"]` باز نشد |
| `/login` | هر دو حساب آزمایشی روی صفحه، هر دو داخل `dir="ltr"` |
| ورود مدیر | «خوش آمدید، مدیر فروشگاه!» + توکن در `localStorage` |
| `/register` (دو مرحله‌ای) | «ارسال کد» → کد `735074` روی صفحه با توضیح حالت آزمایشی و «اعتبار کد: ۲ دقیقه»؛ دکمهٔ ارسال دوباره با شمارش معکوس «(۵۸)»؛ ورودی کد و فعال شدن «ثبت‌نام» |
| ثبت‌نام کامل | کد `668566` وارد شد → «حساب شما ساخته شد، سارا آزمون!» + انتقال به `/` + توکن ذخیره شد |
| پاک‌سازی | کاربر و کدهای آزمایشی از پایگاه داده حذف شدند؛ `users` دوباره ۲ ردیف و `phone_verifications` خالی |

### تست API — تراکنش‌ها و مختصات آدرس (`transactions-smoke.mjs` — **۱۲/۱۲ قبول**)

اسکریپت در `…\Temp\opencode\transactions-smoke.mjs` (قابل اجرای مجدد؛ فقط
می‌خواند و یک آدرس آزمایشی می‌سازد/پاک می‌کند):

| چک | نتیجه |
|---|---|
| `GET /admin/payments` بدون توکن / با توکن مشتری | **۴۰۱** / **۴۰۳** |
| `GET /admin/payments` با توکن مدیر | **۲۰۰**، `total=5`، هر ردیف `orderCode` + `statusFa` + `payment` دارد |
| `?status=verified` | فقط ردیف‌های موفق برمی‌گردند (۴ از ۵) |
| `?q=<کد سفارش>` | همان سفارش پیدا می‌شود |
| `POST /addresses` با `latitude`+`longitude` | **۲۰۱** و مقدارها دقیقاً برمی‌گردند (`35.6892, 51.389`) |
| `POST /addresses` با فقط `latitude` | **۴۲۲** «برای ثبت موقعیت روی نقشه، طول و عرض جغرافیایی باید هر دو فرستاده شوند.» |
| `PATCH /addresses/:id` با `latitude:null` | نشانه پاک می‌شود (کلید در JSON غایب می‌شود چون `omitempty` است) |
| `DELETE /addresses/:id` | **۲۰۴** |

### تست مرورگر — بستهٔ درخواست کارفرما (چک DOM؛ اسکرین‌شات ممکن نیست)

| مورد | نتیجه |
|---|---|
| خانه | بخش‌های تازه رندر شدند: `#services`، `#size-guide`، `#faq`، «پرفروش‌های این فصل»، نظر مشتری‌ها؛ **۳۰ مورد** «تومان» در متن؛ امضای فوتر «حسین جعفری» ✓ |
| کادر پشتیبانی | دکمهٔ «پشتیبانی» → `aria-expanded="true"` و برچسب «بستن»؛ قاب در `left=20, bottom=80px` (پایین-چپ)؛ لینک `t.me/shalvarsara_support`، دو `tel:`، ایمیل و ساعات کاری |
| صفحه‌بندی محصولات | «نمایش ۱–۱۲ از ۵۱ محصول» → صفحهٔ ۲ → «نمایش ۱۳–۲۴ از ۵۱ محصول»؛ هیچ برچسبی بریده نمی‌شود (`scrollWidth = clientWidth` برای همهٔ ۷ دکمه)؛ دکمه‌ها ۴۰×۴۰ و «قبلی» ۶۷×۴۰ |
| چیپ‌های فیلتر | با «فقط کالاهای موجود» چیپ ساخته می‌شود، آیکون ضربدر جدا و بی‌هم‌پوشانی؛ حذف چیپ فیلتر را برمی‌گرداند |
| بازهٔ قیمت | تایپ در فیلدها `700,000` / `1,600,000` (سه‌رقمی)، کمک‌متن «از … تا …»؛ چیپ: «قیمت: از ۷۰۰٬۰۰۰ تا ۱٬۶۰۰٬۰۰۰ تومان» و با یک سر: «قیمت: از ۷۰۰٬۰۰۰ تومان» (قبلاً «بی‌نهایت» چاپ می‌کرد — رفع شد) |
| `/admin/payments` | عنوان «تراکنش‌ها»، ۵ ردیف، سرستون‌ها: سفارش/مشتری/مبلغ (تومان)/درگاه/شناسه تراکنش/وضعیت/زمان؛ همهٔ ردیف‌ها «تومان» دارند؛ «پرداخت موفق»؛ یادداشت به‌روزرسانی ۳۰ ثانیه‌ای؛ سرریز ۰ |
| `/admin/sms` | «پنل پیامکی» + «به‌زودی» + سه کارت نقشهٔ راه + اشاره به `SMS_TEST_MODE`؛ سرریز ۰ |
| کدهای تخفیف (دیالوگ) | ورودی مبلغ `7850000` را `7,850,000` نشان می‌دهد، «تومان» داخل فیلد، تراز راست؛ جدول ۴ ردیف و همه دارای «تومان»/«٪» |
| نقشهٔ آدرس | دیالوگ آدرس: کانتینر Leaflet ۴۲۱×۲۲۴ با کاشی‌های واقعی، کنترل زوم و attribution؛ کلیک روی نقشه پین می‌گذارد و `#map-lat/#map-lng` را پر می‌کند؛ «حذف نشان» پین و مقدارها را پاک می‌کند؛ ذخیره → کارت آدرس با «مشاهدهٔ نشانی روی نقشه» و لینک OSM درست (`?mlat=35.7219&mlon=51.3347`) |
| پوسته | روشن (پس‌زمینهٔ `rgb(251,252,253)`) و تیره هر دو روی صفحات تازه بررسی شد |
| پاک‌سازی | آدرس آزمایشی از UI حذف شد |

### تست ریسپانسیو (iframe هم‌مبدأ؛ چک `scrollWidth - clientWidth`)

| مسیر | ۳۶۰ / ۴۱۴ / ۷۶۸ / ۱۰۲۴ / ۱۴۴۰ | توضیح |
|---|---|---|
| `/`, `/products`, `/products/:slug`, `/cart`, `/checkout`, `/payment/result`, `/login`, `/register`, `/account`, `/account/orders`, `/account/addresses` | **۰** در همه | بدون سرریز افقی |
| `/admin/products`, `/admin/categories`, `/admin/orders`, `/admin/users`, `/admin/coupons` | **۰** | جدول `min-w-[7xx]` داخل کارت `overflow-auto` می‌ماند |
| `/admin` (۳۶۰px) | **۱۱۵px → ۰** | کارت‌های «پرفروش‌ترین محصولات»/«آخرین سفارش‌ها» `min-w-0` گرفتند |
| `/admin/orders/:id` (۳۶۰px) | **۲۴۱px → ۰** | ستون «اقلام سفارش» `min-w-0` گرفت؛ جدول داخل خودش اسکرول می‌شود |
| ناوبری موبایل هدر | دکمهٔ «منو» زیر ۱۰۲۴ دیده می‌شود و از ۱۰۲۴ پنهان است | مطابق انتظار |
| منوی حساب/ادمین | ۳۶۰: بالای محتوا؛ ۱۲۸۰: ستون چسبان در **راست** (`aside.left = 1024` حساب، `1044` ادمین) | خواستهٔ کارفرما |
| **بستهٔ کارفرما** — `/`, `/products`, `/products?sort=discount`, `/admin/payments`, `/admin/sms`, `/admin/coupons`, `/account/addresses`, `/cart`, `/login` در **۳۶۰px** | **۰** در همه | هدر مهمان ۵۰px سرریز داشت → با پنهان‌کردن متن دکمهٔ ورود زیر `sm` رفع شد (ستون «عرض کل» را ببینید) |
| دیالوگ آدرس در ۳۶۰px | قاب ۳۶۰ / نقشه ۲۶۹×۲۲۴ / سرریز داخل دیالوگ **۰** | نقشه با کاشی‌های واقعی همان‌جا هم درست جا می‌شود |

> نکتهٔ سنجش RTL: اسکرول‌بار عمودی در RTL **سمت چپ** است، پس `clientWidth`
> از عرض پنجره کمتر است؛ برای «عنصر بیرون‌زده» باید با `innerWidth` سنجید،
> نه `clientWidth`، وگرنه همهٔ کانتینرهای تمام‌عرض خطای کاذب می‌دهند.

### تست ریسپانسیو — بازبینی دوم با هارنس CDP (وین‌دوی واقعی موبایل)

`C:\Users\Hosein\AppData\Local\Temp\opencode\mobile-audit.mjs` — چون کانکتور
مرورگر روی موج درخواست‌های موازی 502 می‌دهد (بخش ۲-د)، این هارنس یک کروم
**مستقیم و بدون کانکتور** با `--headless=new --remote-debugging-port=9333`
بالا می‌آورد، با `Emulation.setDeviceMetricsOverride` عرض را **واقعاً** عوض
می‌کند (پس media queryها واقعی‌اند) و اسکرین‌شات هم می‌گیرد:

```
node mobile-audit.mjs C:\...\job.json
# job = { baseUrl, login?, widths[], routes[], shots[{name,route,width,height?,dsf?,
#          theme?, scrollY?, scrollTo?, openSupport?}] }
# خروجی: JSON شامل results (overflowPx/offenders/footerH/mounted) + مسیر فایل عکس‌ها
```

نتیجه: **۱۹ مسیر × ۴ عرض (۳۲۰/۳۶۰/۳۹۰/۴۱۲) — همه `mounted=true`،
`overflowPx=0`، هیچ عنصر بیرون‌زدهٔ کلیپ‌نشده**:

| گروه | مسیرها | نتیجه |
|---|---|---|
| فروشگاه | `/`, `/products`, `/products/:slug`, `/products?sort=discount&category=women`, `/cart`, `/checkout` | ۰ |
| حساب | `/login`, `/register`, `/account`, `/account/orders`, `/account/addresses` | ۰ |
| پنل | `/admin`, `/admin/products`, `/admin/orders`, `/admin/payments`, `/admin/users`, `/admin/coupons`, `/admin/categories`, `/admin/sms` | ۰ |

- تنها «بیرون‌زدگی»ها دو لایهٔ تزئینی‌اند (شبکهٔ نقطه‌ای و blob هیرو) که
  داخل `overflow-hidden` هیرو کلیپ می‌شوند (`clippedCount=2`، بدون اثر روی
  اسکرول).
- پنل ادمین در این عرض‌ها هم بدون سرریز است (جدول‌ها داخل کارت اسکرول می‌شوند).
- اسکرین‌شات‌های شاهد (روشن و تیره، ۳۹۰ موبایل + ۱۴۴۰ دسکتاپ) در
  `…\Temp\opencode\shots\`: دکمهٔ پشتیبانی `left=16` (موبایل) / `20`
  (دسکتاپ)، کارت پشتیبانی از همان لبه بالا باز می‌شود، آیکون نوار خدمات وسط
  متن، و اعداد بدون فاصلهٔ اضافه.

---

## ۸) نکات و ایرادهای شناخته‌شده ⚠️

1. **توکن‌ها در `localStorage` هستند** (نه httpOnly cookie). برای فاز ۱
   پذیرفتنی است، اما در فاز ۷ باید به کوکی httpOnly + CSRF منتقل شود.
2. **سه درخواست اول هر صفحه `net::ERR_ABORTED` می‌دهند.** این باگ نیست:
   `StrictMode` در حالت توسعه هر افکت را دو بار اجرا می‌کند و TanStack Query
   نسخهٔ اول را لغو می‌کند. درخواست دوم `200` می‌گیرد. در بیلد تولیدی
   رخ نمی‌دهد. **دنبالش را نگیرید.**
3. **تصاویر seed از `picsum.photos` می‌آیند** — عکس‌های تصادفی، نه شلوار
   واقعی، و نیاز به اینترنت دارند. برای جایگزینی، ردیف‌های `product_images`
   را به‌روزرسانی کنید.
4. **پرداخت کامل است، ولی فقط روی سندباکس.** دکمهٔ «ادامهٔ فرآیند خرید» در
   سبد به `/checkout` می‌رود و زنجیرهٔ سفارش → درگاه → نتیجه کار می‌کند.
   برای رفتن به درگاه واقعی فقط `ZARINPAL_SANDBOX=false` و یک
   `ZARINPAL_MERCHANT_ID` واقعی لازم است؛ کد عوض نمی‌شود.
5. **`ZARINPAL_MERCHANT_ID` یک UUID دلبخواه سندباکس است**، نه شناسهٔ واقعی.
6. **🔴 الزام کارفرما: زرین‌پال باید روی سرویس سندباکس پیاده شود.**
   `ZARINPAL_SANDBOX=true` در `.env` و `ZarinPalConfig.BaseURL()` در
   `internal/config/config.go` برای همین آماده است
   (`https://sandbox.zarinpal.com` در برابر `https://payment.zarinpal.com`).
   `ZARINPAL_MERCHANT_ID` در حالت سندباکس باید یک UUID دلبخواه باشد؛
   برای رفتن به تولید فقط همین دو مقدار عوض می‌شود، نه کد.
7. **`orders`, `order_items`, `payments`, `coupons` دیگر بدون لایهٔ Go نیستند**
   (فاز ۳ اضافه‌شان کرد). فقط `shipments`, `reviews`, `wishlists` مانده‌اند:
   `shipments` در فاز ۴ (رهگیری ارسال) و `reviews`/`wishlists` در فاز ۵.
8. **`session_id` جدول `carts` استفاده نمی‌شود.** سبد مهمان سمت مرورگر است،
   نه روی سرور. اگر روزی سبد مهمان سروری لازم شد (مثلاً اشتراک بین دستگاه‌ها)،
   همین ستون و `GetOrCreateBySession` نقطهٔ شروع است.
9. **قلم ناموجود در `subtotal` سبد حساب می‌شود**، ولی هنگام ساخت سفارش
   **قطعی** است: `CreateFromCart` اقلام را زیر قفل دوباره اعتبارسنجی می‌کند و
   سفارش با `409 out_of_stock` رد می‌شود. UI هم دکمهٔ پرداخت را غیرفعال و خط
   ناموجود را با هشدار نشان می‌دهد.
10. **سفارش‌های باقی‌مانده از تست‌ها.** سفارش‌های ۱ و ۲ دموی `pending` هستند و
    موجودی چند واریانت را رزرو کرده‌اند؛ برای آزمایش «ادامهٔ پرداخت» مفیدند.
    اگر دادهٔ تمیز می‌خواهید، `payments`/`order_items`/`orders` را خالی کنید و
    `stock`/`sold_count` را دستی برگردانید.
11. **پنل مدیریت کامل است** (فاز ۴، هم API و هم UI). دو نکتهٔ عملی:
    - ناوبری `/admin` **عمودی** است: زیر `lg` بالای محتوا (روی موبایل دو
      ستون جمع‌وجور) و از `lg` به بالا ستون چسبان در سمت راست. برای تست
      موبایل عرض پنجره را کم کنید.
    - «حذف محصول» نرم است؛ برای حذف واقعی ردیف را دستی از `products` بردارید.
12. **`frontend/.env` ساخته نشده** — مقدار پیش‌فرض `/api/v1` نسبی و درست است؛
    فقط اگر خواستید مستقیم به API وصل شوید آن را بسازید.
13. **مخزن گیت است** — شاخهٔ `main` روی ریپوی پرایوت
    `https://github.com/JafariHosein/shalvarsara` ردیابی می‌شود (commit اولیه
    `17b2b09`). احراز هویت با `gh` (نسخهٔ ۲٫۱۰۲) انجام شده و credential
    helper در کانفیگ گلوبال ست است، پس `git push` بدون پرسیدن رمز کار می‌کند.
    ⚠️ `backend/.env` در `.gitignore` است و **هرگز** نباید کامیت شود؛ فقط
    فایل‌های `.env.example` در مخزن‌اند.
14. **داده‌های تستی که در پایگاه داده مانده‌اند (همه عمدی):**
    - محصول **۵۵** («شلوار جین کارگو مردانه مدل ماجراجو»، اسلاگ
      `shlvar-jyn-kargv-mrdanh-mdl-majrajv`) محصول پذیرش فاز ۴ است و **فعال**
      مانده (۱ تصویر + ۲ واریانت). اگر نمی‌خواهید در فروشگاه بماند، از خود پنل
      حذفش کنید.
    - محصول‌های ۵۱ و ۵۳ (تست دود) حذف نرم شده‌اند، اما **اسلاگ‌شان رزرو است**؛
      اجرای دوبارهٔ اسکریپت با همان عنوان، اسلاگ `…-2` می‌سازد.
    - کوپن‌های `SMOKE5` و `SMK…` ساخته و **غیرفعال** شده‌اند (حذف کوپن وجود
      ندارد؛ غیرفعال‌کردن معادلش است).
    - دستهٔ تستی «دستهٔ آزمایشی» ساخته و حذف شده است.
    - `SS-1405-001003` و `SS-1405-001005` در وضعیت «در حال آماده‌سازی» با کد
      رهگیری `SMOKE-TRACK-002` (تیپاکس) هستند — از اسکریپت تست فاز ۴.
    - `SS-1405-001004` الان **«در حال آماده‌سازی»** با «پست پیشتاز» و
      `IR-1405-778812` است (پذیرش فاز ۴). سفارش‌های ۱ و ۲ همچنان `pending`.
    - شمارهٔ موبایل کاربر نمونه به `09121111111` تغییر کرده است.
    - حساب‌ها و کدهای آزمایشی ثبت‌نام (هم اسکریپت `register-smoke.mjs` و هم
      ثبت‌نام از UI) **از پایگاه داده پاک شدند**؛ `users` دوباره ۲ ردیف و
      `phone_verifications` خالی است. اگر دوباره تست می‌کنید، اسکریپت با
      شمارهٔ ثابت `09123456701` کار می‌کند و باید کاربر ساخته‌شده را پاک کنید.
    - آدرس تستی که در بازبینی UI ساخته شد، از خود UI حذف شد (کاربر مدیر آدرس
      ندارد).
15. **ثبت‌نام دیگر بدون شمارهٔ موبایل ممکن نیست.** شمارهٔ موبایل در فرم
    ثبت‌نام **اجباری** شد و حساب فقط با کد تأیید همان شماره ساخته می‌شود.
    حساب‌های seed (ادمین/مشتری) از قبل بودند و `phone_verified_at` ندارند؛
    این طبیعی است.
16. **`SMS_TEST_MODE=true` یعنی کد در پاسخ API برمی‌گردد.** این برای محیط
    توسعه/دمو است: صفحهٔ ثبت‌نام کد را با توضیح فارسی نشان می‌دهد. در محیط
    واقعی باید `SMS_TEST_MODE=false` شود و تابع
    `AuthService.RequestRegisterCode` به پنل پیامکی وصل شود؛ بقیهٔ مسیر
    (اعتبارسنجی، TTL، یک‌بارمصرف بودن) تغییری لازم ندارد. جدول
    `phone_verifications` کدها را نگه می‌دارد و `Verify` ردیف را قفل می‌کند تا
    دو ارسال هم‌زمان با یک کد هر دو قبول نشوند.
17. **`/login` و `/register` وقتی وارد شده‌اید به `/` هدایت می‌شوند** (رفتار
    عمدی). برای دیدن فرم‌ها اول از حساب خارج شوید یا در تب مهمان باز کنید.
18. **ناوبری حساب کاربری و پنل از `lg` ستونی می‌شود.** پنجرهٔ باریک‌تر از
    ۱۰۲۴px منو را بالای محتوا نشان می‌دهد (عمودی، ولی تمام‌عرض). اگر سایدبار
    همیشه می‌خواهید، بریک‌پوینت `lg:grid-cols-[…]` را در `pages/account.tsx`
    و `pages/admin/layout.tsx` به `md:` تغییر دهید و گرید کارت‌های آدرس را هم
    با آن هم‌تراز کنید.
19. **🔴 مقادیر تماسِ کادر پشتیبانی و فوتر **نمونه** اند.**
    `frontend/src/lib/contact.ts` تنها منبع حقیقت است: `telegram:
    "shalvarsara_support"`، `phone: "021-00000000"`، `mobile:
    "0912-000-0000"`، `support@shalvarsara.ir` و ساعات «شنبه تا پنجشنبه، ۹ تا
    ۱۸». **پیش از راه‌اندازی واقعی باید عوض شوند**؛ جای دیگری تکرار نشده‌اند.
20. **نقشهٔ آدرس به دسترسی به کاشی‌های OSM وابسته است.** اگر شبکهٔ کاربر
    `tile.openstreetmap.org` را ببندد، نقشه خاکستری می‌ماند، ولی:
    (الف) پیام «نقشه بارگذاری نشد…» نشان داده می‌شود، (ب) دو فیلد دستی
    lat/lng کار می‌کنند، (ج) ذخیرهٔ آدرس **بدون نشان** همیشه ممکن است (ستون‌ها
    nullable و زوجی‌اند). برای تغییر سرویس‌دهنده فقط `TILE_URL` در
    `components/account/address-map.tsx` عوض می‌شود.
21. **صفحهٔ «پنل پیامکی» عمداً فقط یک صفحهٔ «به‌زودی» است** — ارسال واقعی
    پیامک در `AuthService.RequestRegisterCode` نقطهٔ اتصال دارد (بخش ۸، مورد
    ۱۶). هیچ APIای برای قالب/گزارش/اعتبار ساخته نشده و نباید ساخته شود تا
    زمانی که سرویس‌دهنده انتخاب شود.
22. **🔴 کانکتور مرورگر این محیط روی موج درخواست‌های موازی 502 می‌دهد.**
    اگر بعد از رفرش صفحه **سفید** ماند و `#root` خالی بود، این باگ کد نیست:
    کانکتور (پروکسی) مرورگر دسکتاپ در موج ~۱۰۰ ماژول SPA بخشی را 502
    برمی‌گرداند و چون ماژول شکست‌خورده دوباره تلاش نمی‌شود، اپ mount
    نمی‌شود. شاهد: درخواست‌های **سری** (۴ تا با ۴۰۰ms فاصله) همیشه ۲۰۰
    می‌دهند؛ `Invoke-WebRequest` از PowerShell هم ۲۰۰ می‌دهد. راهکار: یک بار
    دیگر رفرش کنید؛ برای تست خودکار از هارنس CDP (بخش ۷) استفاده کنید که
    کانکتور را دور می‌زند. **این را باگ فرانت‌اند حساب نکنید.**

---

## ۹) کارهای باقی‌مانده — فازبندی‌شده

هر فاز را کامل و تست‌شده تحویل بده، بعد سراغ بعدی برو.

> **فازهای ۱ تا ۴** و **دو بستهٔ درخواست کارفرما** (بازبینی UI/ثبت‌نام پیامکی،
> و بعد بستهٔ پشتیبانی/قیمت/صفحه‌بندی/تراکنش/نقشه/محتوا) انجام و تست شده‌اند
> — بخش ۶.
> فاز بعدی **فاز ۵ (نظرات و علاقه‌مندی‌ها)** است.

### فاز ۴ — پنل مدیریت ✅ (تمام و تست‌شده — بخش ۶)
- [x] CRUD محصولات، گونه‌ها، تصاویر، موجودی
- [x] مدیریت سفارش‌ها و وضعیت‌ها (+ `shipments` و نمایش کد رهگیری به مشتری)
- [x] مدیریت کاربران (فعال/غیرفعال، نقش)
- [x] مدیریت کوپن‌ها (ساخت/ویرایش/غیرفعال‌سازی + `used_count`)
- [x] داشبورد آماری: فروش، تعداد سفارش، پرفروش‌ها، نمودار ۱۴ روزه
- [x] همه‌چیز زیر `RequireAdmin`
- [x] **معیار پذیرش:** مدیر از UI محصول ساخت/ویرایش کرد (محصول ۵۵)، سفارش
      `SS-1405-001004` را به `processing` برد، کد رهگیری ثبت کرد و مشتری همان
      را در تب «سفارش‌ها» دید ✅
- ⏳ **مدیریت نظرات عمداً به فاز ۵ موکول شد** — هیچ نظری وجود ندارد که
  مدیریت شود؛ صفحهٔ مدیریتش هم‌زمان با خودِ نظرات ساخته می‌شود.

### فاز ۵ — نظرات و علاقه‌مندی‌ها 🔴 فاز بعدی
- [ ] ثبت نظر (فقط خریداران تأییدشده)، لیست، امتیاز میانگین
- [ ] `wishlists` در UI
- [ ] **مدیریت نظرات در پنل:** تب «نظرات» با تأیید/رد
      (جدول `reviews` از فاز ۱ آماده است؛ `AdminStats` جای اضافه‌کردن شمارنده
      نظرات در انتظار تأیید را دارد)

### فاز ۶ — آپلود تصویر
- [ ] آپلود تصویر محصول (دیسک محلی برای dev، قابل سوئیچ به S3)
- [ ] بهینه‌سازی و اعتبارسنجی نوع/حجم فایل

### فاز ۷ — کیفیت و امنیت
- [ ] تست‌های Go: واحد برای service، یکپارچه برای repository
- [ ] Vitest + Testing Library برای کامپوننت‌های کلیدی
- [ ] CI (GitHub Actions): `go vet`, `go test`, `npm run build`
- [ ] مهاجرت refresh token به کوکی httpOnly + محافظت CSRF
- [ ] هدرهای امنیتی (CSP، HSTS) و محدودیت نرخ روی مسیرهای عمومی

---

## ۱۰) قراردادهای کد (رعایتشان الزامی است)

### مسیرهای API
```
/api/v1/health, /api/v1/health/ready
/api/v1/auth/{register,register/code,login,refresh,logout,me,password}
/api/v1/users/me                      (GET, PATCH)
/api/v1/addresses/                    (GET, POST)  + /:id (PATCH, DELETE)
                                      ← `latitude`/`longitude` اختیاری ولی زوجی (۴۲۲ اگر تنهایی بیایند)
/api/v1/cart/                         (GET, DELETE)          ← همه زیر RequireAuth
/api/v1/cart/items                    (POST)
/api/v1/cart/items/:id                (PATCH, DELETE)
/api/v1/cart/merge                    (POST)
/api/v1/orders/preview                (POST)                ← زیر RequireAuth
/api/v1/orders/                       (POST, GET)
/api/v1/orders/:id                    (GET)
/api/v1/orders/:id/payment            (GET)
/api/v1/payments/request              (POST)                ← زیر RequireAuth
/api/v1/payments/callback             (GET)                 ← عمومی: بازگشت مرورگر از درگاه
/api/v1/categories
/api/v1/products/                     + /suggest + /:slug + /:slug/related

# پنل مدیریت — همه زیر RequireAuth + RequireAdmin
/api/v1/admin/stats                   (GET)
/api/v1/admin/products                (GET, POST)   ← لیست شامل غیرفعال‌ها
/api/v1/admin/products/:id            (GET, PATCH, DELETE)   ← حذف نرم
/api/v1/admin/products/:id/variants   (POST)
/api/v1/admin/variants/:id            (PATCH, DELETE)
/api/v1/admin/products/:id/images     (POST)
/api/v1/admin/images/:id              (PATCH, DELETE)
/api/v1/admin/categories              (POST)
/api/v1/admin/categories/:id          (PATCH, DELETE)   ← دستهٔ در حال استفاده ⇒ 409
/api/v1/admin/orders                  (GET)
/api/v1/admin/orders/:id              (GET)
/api/v1/admin/orders/:id/status       (PATCH)
/api/v1/admin/orders/:id/shipment     (POST)
/api/v1/admin/users                   (GET)
/api/v1/admin/users/:id               (PATCH)
/api/v1/admin/coupons                 (GET, POST)
/api/v1/admin/coupons/:id             (PATCH)
/api/v1/admin/payments                (GET)   ← تراکنش‌ها: q + status + page/limit
```

**قرارداد پنل (رعایتش را در UI فرض بگیر):**
- `PATCH` **ادغام جزئی** است: فیلد `null`/غایب یعنی «دست نزن».
  استثنا: `discountPrice: 0` تخفیف را پاک می‌کند و `clearExpiry: true` انقضای
  کوپن را.
- اسلاگ **فقط** هنگام ساخت یا وقتی صریحاً فرستاده شود بازتولید می‌شود؛ تغییر
  عنوان پیوند اشتراکی را نمی‌شکند. اسلاگ‌ها همیشه ASCII هستند.
- `DELETE /admin/products/:id` **نرم** است (`is_active=false` + `deleted_at`).
- گذار وضعیت سفارش یک‌طرفه است:
  `pending→{paid,canceled}`، `paid→{processing,canceled}`،
  `processing→{shipped,canceled}`، `shipped→{delivered}`؛
  `delivered`/`canceled` پایانه‌اند. لغو، موجودی را برمی‌گرداند و
  `sold_count` را کم می‌کند. ثبت مرسوله روی سفارش `paid` آن را خودکار به
  `processing` می‌برد.
- خطای گاردهای انسانی (غیرفعال‌کردن خودت، تنزل آخرین مدیر) **۴۲۲** با پیام
  فارسی است.

**پاسخ پرداخت (`POST /payments/request`)** — فرانت پیش از ترک SPA آن را در
`sessionStorage` نگه می‌دارد:
```json
{ "paymentId","orderId","orderCode","authority","gatewayUrl",
  "amountRial","sandbox": true }
```
`gatewayUrl` همان `https://sandbox.zarinpal.com/pg/StartPay/<authority>` است.
بازگشت درگاه همیشه با کد ۳۰۳ به
`<ZARINPAL_RESULT_URL>?order=<id>&status=ok|failed|error` می‌رود و وضعیت در
**query string** است، نه در بدنه — صفحهٔ نتیجه خودش سفارش را از API دوباره
می‌خواند تا نمایش به وضعیت واقعی پایگاه داده وابسته بماند.

**قاعدهٔ قیمت‌گذاری:** `POST /orders/preview` پاسخ `OrderPreview` می‌دهد
(`subtotal`, `discount`, `shippingCost`, `total`, `items`, `couponCode`) و
`POST /orders` دقیقاً همان محاسبه را انجام می‌دهد و نتیجه را ذخیره می‌کند.
هیچ‌جای فرانت مبلغی نمی‌سازد.

**شکل پاسخ سبد (همهٔ endpointها یکسان، تا کلاینت کش را یک‌جا جایگزین کند):**
```json
{ "items": [ { "id","productId","variantId","slug","title","image",
               "unitPrice","listPrice","size","color",
               "quantity","maxQuantity","lineTotal","isAvailable" } ],
  "itemCount": 4, "subtotal": 3800000 }
```
`POST /cart/merge` تنها استثناست و `{"cart": {…}, "skipped": 1}` برمی‌گرداند
(`skipped` = تعداد خطوطی که به‌خاطر ناموجودی منتقل نشدند).

**ترتیب ثبت مسیر مهم است:** `/products/suggest` باید **قبل** از
`/products/:slug` ثبت شود وگرنه خورده می‌شود.

### قالب خطا (همه‌جا)
```json
{ "error": { "code": "…", "message": "پیام فارسی", "details": { … } } }
```
کدهای موجود: `validation_error`، `not_found`، `unauthorized`، `forbidden`،
`invalid_credentials`، `conflict`، `out_of_stock`، `empty_cart`،
`invalid_coupon`، `coupon_min_order`، `payment_failed`، `internal_error`،
`too_many_requests`، `request_error`، `invalid_verification_code` (کد پیامکی
ثبت‌نام: نادرست/منقضی/استفاده‌شده).

نگاشت خطا فقط در یک جا انجام می‌شود: `internal/httpx/response.go`
(`MapError`). اگر خطای سرویس یک `model.UserFacingError` باشد، **کد و وضعیت
همان خطای سنجه‌ای** می‌ماند و فقط `message` با `Text` عوض می‌شود
(مثال: `coupon_min_order` که به `ErrInvalidCoupon` باز می‌شود).

### کد فرانت
- مسیر ایمپورت: `@/*` → `src/*`
- همهٔ رشته‌های UI **فارسی**؛ اعداد با توابع `src/lib/format.ts` فارسی می‌شوند
- قیمت‌ها با کامپوننت `Price`، تصاویر همیشه با `SmartImage`
- هر کامپوننت shadcn را از `src/components/ui` ایمپورت کنید، نه از اینترنت
- **RTL:** از خصوصیات منطقی استفاده کنید (`ps-*`, `pe-*`, `ms-*`, `me-*`)
  و از `left/right` فیزیکی پرهیز کنید
- **RTL — آیکون‌ها:** آیکون جهت‌دار را با **معنای LTR** بنویسید و با
  `rtl:-scale-x-100` آینه کنید (`ChevronRight` = «بعدی» ⇒ در RTL «<»).
  برای «جلو/بیشتر» در این سایت `ArrowLeft` بدون آینه درست است.
- **RTL — انیمیشن:** کلاس‌های `slide-in-from-*` / `slide-out-to-*`
  **فیزیکی**اند. برای `side="start"` (که در RTL یعنی لبهٔ راست) باید
  `slide-in-from-right` داد و برای `side="end"` باید `slide-in-from-left`.
- **ارقام:** نمایش همیشه فارسی (`formatNumber`، `formatRating`،
  `toFaDigits`)؛ ورودی/دیتابیس/API لاتین می‌ماند («نرمال‌سازی در ورودی،
  هرگز در نمایش»). هر متن دادهٔ ترکیبی (عنوان محصول، سایز، برچسب واریانت،
  توضیح) هنگام **نمایش** از `toFaDigits` می‌گذرد. کدهای لاتین (کد سفارش،
  `refId`، `cardPan`، تلفن، ایمیل، کد پستی) داخل `dir="ltr"` می‌مانند و
  «کد کالا» با `dir="auto"`.
- متن‌های «فقط شلوار» را جایگزین متن‌های عمومی نکنید؛ هویت برند است

### نام‌گذاری
- فایل‌های Go: تک‌کلمهٔ کوچک (`product.go`)، پکیج‌ها: `repository/service/handler`
- فایل‌های React: `kebab-case.tsx`، کامپوننت‌ها: `PascalCase`
- جدول‌های SQL: جمع و snake_case

---

## ۱۱) تله‌ها و درس‌های گرفته‌شده

| تله | راه‌حل |
|---|---|
| import cycle بین `handler` و `middleware` | کد مشترک در `internal/httpx` |
| `PaginationLinkProps` به `React.ComponentProps<"a">` نیاز داشت | اصلاح شد |
| پروکسی Vite روی `localhost` شکست می‌خورد | `127.0.0.1` + توضیح IPv6 در بالا |
| در تست مرورگر، `querySelector('form button[type=submit]')` **دکمهٔ جست‌وجوی هدر** را می‌گیرد (اولین در DOM) | از `input[type=email].closest('form')` شروع کن |
| `browser.press({key:"Enter"})` فرم را ارسال نمی‌کند | دکمه را با `evaluate` کلیک کن |
| تب‌های مرورگر بین فراخوانی‌ها ناپدید می‌شوند | همهٔ کارها در یک `execute` |
| کنسول برای متن فارسی mojibake می‌دهد | خروجی را در فایل بنویس و با `read` بخوان |
| `.ps1` با متن فارسی | ذخیره به‌صورت UTF-8 **با BOM** |
| `npm` در PowerShell بلاک است | `cmd /c "npm …"` |
| `go` روی PATH ارثی نیست | `$env:Path = "C:\Program Files\Go\bin;" + $env:Path` |
| نصب‌کنندهٔ گرافیکی PostgreSQL پشت UAC معلق ماند | با winget نصب شد و سرویس بالا آمد |
| PowerShell 5.1 کوتیشن‌های داخلی JSON را به `curl.exe` **حذف‌شده** پاس می‌دهد → بدنهٔ ناقص و 422 | بدنه را در فایل بنویس و `--data-binary "@file"` بده |
| `Set-Content -Encoding UTF8` در PowerShell 5.1 **BOM** می‌گذارد و JSON را خراب می‌کند | `[IO.File]::WriteAllText($p, $c, (New-Object System.Text.UTF8Encoding $false))` |
| `curl -o` فایل را **قبل از** خواندن `--data-binary @همان فایل` خالی می‌کند | فایل درخواست و پاسخ را جدا کن |
| زیر `StrictMode` افکت mount دو بار اجرا می‌شود → ادغام سبد مهمان دو بار و دوبرابر شدن تعدادها | گارد in-flight روی `syncGuestCart()` |
| منوی کشویی Radix با `element.click()` باز نمی‌شود (به `pointerdown` نیاز دارد) | از `browser.click({ref})` با رفر از snapshot استفاده کن |
| در سندباکس Code Mode تابع `setTimeout` وجود ندارد | برای انتظار از `browser.wait` استفاده کن، نه تأخیر زمانی |
| `browser.evaluate` گزینهٔ `awaitPromise` ندارد، پس `await fetch(...)` کار نمی‌کند | برای آماده‌سازی داده در همان صفحه از `XMLHttpRequest` **سنکرون** (`open(..., false)`) استفاده کن |
| رفرهای snapshot بعد از هر رندر دوباره عوض می‌شوند (مثلاً بعد از اعمال کوپن) | پیش از هر کلیک، snapshot تازه بگیر و رفر را از همان بگیر |
| نشست مرورگر بین `127.0.0.1:5173` و `localhost:5173` مشترک **نیست** (مبدأ متفاوت است) | کل سناریوی خرید را روی همان مبدأ‌ای اجرا کن که `ZARINPAL_RESULT_URL` دارد (`localhost:5173`) |
| جدول `orders` ستون `coupon_code` ندارد (فقط `coupon_id`) | کد کوپن را از `coupons` بخوان یا join بزن؛ حین دیباگ با psql وقت تلف نکن |
| فوتر و منوی کاربر به `/account/orders` لینک می‌دادند و آن مسیر ۴۰۴ می‌شد | تب‌های حساب کاربری ارزش را از URL می‌خوانند و تغییر تب هم URL را عوض می‌کند |
| `CHECK (stock >= 0)` روی `products`/`product_variants` کل تراکنش را شکست می‌دهد | گاردهای صریح (`WHERE stock >= $n` و `FOR UPDATE`) خط اول دفاع‌اند، نه قید پایگاه داده |
| ستاره‌های امتیاز «توی هم» می‌رفتند و کلیپ درصدی غلط می‌شد | ردیف پرشده داخل جعبهٔ کلیپ به‌عنوان flex فشرده می‌شد → `w-max` + `shrink-0` روی آیکون‌ها |
| `rtl:-scale-x-100` روی چورون‌ها نتیجهٔ **برعکس** می‌داد | آیکون را با معنای LTR بنویس («بعدی» = `ChevronRight`) و آینه کن |
| `slide-in-from-*` در `sheet.tsx` با `start/end` هم‌تراز نبود → دراور از وسط صفحه وارد می‌شد | سمت منطقی و ترنسفورم فیزیکی را دستی هم‌تراز کن؛ برای تست، **فریم شروع** انیمیشن را بسنج (`x = ±width`) |
| رادیکس بدون `DirectionProvider` جهت را LTR فرض می‌کند | در `main.tsx` با `dir="rtl"` بپیچ |
| `getBoundingClientRect` روی عنصر در حال ترنزیشن مقدار میانی/کهنه می‌دهد | مقدار `--tw-translate-x` را بخوان؛ custom property آنی به مقدار نهایی می‌رسد |
| در تب مخفی (که اسکرین‌شات هم ممکن نیست) انیمیشن‌های CSS جلو نمی‌روند | به هندسهٔ چیدمان و فریم شروع انیمیشن تکیه کن، نه به پایان انیمیشن |
| `browser.screenshot` بدون پنجرهٔ دسکتاپ قابل‌مشاهده خطا می‌دهد (`Screenshot needs a visible tab`) | چک‌ها را با `browser.evaluate` روی DOM بساز (هندسه/کلاس/`getComputedStyle`) |
| `browser.snapshot` با `depth > 20` خطای validation می‌دهد و کلید `maxDepth` را نمی‌شناسد | فقط `{ tabID, depth: ≤20 }` |
| `FormControl` دور **چند** عنصر (`<div><span/>+<Input/></div>`) بسته شود، `Slot` شناسه را به `div` می‌دهد → برچسب به ورودی وصل نیست و کلیک روی برچسب فوکوس نمی‌دهد | `FormControl` را فقط دور خودِ `Input` بپیچ؛ چیدمان را با یک `div` خواهر بچین |
| دیالوگ رادیکس با اینکه در portal رندر می‌شود، رویداد `submit`ش در **درخت React** بالا می‌رود → اگر درخت والد داخل یک `<form>` باشد، فرم والد هم ذخیره می‌شود (PATCH ناخواسته + توست اضافه) | مدیران دیالوگ‌دار (`VariantManager`، `ImageManager`) را **بیرون** از تگ `<form>` رندر کن؛ تأیید با `browser.network.list` |
| برای `Select` رادیکس، `element.click()` کار نمی‌کند (pointerdown لازم است) و برای تست چند کلیک رفت‌وبرگشتی لازم می‌شود | در `browser.evaluate` از `__reactFiber$` روی trigger بالا برو تا اولین فایبری که `memoizedProps.onValueChange` دارد و همان را با مقدار دلخواه صدا بزن |
| `document.querySelector("[data-sonner-toast]")` **اولین/قدیمی‌ترین** توست را می‌گیرد و توست‌ها بعد از ~۴ ثانیه محو می‌شوند | برای گرفتن تازه‌ترین توست همه را بپیمای (`[...querySelectorAll]`)، یا بهتر: وضعیت واقعی DOM را بسنج نه توست را |
| لیبل وضعیت `processing` در فرانت «در حال پردازش» بود ولی بک‌اند در پیام‌هایش «در حال آماده‌سازی» می‌گفت | برچسب‌های وضعیت را از بک‌اند (`statusFa`) و فرانت (`ORDER_STATUS_LABELS`) یکسان نگه دار |
| انداختن `FormControl`/`Label` روی دیالوگی که فرمش با `requestSubmit()` ارسال می‌شود، فقط با `id` پایدار قابل انتخاب است | دیالوگ‌ها شناسهٔ صریح بده (`#shipment-carrier`) تا تست شکننده نشود |
| ستون آخر جدول در RTL (سمت چپ) می‌تواند از کادر بیرون بزند | جدول را `min-w-[720px]` + ظرف `overflow-auto` بده؛ سرریز باید در جدول بماند، نه در صفحه (`scrollWidth == clientWidth` را بسنج) |
| **آیتم grid با `min-width: auto`** نمی‌تواند کوچک‌تر از محتوایش شود؛ یک جدول `min-w-[520px]` داخلش، **کل صفحه** را از عرض موبایل بیرون می‌برد (`/admin` ۱۱۵px و `/admin/orders/:id` ۲۴۱px سرریز داشتند) | به آیتم grid کلاس `min-w-0` بده تا اسکرول داخل خود کارت بماند؛ ابتدا با `documentElement.scrollWidth - clientWidth` سرریز را پیدا کن، بعد با فهرست عناصر بیرون‌زده مقصر را |
| در RTL اسکرول‌بار **سمت چپ** است، پس `documentElement.clientWidth` از عرض پنجره کمتر است؛ سنجش «عنصر بیرون‌زده» با `clientWidth` همهٔ کانتینرهای تمام‌عرض را خطای کاذب می‌کند | برای مقایسه از `window.innerWidth` استفاده کن (یا `right > innerWidth + 1`)؛ خودِ `scrollWidth - clientWidth` درست است |
| `browser.evaluate` با `location.assign(...)` **وسط اجرا** قطع می‌شود («Inspected target navigated or closed») و بقیهٔ اسکریپت اجرا نمی‌شود | ناوبری را در یک `evaluate` جدا انجام بده و در فراخوانی بعدی صفحه را بسنج |
| در تست مرورگر `document.querySelector('form').requestSubmit()` **فرم جست‌وجوی هدر** را می‌فرستد (اولین `form` در DOM است) و صفحه به `/products` می‌رود | فرم مقصد را با `input.closest("form")` یا `form[novalidate]` بگیر |

---

## ۱۲) قدم بعدی پیشنهادی

**۱) کار کوچکِ باقی‌مانده از بستهٔ کارفرما (۱۰ دقیقه):** مقادیر نمونهٔ تماس در
`frontend/src/lib/contact.ts` را با شماره/شناسهٔ واقعی جایگزین کنید — کادر
پشتیبانی، فوتر و صفحهٔ پرسش‌های پرتکرار همه از همان یک فایل می‌خوانند.

**۲) فاز ۵ (نظرات و علاقه‌مندی‌ها)** — فاز ۴ و هر دو بستهٔ کارفرما کامل و
پذیرفته شده‌اند. حالا دو قابلیت باقی‌ماندهٔ سند اصلی:

1. **نظرات:** جدول `reviews` از فاز ۱ وجود دارد.
   - `GET /products/:slug/reviews` (صفحه‌بندی‌شده، عمومی) و
     `POST /products/:id/reviews` (**فقط خریدار تأییدشده**: یک `order_item`
     با `product_id` یکسان و سفارش `delivered` داشته باشد؛ وگرنه ۴۲۲ فارسی).
   - به‌روزرسانی `products.rating` و `reviews_count` بعد از هر تأیید.
   - سابقهٔ خرید را از `order_items` بگیر، نه از `orders` (تطبیق محصول لازم است).
   - **مدیریت نظرات در پنل:** تب «نظرات» زیر `/admin`, تأیید/رد؛ یک قلم به
     `ORDER_STATUS_STYLES`مانند **در `components/admin` اضافه نکن** — از همان
     الگوی `products.tsx` (جدول + فیلتر وضعیت) استفاده کن.
2. **علاقه‌مندی‌ها:** `wishlists` از فاز ۱ آماده است.
   - `GET/POST/DELETE /wishlist` زیر احراز هویت + قلب روی `product-card`.
   - تب «علاقه‌مندی‌ها» در `/account`.

نکات آماده برای ادامه:

- برای تست، ادمین `admin@example.com` / `Admin@12345` و مشتری
  `customer@example.com` / `Customer@12345` (موبایل `09121111111`).
- سرور API با `go run ./cmd/api` از `backend/` بالا می‌آید و روی
  `127.0.0.1:8080` گوش می‌دهد (لاگ: `…\Temp\opencode\api.log`). **هر تغییر Go
  نیاز به ری‌استارت دارد**؛ پورت را با `Get-NetTCPConnection -LocalPort 8080`
  پیدا و پروسه را بکش.
- Vite روی `http://localhost:5173` است و `/api` را به `127.0.0.1:8080` پروکسی
  می‌کند. تست مرورگر را روی همان `localhost:5173` بزن.
- **🔴 یادآوری کارفرما:** همهٔ تست‌های زرین‌پال روی **سندباکس** انجام شود
  (`ZARINPAL_SANDBOX=true`)، نه درگاه واقعی.
- سفارش‌های ۱ و ۲ همچنان `pending` هستند — برای آزمایش «پرداخت دوباره» به کار
  می‌آیند؛ لازم نیست پاکشان کنی. محصول ۵۵ محصول پذیرش فاز ۴ است و اگر
  نمی‌خواهی در فروشگاه بماند، از پنل حذفش کن.
- اگر روی ثبت‌نام کار می‌کنی: `SMS_TEST_MODE=true` کد را در پاسخ API
  برمی‌گرداند و صفحهٔ ثبت‌نام نشانش می‌دهد؛ اسکریپت `register-smoke.mjs` در
  `…\Temp\opencode` کل جریان (۱۷ چک) را دوباره اجرا می‌کند. برای اجرای مجدد،
  اول کاربر/کدهای قدیمی را پاک کن (شماره‌ها با `0912345670x` شروع می‌شوند).
- **ریسپانسیو:** تست اگرمی که در بخش ۷ توضیح داده شده (`iframe` هم‌مبدأ با
  عرض دلخواه + سنجش `scrollWidth - clientWidth`) را برای هر صفحهٔ تازه تکرار
  کن؛ ارزان‌تر و دقیق‌تر از تغییر اندازهٔ پنجره است.
- تاریخچهٔ گیت راه‌اندازی شده: ریپوی پرایوت `JafariHosein/shalvarsara`، شاخهٔ
  `main` همگام با `origin/main`. پس از هر فاز، commit و push بزن
  (`git add -A` → `git commit -m "…"` → `git push`). پیش از کامیت مطمئن شو
  `backend/.env` استیج نشده باشد (`git status --short`).

پس از پایان هر فاز: این فایل را به‌روزرسانی کنید — بخش ۶ را تیک بزنید،
شواهد تست را به بخش ۷ اضافه کنید و فاز انجام‌شده را از بخش ۹ حذف کنید.
