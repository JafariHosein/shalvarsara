# شلوارسرا — کارهای باقی‌مانده و مشکلات

> یادداشت کاری پروژه. **پیش از هر کار این فایل را بخوان.**
>
> آخرین به‌روزرسانی: **۲۷ مهر ۱۴۰۵** — **بازبینی کامل و رفع باگ (فاز ۷)**
> فازهای ۱ تا ۵ و سه بستهٔ درخواست کارفرما انجام و در مرورگر تأیید شده‌اند
> (تاریخچهٔ کامل در گیت). یک پاس کامل روی بک‌اند/دیتابیس/فرانت انجام شد:
> باگ‌های منطقی، امنیتی و UI رفع شدند، مهاجرت `000005_integrity_hardening`
> ساخته و اعمال شد، و زیرساخت تست اضافه شد.
> **وضعیت سبز:** `go build` / `go vet` / `gofmt` / `go test` (۱۹ فایل تست،
> ۹۴ تست) و `npm run typecheck` / `npm run test` (۲۲۵ تست، ۱۲ فایل) /
> `npm run build` — همه exit 0. CI در `.github/workflows/ci.yml`.
> **فاز بعدی: فاز ۶ — آپلود تصویر.** نقشهٔ کار و تصمیم‌های باز در بخش ۱.
>
> پروژه: فروشگاه اینترنتی **فقط شلوار**، فارسی و RTL، تم سفید/آبی + دارک.
> فرانت: React 18 + Vite 5 + TS + Tailwind 3.4 + shadcn/ui. بک: Go 1.23 + Fiber v2
> + PostgreSQL 16 + JWT. پول همه‌جا **عدد صحیح تومان** است؛ تبدیل به ریال **فقط** در
> یک ثابت (`rialPerToman` در `internal/service/payment.go`) و هیچ‌جای دیگر.

---

## ۰) نتیجهٔ بازبینی کامل (فاز ۷) — چه چیزی عوض شد

بخش‌های ۱ و ۲ پایین‌تر دست‌نخورده مانده‌اند (کارهای آینده و تله‌های محیط). این
فهرست، کارهای **انجام‌شدهٔ** همین پاس است. هر مورد با تست یا بررسی روی سرور
زنده تأیید شده است.

### بحرانی

1. **دو بار پرداخت/دو بار ثبت سفارش (race).**
   `PaymentRepository.Complete` حالا به‌روزرسانی سفارش را با
   `WHERE id = $1 AND status = 'pending'` گارد می‌کند و اگر صفر ردیف عوض شد
   `model.ErrConflict` می‌دهد؛ `PaymentService.Callback` آن را می‌گیرد، تلاش را
   «ناموفق» علامت می‌زند و پیام فارسی «قابل پرداخت نیست / تا ۷۲ ساعت بازگشت»
   می‌دهد و `Paid` را ست **نمی‌کند**. پیش‌تر دو کال‌بک هم‌زمان می‌توانستند هر دو
   موفق شوند.
2. **سبد خالی ≠ سفارش تکراری.** `OrderRepository.CreateFromCart` حالا
   `tag.RowsAffected()` حذف سبد را چک می‌کند و در صفر `model.ErrEmptyCart`
   برمی‌گرداند. این همان گاردی است که کلیک دوباره روی «پرداخت» را بی‌خطر می‌کند.
3. **اعتبارسنجی پروکسی/نرخ.** `router.go` با
   `EnableTrustedProxyCheck` + `TrustedProxies` + `EnableIPValidation` بالا
   می‌آید و محدودکنندهٔ نرخ دو لایه شد: سطل بر اساس IP (۲۰/دقیقه) و سطل بر
   اساس هویت هش‌شده (۱۰/دقیقه). هدر `X-Forwarded-For` وقتی
   `TRUST_PROXY_HEADER=false` است خوانده **نمی‌شود**، پس با جعل هدر نمی‌شود
   سطل تازه گرفت.
4. **رازهای JWT قالبی روی بوت رد می‌شوند.** `config.validate()` هر دو راز را
   ≥۳۲ کاراکتر می‌خواهد و مقادیر `change-me`/`example`/`please` را رد می‌کند.
   در production همچنین `ZARINPAL_MERCHANT_ID` غیرنمونه و
   `SMS_TEST_MODE=false` الزامی است. `backend/.env` محلی با
   `scripts/gen-secrets.ps1` ساخته شد.

### امنیت

5. **شمارش کاربران در ورود بسته شد.** `Login` اول bcrypt را مقایسه می‌کند
   (در نبود کاربر با یک `dummyHash`) و **بعد** پیام «غیرفعال است» را می‌دهد؛
   زمان پاسخ دیگر فرق نمی‌کند.
6. **خروج/تغییر رمز/تغییر نقش، توکن‌های قبلی را باطل می‌کند.**
   `users.token_version` اضافه شد؛ `Claims` فیلد `ver` دارد؛ `RequireAuth` و
   `Refresh` ناهم‌خوانی را ۴۰۱ می‌کنند. `Logout` و `ChangePassword` و
   `UpdateAccess` (نقش/فعال‌بودن) نسخه را بالا می‌برند. refresh هم در هر
   استفاده **چرخش** می‌کند.
7. **`ADMIN_PASSWORD` پیش‌فرض ندارد.** seeder دیگر `Admin@12345` را حدس
   نمی‌زند؛ در production با مقدار خالی خطا می‌دهد و در توسعه هشدار می‌دهد و
   ادمین نمی‌سازد. `render.yaml` هم به `sync: false` تغییر کرد.
8. **محدودیت تلاش کد پیامکی واقعی شد.** سقف ۵ تلاش حالا **به ازای
   `(موبایل، هدف)` در بازهٔ یک‌ساعت** شمرده می‌شود (قبلاً per-row بود و با
   درخواست کد تازه صفر می‌شد).
9. **`ILIKE` در همهٔ جستجوها escape می‌شود.** `likePattern()` + `ESCAPE '\'`
   در `product`/`admin_product`/`admin_user`/`admin_order`/`admin_coupon`/
   `admin_payment`/`admin_review`. جستجوی `%` دیگر همه‌چیز را برنمی‌گرداند.
10. **کلیدهای آپلود/تصویر.** `validateImageURL` مسیر ریشه‌دار (`/products/…`)
    را قبول و `//evil.example` را رد می‌کند (هم بک‌اند هم اسکیمای فرانت).
11. **`docker-compose.yml` پورت Postgres را به `127.0.0.1` می‌بندد** (قبلاً
    روی `0.0.0.0` بود و روی Wi‑Fi عمومی در دسترس کل شبکه).
12. **هدرهای امنیتی nginx در هر location تکرار می‌شوند.** nginx با اولین
    `add_header` محلی، ارث‌بری را قطع می‌کند؛ پس `nosniff`/`X-Frame-Options`/
    `Referrer-Policy` در `= /healthz` و `/assets/` و `/` هر سه آمده‌اند.

### داده و منطق

13. **`orders.coupon_code` ذخیره می‌شود.** قبلاً کد کوپن در سفارش نمی‌ماند و
    فاکتور/رسید بی‌کد بود؛ حالا INSERT آن را می‌نویسد و `orderColumns` با
    `COALESCE(NULLIF(o.coupon_code,''), c.code, '')` می‌خواند.
14. **لغو سفارش، مصرف کوپن را برمی‌گرداند.** `admin_order.go` داخل تراکنش
    `used_count = GREATEST(used_count - 1, 0)` می‌زند.
15. **سفارش‌های pending منقضی می‌شوند.** `ExpirePendingOrders` +
    `startOrderExpirySweeper` در `cmd/api/main.go` (هر ۵ دقیقه، پیش‌فرض
    `ORDER_EXPIRY=30m`، با `0` خاموش). لاگ واقعی:
    `INF expired unpaid orders orders=1`.
16. **آمار پنل دیگر pending را درآمد نمی‌شمارد.** `paidStatuses` در
    `admin_stats.go` و `total_spent` کاربر؛ باکت‌های روزانه هم به
    `AT TIME ZONE 'Asia/Tehran'` پین شدند.
17. **`pending → paid` از پنل ممکن نیست.** فقط `PaymentRepository.Complete`
    می‌تواند `paid` بگذارد (`CanTransition` اصلاح شد) تا ادمین نتواند
    سفارشی را بدون تراکنش «پرداخت‌شده» کند.
18. **موجودی محصول با گونه‌ها هم‌گام می‌شود.** `SyncProductStock` در
    ساخت/ویرایش/حذف گونه داخل تراکنش. تأیید زنده:
    `product stock=18 sum(variants)=18 -> IN STEP`.
19. **امتیاز محصول بعد از بازبینی نظر بازمحاسبه می‌شود** و
    `AdminSetStatus` یک تراکنش شد (قبلاً دو تراکنش جدا).
20. **`PATCH` ادمین واقعاً جزئی است.** `AdminVariantInput` و
    `AdminImageInput` به اشاره‌گر تغییر کردند (`*string`/`*int32`/`*bool`)؛
    هر فیلد `nil` دست‌نخورده می‌ماند. **باگ واقعی که این رفع کرد:** دکمهٔ
    «اصلی کن» در گالری فقط `isPrimary` را می‌فرستد و بقیهٔ فیلدها صفر
    می‌شدند (`stock=0` یعنی «ناموجود»). تأیید زنده روی سرور: پچ تک‌فیلدی،
    همهٔ فیلدهای دیگر را حفظ می‌کند و تعداد تصویر اصلی همیشه ۱ می‌ماند.

### مهاجرت `000005_integrity_hardening`

`orders.coupon_code TEXT NOT NULL DEFAULT ''` (+ backfill)،
`users.token_version INT NOT NULL DEFAULT 0`، و ۱۲ ایندکس:
`users_email_lower_uniq`، `coupons_code_upper_uniq`،
`product_images_one_primary_idx` (UNIQUE جزئی روی `is_primary`)،
`users_phone_key`، و ایندکس‌های FK روی
`order_items.product_id`/`cart_items.variant_id`/`wishlists.product_id`/
`reviews.user_id`/`orders.address_id`/`orders.coupon_id`/`payments.status`/
`shipments.status`. فایل `.down.sql` آینهٔ دقیق است.

> **مسیر بازگشت تأیید شد** (`scripts/verify-rollback.cmd` روی یک دیتابیس
> دورریز): `up` → ۵ مهاجرت/۱۷ جدول، `down` → ۴ مهاجرت و `coupon_code` رفت،
> `up` دوباره → برگشت، `down all` → ۰ مهاجرت. `go run ./cmd/migrate down`
> حالا آرگومان می‌گیرد (`up` | `down [N|all]`) — `internal/database/migrate.go`
> تابع `Rollback` گرفت و قفل advisory روی **یک** کانکشن گرفته می‌شود
> (قبلاً روی pool بود و unlock بی‌اثر می‌شد).

### فرانت‌اند

21. **خروج اجباری در همان تب کار می‌کند.** رویداد `AUTH_CLEARED_EVENT` از
    `lib/token.ts` می‌آید؛ رویداد `storage` هرگز در همان تب شلیک نمی‌شود، پس
    قبلاً UI تا رفرش بعدی «وارد» می‌ماند.
22. **پاک‌سازی کامل کش هنگام خروج.** `resetSession()` حالا
    `queryClient.clear()` می‌زند؛ قبلاً فقط کلید سبد پاک می‌شد و علاقه‌مندی/
    سفارش/آدرس کاربر قبلی روی مرورگر مشترک دیده می‌شد.
23. **چرخهٔ رفرش توکن بی‌پایان نیست.** `api.ts` با
    `retried: true` + `AbortSignal.timeout(10s)` یک بار تلاش می‌کند و بار دوم
    ۴۰۱ را بالا می‌دهد.
24. **صفحهٔ نتیجهٔ پرداخت وضعیت‌های پرداخت‌شده را می‌شناسد.**
    `isPaidOrderStatus` روی `paid|processing|shipped|delivered`؛ قبلاً فقط
    `paid` بود و مشتری‌ای که انبار سفارشش را جلو برده بود، پیام «پرداخت انجام
    نشد» می‌دید.
25. **کوپن معتبر با یک تلاش ناموفق پاک نمی‌شود.** `applyCoupon.onError` دیگر
    `setCoupon("")` نمی‌زند — کوپنِ اعمال‌شده سر جایش می‌ماند.
26. **سفارش بی‌درگاه، مشتری را گم نمی‌کند.** اگر `orders` ساخته شد ولی
    `payments/request` شکست خورد، به `/account/orders` می‌رود (سبد همان لحظه
    خالی شده است) و پیام فارسی می‌گیرد.
27. **`disabled` روی `Button asChild` بی‌اثر بود.** در `cart.tsx` و
    `checkout.tsx` حالا در حالت غیرفعال یک `<button disabled>` واقعی رندر
    می‌شود، نه `<Link>`.
28. **صفحهٔ سبد از قیمت سرور می‌خواند.** با `useOrderPreview` (مبلغ، تخفیف و
    ارسال سروری)؛ `lib/shipping.ts` فقط برای مهمان فالبک است.
29. **سبد خطادیده «خالی» نشان داده نمی‌شود.** `useCart` حالا `isError` و
    `refetch` می‌دهد و صفحهٔ سبد دکمهٔ «تلاش دوباره» دارد.
30. **rollback خوش‌بینانهٔ سبد، جهش‌های دیگر را خراب نمی‌کند.** فقط مقدار قبلی
    همان یک قلم برمی‌گردد، نه کل snapshot سبد.
31. **فرم محصول با هر refetch بازنویسی نمی‌شود.** `seededId` فقط یک‌بار seed
    می‌کند؛ قبلاً ویرایش‌های ذخیره‌نشدهٔ ادمین با هر تغییر گونه/تصویر پاک
    می‌شد.
32. **انتقال سبد مهمان نتیجه‌اش گزارش می‌شود.** تعداد اقلام ناموجودشده
    («X کالا منتقل نشد») یا هشدار شکست کل انتقال.
33. **`imageSchema`/`imageUrlSchema` مسیر نسبی را قبول می‌کنند** (قبلاً
    `.url()` بود و ویرایش هر ۱۸۶ تصویر seed شکست می‌خورد).
34. **`FormData` در `api.ts` دیگر `{}` نمی‌شود** (`http.upload` اضافه شد،
    آمادهٔ فاز ۶).

### زیرساخت تست و CI

- **Go:** ۱۹ فایل `*_test.go`، ۹۴ تست سطح‌بالا / ~۵۳۰ زیرتست (`go test ./...`).
- **فرانت:** Vitest + Testing Library، ۲۲۵ تست در ۱۲ فایل، `jsdom`،
  `src/test/setup.ts` (شیم `localStorage` برای Node ۲۲+ که بدون
  `--localstorage-file` مقدار `undefined` می‌دهد).
- **CI:** `.github/workflows/ci.yml` — سه جاب: `backend`
  (`go mod tidy` + gofmt + vet + build + `go test -race`)، `frontend`
  (typecheck + test + build) و `migrations` که مهاجرت‌ها را روی یک
  PostgreSQL 16 واقعی بالا و **پایین** می‌آورد و نبود/بودن ستون‌ها و ایندکس‌ها
  را assert می‌کند.
  > ⚠ **این فایل هنوز کامیت نشده است.** توکن `gh` این مخزن فقط
  > `repo`/`gist`/`read:org` دارد و گیت‌هاب اجازهٔ افزودن فایل زیر
  > `.github/workflows/` را بدون اسکوپ `workflow` نمی‌دهد:
  > `refusing to allow an OAuth App to create or update workflow … without
  > workflow scope`. برای فعال‌کردن CI یکی از این‌ها:
  > `gh auth refresh -s workflow` و بعد کامیت و پوش؛ یا ساخت فایل از خود
  > گیت‌هاب (Actions → New workflow)؛ یا استفاده از PAT با اسکوپ `workflow`.
  > تا آن موقع CI اجرا نمی‌شود و چیز دیگری به آن وابسته نیست.
- **اسکریپت‌های بررسی محلی** (همه در `scripts/`، بدون مسیر مطلق و قابل اجرا
  پس از انتقال مخزن): `check-backend.cmd`، `fmt-backend.cmd`،
  `check-frontend.cmd`، `check-frontend-full.cmd`، `db-verify.cmd`،
  `verify-fixes2.ps1` (API)، `verify-patch.ps1` (PATCH جزئی ادمین)،
  `verify-rollback.cmd`، `verify-images.cmd`، `gen-secrets.ps1`،
  `start-api.cmd`، `stop-api.cmd` و `_pg-env.cmd` (پیدا کردن `psql` و
  پارامترهای مشترک اتصال).
  > اسکریپت‌های `verify-*.ps1` رمز ادمین را از `$env:ADMIN_PASSWORD`
  > می‌خوانند و اگر ست نشده باشد با پیام روشن خارج می‌شوند — هیچ رمزی داخل
  > مخزن نیست.

> ⚠️ **`go test -race` روی این سیستم اجرا نمی‌شود** چون هیچ کامپایلر C نصب
> نیست (`CGO_ENABLED=0` و `gcc`/`clang`/`cl` هیچ‌کدام نیستند). در CI (اوبونتو)
> با `-race` اجرا می‌شود. برای اجرای محلی: یک mingw-w64 نصب کن و
> `CGO_ENABLED=1 go test -race ./...`.

---

## ۱) کارهای باقی‌مانده

### فاز ۶ — آپلود تصویر (فاز بعدی) — نقشهٔ آماده، **شروع‌نشده**


**وضعیت فعلی (بررسی‌شده):** هیچ کد آپلود، هیچ روت استاتیک، هیچ کتابخانهٔ تصویری و
هیچ کلید کانفیگی وجود ندارد — کار از صفر است.
`POST /admin/products/:id/images` فقط JSON می‌گیرد و `url` را **بی‌کم‌وکاست**
ذخیره می‌کند (`service/admin.go:398`)، ولی تگ اعتبارسنجی `required,url` است
(`model/admin.go:41`) ⇒ فقط URL **مطلق** قبول می‌شود. جدول `product_images` هیچ
UNIQUE و هیچ قید «تک‌primary» ندارد (`migrations/000001_init.up.sql:109-118`).

**تصمیم‌هایی که پیش از کدنویسی باید قطعی شوند** (پیشنهاد من کنار هرکدام):

1. **ذخیره‌سازی:** پکیج تازهٔ `internal/storage` با اینترفیس
   `Save(io.Reader, opts) (key, error)` / `Delete(key)` و پیاده‌سازی دیسک روی
   `UPLOAD_DIR` (پیش‌فرض `backend/uploads/` — از قبل در `.gitignore:40` رزرو است).
   سوئیچ بعدی به S3 فقط پیاده‌سازی همین اینترفیس است.
2. **شکل URL:** در DB **نسبی** (`/uploads/<key>`) ذخیره شود — هم‌سو با ردیف‌های
   موجود — و نمایش از هِلپر فرانت `mediaUrl()` با `VITE_MEDIA_BASE_URL` (پیش‌فرض
   خالی) بگذرد تا استقرار جدا (فرانت روی Pages، API روی Render) هم کار کند.
   ذخیرهٔ URL مطلق یعنی هاست در دیتابیس پخته می‌شود؛ **نکنید**.
3. **بهینه‌سازی: سمت مرورگر** (همان زنجیرهٔ canvas/WebP موجود). دلیل فنی:
   `go.mod` هیچ دیکودر/انکودر تصویری ندارد، بیلد `CGO_ENABLED=0` است
   (`backend/Dockerfile:15`) و انکودر WebP خالص-Go پرریسک است. سرور فقط
   **اعتبارسنجی** می‌کند: امضای محتوا با `mimetype` (همین حالا گذرا در
   `go.mod` هست)، سقف حجم، و پسوند از روی محتوا — نه نام فایل کاربر.
4. **ساخت ردیف:** خودِ اندپوینت آپلود، فایل **و** ردیف را با هم می‌سازد و مثل
   `CreateImage` کل `Product` را برمی‌گرداند (هوک‌های فرانت به همین قرارداد
   تکیه دارند). فیلدهای multipart: `file` + `alt` + `isPrimary` + `sortOrder`.
5. **نام‌گذاری:** آپلودها فضای نامهٔ جدا بگیرند
   `/uploads/<productID>/<hash8>-<slug>.webp`. الگوی
   `{type}-{color}-{a|b|c}-{n}` مال تولید دسته‌ای ۷۲۰×۹۰۰ در باندل فرانت است و
   منطقش در سه جا تکرار شده؛ برای آپلود تک‌تک مناسب نیست.
6. **محدودیت‌ها:** `UPLOAD_MAX_BYTES` (پیش‌فرض ۳MB)، انواع `webp` (مسیر اصلی) و
   `png`/`jpeg` (جایگزین)؛ `BodyLimit` پیش‌فرض فایبر (۴MB) بالا برود و در
   `nginx.conf` هم `client_max_body_size` ست شود. `sortOrder` پیش‌فرض = «بیشترین
   موجود + ۱» (نه صفر) تا بین ردیف‌های هم‌ترتیب نپرد.

**بک‌اند — فایل‌هایی که تغییر می‌کنند:** `internal/config/config.go` + هر دو
`.env.example`؛ پکیج تازهٔ `internal/storage`؛ `handler/admin.go` (هندلر multipart)
؛ `model/admin.go` (اینپوت بدون `required,url`)؛ `service/admin.go`
(اعتبارسنجی → ذخیره → `CreateImage`)؛ `router/router.go` (روت آپلود + سرو
`/uploads/*`)؛ `cmd/api/main.go` (تزریق وابستگی).

**فرانت — فایل‌هایی که تغییر می‌کنند:** `lib/api.ts` (مسیر غیر-JSON لازم است)،
`services/admin.ts`، `hooks/use-admin.ts`، `components/admin/image-manager.tsx`
(ورودی فایل + پیش‌نمایش، کنار ورودی URL فعلی)، `lib/schemas.ts`، `types/api.ts`.

**سرو کردن فایل در dev و prod:** `vite.config.ts` پروکسی `/uploads` →
`127.0.0.1:8080`؛ `nginx.conf` لوکیشن `/uploads/` (proxy به سرویس backend) +
`client_max_body_size`؛ اگر API داخل کانتینر می‌نویسد، در `docker-compose.yml`
یک volume به `backend/uploads` بدهید وگرنه با هر ری‌استارت پاک می‌شود.

**تست پذیرش:** (۱) `curl` multipart با توکن ادمین → ۲۰۱ + ردیف ساخته‌شده؛
(۲) فایل بزرگ‌تر از سقف و فایل با نوع نادرست → خطای فارسی (۴۲۲/۴۱۳)؛ (۳) آپلود
واقعی از UI و دیدن عکس در گالری **و** صفحهٔ محصول، روشن/تیره؛ (۴) عکس‌های
`/products/…` موجود دست‌نخورده بمانند؛ (۵) بقای فایل بعد از ری‌استارت API.

### فاز ۷ — کیفیت و امنیت

- [x] تست‌های Go: واحد برای `model`/`config`/`service`/`httpx`/`zarinpal` و
      `repository` (هلپرهای خالص) + `handler` (اعتبارسنجی ورودی‌های ادمین) +
      `cmd/migrate`. **باقی‌مانده:** تست **یکپارچه** برای `repository` با
      دیتابیس واقعی (نیاز به testcontainers یا یک DATABASE_URL تست).
- [x] Vitest + Testing Library برای کامپوننت‌ها و لایهٔ lib.
- [x] CI (GitHub Actions): gofmt + vet + build + `go test -race`،
      typecheck + test + build، و اعمال/بازگشت مهاجرت‌ها روی Postgres ۱۶.
- [ ] مهاجرت refresh token از `localStorage` به کوکی httpOnly + محافظت CSRF.
      (بخشی از ریسک کم شد: refresh حالا در هر استفاده می‌چرخد و
      `token_version` توکن‌های قدیمی را باطل می‌کند.)
- [x] محدودیت نرخ روی مسیرهای عمومی/اعتباری (دو سطل: IP + هویت).
- [ ] هدرهای امنیتی **کامل**: CSP و HSTS هنوز نه. `nginx.conf` فقط
      `nosniff`/`X-Frame-Options`/`Referrer-Policy`/`X-XSS-Protection` دارد.
      CSP نیاز به مرور دارد چون نقشهٔ OSM و فونت‌ها منابع خارجی‌اند.

### پیش‌نمایش مشتری از داخل ایران — **CDN آروان روی Render** (راهنمای گام‌به‌گام: `DEPLOY-ARVAN.md`)

انتخاب کاربر: به‌جای میزبان ایرانی، همان استقرار Render می‌ماند و یک دامنه از طریق
CDN رایگان آروان به پاپ‌های ایران می‌آید. دامنه: **`h3in.ir`** (فروشگاه) و
**`api.h3in.ir`** (API)؛ کاربر می‌تواند NS را عوض کند. کارهای مخزن **انجام شده**
(کامیت «آروان روی Render: آی‌پی واقعی کاربر پشت پروکسی + راهنمای CDN رایگان»):
`TRUST_PROXY_HEADER`/`PROXY_HEADER` در بک‌اند، `TRUST_PROXY_HEADER=true` و
`CORS_ORIGINS` کامل در `render.yaml`، و `DEPLOY-ARVAN.md`.
**وضعیت: دامنه/NS/رکوردها/دامنهٔ اختصاصی Render/SSL/کش/env دامنه‌ای همه انجام شده
و `https://h3in.ir` و `https://api.h3in.ir/api/v1/health` از ایران ۲۰۰ می‌دهند.**
باقی‌مانده فقط سه چیز است:

- [x] آروان: «افزودن دامنهٔ جدید» با `h3in.ir` (بدون `www`/`http`) → ست کردن
      **`c.ns.arvancdn.ir`** و **`u.ns.arvancdn.ir`** در `my.nic.ir` →
      «بررسی نام‌سرور». ⚠ قبلش رکوردهای MX/ایمیل را چک کن (دامنه الان
      `NXDOMAIN` است، یعنی هیچ رکورد فعالی ندارد).
- [x] رکوردها **با ابر خاموش**: `www` و `api` به دامنه‌های `onrender.com`، ریشه
      (`@`) به مقدار A‌ای که خود Render می‌دهد.
- [x] در Render، دامنهٔ اختصاصی هر دو سرویس را اضافه کن (`h3in.ir` +
      `www.h3in.ir` روی سرویس وب، `api.h3in.ir` روی API) و صبر کن Verified + گواهی
      صادر شود. **اگر این را نکنی، آروان باید `Host` را بازنویسی کند و Render
      ۴۰۴ می‌دهد** (لبهٔ Render با `Host` مسیریابی می‌کند).
- [x] ابر آروان را روشن کن + SSL را روی حالت کامل + هدایت اجباری HTTPS.
- [x] کش: برای دامنهٔ API **کامل خاموش** (وگرنه ۳۰۲ مسیر
      `/api/v1/payments/callback` ممکن است به کاربر دیگری برود)؛ برای فروشگاه
      `/assets/*` طولانی و `index.html` کوتاه/بدون کش.
- [x] **بعد از زنده شدن دامنه** سه مقدار باقی‌مانده را عوض کن:
      `ZARINPAL_CALLBACK_URL` → `https://api.h3in.ir/api/v1/payments/callback`،
      `ZARINPAL_RESULT_URL` → `https://h3in.ir/payment/result`،
      `VITE_API_BASE_URL` → `https://api.h3in.ir/api/v1` + **rebuild با «Clear
      build cache»** برای سرویس وب. (`CORS_ORIGINS` از قبل دامنه را دارد؛ عمداً
      این سه تا را **پیش از** زنده شدن دامنه عوض نکردیم تا پیش‌نمایش onrender
      نشکند.)
- [x] `render.yaml` را با همین سه مقدار هم‌سان کن و پوش کن.
- [ ] 🔴 **rebuild سرویس وب** — `Manual Deploy → Clear build cache & deploy`.
      تا این کار نشود، باندل زنده هنوز `https://shalvarsara-api.onrender.com/api/v1`
      را صدا می‌زند (`VITE_API_BASE_URL` در زمان build پخته می‌شود) و صفحه باز
      می‌شود ولی **هیچ داده‌ای نمی‌آید** (دقیقاً همان حالتی که کاربر دید).
- [ ] گرم نگه داشتن API با پینگر رایگان هر ۵ دقیقه (UptimeRobot/cron-job.org) —
      وگرنه اولین بازدید مشتری ممکن است از سمت آروان تایم‌اوت بخورد.
- [ ] تست بدون VPN از موبایل: صفحهٔ اصلی، محصول، سبد، لاگین، پرداخت سندباکس،
      پنل ادمین.

### کارهای کوچک پیش از راه‌اندازی

- [ ] 🔴 مقادیر تماس در `frontend/src/lib/contact.ts` **نمونه**اند (شناسهٔ تلگرام،
      `021-00000000`، `0912-000-0000`، ایمیل، ساعات کاری). کادر پشتیبانی، فوتر و
      پرسش‌های پرتکرار همه از همین یک فایل می‌خوانند؛ فقط همین‌جا عوض شود.
- [ ] `ZARINPAL_MERCHANT_ID` واقعی (فعلاً یک UUID دلبخواه سندباکس است).
- [ ] اتصال پنل پیامکی: `SMS_TEST_MODE=false` + وصل کردن
      `AuthService.RequestRegisterCode` به سرویس‌دهنده.
- [ ] یک بار ری‌استارت API برای اعمال `CORS_ORIGINS` جدید (سرور در حال اجرا با
      مقدار قدیمی بالا آمده؛ در توسعه اهمیت ندارد چون همه‌چیز same-origin است).
- [ ] (اختیاری) پاک‌سازی داده‌های تستی پایگاه داده — فهرست پایین.

### داده‌های تستی مانده در پایگاه داده (همه عمدی)

- محصول **۵۵** (پذیرش فاز ۴) **فعال** است: «شلوار جین کارگو مردانه مدل ماجراجو»،
  اسلاگ `shlvar-jyn-kargv-mrdanh-mdl-majrajv` (۱ تصویر + ۲ گونه). اگر نباید در
  فروشگاه بماند، از پنل حذفش کنید.
- محصول‌های ۵۱ و ۵۳ حذف نرم شده‌اند ولی **اسلاگ‌شان رزرو** است (همان عنوان ⇒
  `…-2`).
- کوپن‌های `SMOKE5` و `SMK…` ساخته و **غیرفعال** شده‌اند.
- `SS-1405-001003` و `SS-1405-001005`: «در حال آماده‌سازی» با کد رهگیری
  `SMOKE-TRACK-002`.
- `SS-1405-001004`: «در حال آماده‌سازی» با «پست پیشتاز» و `IR-1405-778812`.
- سفارش‌های ۱ و ۲ (دمو) همچنان `pending` — برای آزمایش «ادامهٔ پرداخت» به کار
  می‌آیند؛ لازم نیست پاک شوند.
- سفارش ۹ برای `customer@example.com` در وضعیت `delivered` (محصول‌های ۷ و ۴۸)؛
  همان کاربر یک نظر تأییدشده روی محصول ۷ و دو علاقه‌مندی (محصول‌های ۷ و ۴۹) دارد.
- صف «در انتظار تأیید» نظرات بعد از تست‌ها به ~۹ رسید (برای پرترشدن، چند ردیف
  `reviews.status` را دستی `pending` کنید).
- موبایل کاربر نمونه `09121111111` است. کاربر/کدهای آزمایشی ثبت‌نام پاک شده‌اند
  (`users` دو ردیف، `phone_verifications` خالی).
- برای دادهٔ تمیز: `payments`/`order_items`/`orders` را خالی کنید و
  `stock`/`sold_count` را دستی برگردانید.

---

## ۲) مشکلات شناخته‌شده

1. **توکن‌ها در `localStorage` هستند** (نه httpOnly cookie) — فاز ۷ باید منتقل کند.
2. **اول هر صفحه ~۳ درخواست `net::ERR_ABORTED` می‌دهد.** باگ نیست: `StrictMode`
   در توسعه هر افکت را دو بار اجرا می‌کند و TanStack Query نسخهٔ اول را لغو
   می‌کند؛ درخواست دوم ۲۰۰ می‌گیرد و در بیلد تولیدی رخ نمی‌دهد.
   **دنبالش را نگیرید.**
3. **پرداخت کامل است، ولی فقط روی سندباکس تست شده.** برای درگاه واقعی فقط
   `ZARINPAL_SANDBOX=false` + `ZARINPAL_MERCHANT_ID` واقعی لازم است؛ کد عوض نمی‌شود.
4. 🔴 **الزام کارفرما: زرین‌پال روی سرویس سندباکس بماند**
   (`ZARINPAL_SANDBOX=true` و `ZarinPalConfig.BaseURL()`). همهٔ تست‌های پرداخت
   روی سندباکس انجام شود، نه درگاه واقعی.
5. **تصاویر محصولات عکس واقعی و بخشی از مخزن‌اند:** ۲۴۰ فایل WebP شفاف (~۹٫۵MB)
   در `frontend/public/products/`؛ منبع هر عکس در `SOURCES.md`. چون کات‌اوت‌اند،
   در تم تاریک هم باکس سفید نمی‌سازند. برای عکس تازه کافی است ردیف
   `product_images` را به همان الگوی نام عوض کنید.
   دو عکس کلاژ هیرو (`frontend/public/hero/hero-{1,2}.webp`) هم از این پس
   کات‌اوت شفاف «شلوار تاشده»اند (۸۰۰×۸۰۰ WebP، قاب `aspect-square`)؛ PNG
   اصلی‌شان روی دسکتاپ کارفرما است و در مخزن نیست.
6. **همهٔ جدول‌ها لایهٔ Go دارند** (هیچ جدولی بدون repository نمانده). بالا
   آوردن API بدون seed، فروشگاه خالی می‌دهد ولی خطا نمی‌دهد (`SEED_ON_START=false`).
7. **ستون `carts.session_id` استفاده نمی‌شود** — سبد مهمان سمت مرورگر است. اگر
   روزی سبد مهمان سروری لازم شد، همین ستون و `GetOrCreateBySession` نقطهٔ شروع است.
8. **قلم ناموجود در `subtotal` سبد حساب می‌شود**، ولی هنگام ساخت سفارش **قطعی**
   است: `CreateFromCart` اقلام را زیر قفل دوباره اعتبارسنجی می‌کند و با
   `409 out_of_stock` رد می‌شود. UI هم دکمهٔ پرداخت را غیرفعال می‌کند.
9. **حذف محصول نرم است و کوپن «حذف» ندارد** — `DELETE /admin/products/:id` فقط
   `is_active=false` + `deleted_at` می‌گذارد (تا `order_items` قدیمی سالم بماند) و
   کوپن فقط غیرفعال می‌شود. برای حذف واقعی ردیف را دستی از پایگاه داده بردارید.
10. **`frontend/.env` ساخته نشده** — مقدار پیش‌فرض `/api/v1` نسبی و درست است؛ فقط
    برای اتصال مستقیم به API آن را بسازید.
11. **مخزن گیت است:** ریپوی پرایوت `JafariHosein/shalvarsara`، شاخهٔ `main`.
    احراز هویت با `gh` ست شده و `git push` بدون پرسیدن رمز کار می‌کند.
    ⚠️ `backend/.env` در `.gitignore` است و **هرگز** نباید کامیت شود؛ فقط
    `.env.example`ها در مخزن‌اند.
12. **ثبت‌نام بدون شمارهٔ موبایل ممکن نیست** — شماره اجباری است و حساب فقط با کد
    تأیید همان شماره ساخته می‌شود. حساب‌های seed (ادمین/مشتری) از قبل بوده‌اند و
    `phone_verified_at` ندارند؛ طبیعی است.
13. **`SMS_TEST_MODE=true` یعنی کد در پاسخ API برمی‌گردد** (کد ۶ رقمی با توضیح
    فارسی روی صفحهٔ ثبت‌نام). برای تولید `SMS_TEST_MODE=false` + اتصال پنل پیامکی؛
    بقیهٔ مسیر (TTL ۲ دقیقه، یک‌بارمصرف، ۵ تلاش، فاصلهٔ ۶۰ ثانیه) تغییر لازم ندارد.
14. **`/login` و `/register` وقتی وارد شده‌اید به `/` می‌روند** (عمدی). برای دیدن
    فرم اول خارج شوید یا در تب مهمان باز کنید.
15. **ناوبری حساب کاربری و پنل از `lg` ستونی می‌شود** (زیر ۱۰۲۴px منو بالای محتوا،
    عمودی و تمام‌عرض). برای سایدبار همیشه: بریک‌پوینت `lg:grid-cols-[…]` را در
    `pages/account.tsx` و `pages/admin/layout.tsx` به `md:` تغییر دهید و گرید
    کارت‌های آدرس را هم‌تراز کنید.
16. **نقشهٔ آدرس به کاشی‌های OSM وابسته است.** اگر شبکهٔ کاربر ببندد، پیام فارسی
    نشان داده می‌شود، دو فیلد دستی lat/lng کار می‌کنند و ذخیرهٔ آدرس بدون نشان
    همیشه ممکن است (ستون‌ها nullable و زوجی‌اند). تغییر سرویس‌دهنده = `TILE_URL`
    در `components/account/address-map.tsx`.
17. **صفحهٔ «پنل پیامکی» عمداً فقط یک «به‌زودی» است** — تا انتخاب سرویس‌دهنده،
    هیچ API قالب/گزارش/اعتبار نسازید. نقطهٔ اتصال ارسال واقعی همان مورد ۱۳ است.
18. 🔴 **کانکتور مرورگر این محیط روی موج درخواست‌های موازی 502 می‌دهد.** اگر بعد
    از رفرش `#root` خالی ماند، باگ کد نیست: هر سند تازهٔ SPA ~۱۰۰ ماژول را با هم
    می‌آورد و ماژول 502شده دوباره تلاش نمی‌شود (رفرش هم همان موج را تکرار می‌کند).
    درخواست‌های **سری** (۴ تا با ۴۰۰ms فاصله) همیشه ۲۰۰ می‌دهند. راهکار: هارنس CDP
    پایین که کانکتور را دور می‌زند. **این را باگ فرانت‌اند حساب نکنید.**

19. **جدول نظرات پنل `table-fixed` است و ستون‌ها را تدریجی مخفی می‌کند** —
    تاریخ زیر `xl`، مشتری زیر `md`، محصول و وضعیت زیر `sm` (هر کدام همراه با
    هدِر خودش). عمدی است تا کادر اسکرول افقی نخورد؛ باگ نیست.
20. ~~**ویرایش عکس موجودِ محصول در پنل امروز شکست می‌خورد**~~ — **رفع شد.**
    تگ `required,url` حذف شد و جایش `validateImageURL` آمد که مسیر ریشه‌دار را
    هم قبول می‌کند؛ اسکیمای فرانت هم `imageUrlSchema` شد. تأیید زنده:
    ذخیرهٔ مجدد `/products/cargo-navy-a-2.webp` → ۲۰۰، `//evil.example` → ۴۲۲.

21. 🔴 **تبرهای آروان+Render در دامنهٔ اختصاصی: دامنه را در Render اضافه کن *قبل از*
    روشن کردن ابر آروان.** اگر ابر آروان روشن باشد و گواهی آن دامنه در Render صادر
    نشده باشد، یک «مرغ و تخم‌مرغ» رخ می‌دهد: آروان برای انجام اعتبارسنجی گواهی باید
    درخواست را به مبدأ برساند، ولی مبدأ گواهی ندارد ⇒ اعتبارسنجی شکست می‌خورد و
    گواهی هیچ‌وقت صادر نمی‌شود. **علامت تشخیص:** دامنه از پشت آروان **۵۰۲ ثابت**
    می‌دهد (نه تایم‌اوت)، در همان لحظه‌ای که خود `shalvarsara-api.onrender.com`
    سلامت است. با این دستور می‌شود دامنهٔ گواهی‌نداشته را از سلامت جدا کرد:
    `curl.exe -s -o NUL -w "%{http_code}" --resolve api.h3in.ir:443:216.24.57.16 https://api.h3in.ir/api/v1/health`
    (`000` = گواهی نیست، `200`/`301` = گواهی روی لبهٔ Render سرو می‌شود.)
    **راه‌حل:** ابر همان رکورد را خاموش کن → در Render دامنه را اضافه/تأیید کن و صبر
    کن Verified + گواهی صادر شود → بعد ابر را روشن کن.

22. **رمز مدیر در `render.yaml` دیگر نیست.** به `sync: false` تغییر کرد؛ رمز را
    باید در پنل Render (Environment) وارد کنی. اگر خالی بماند، API در production
    بالا می‌آید ولی **حساب ادمین ساخته نمی‌شود** و seeder هشدار می‌دهد
    (این عمدی است: پیش‌تر یک رمز نمونهٔ منتشرشده روی پنل زنده بود).

23. **`SMS_TEST_MODE` پیش‌فرضش `false` شد.** برای ثبت‌نام محلی باید در
    `backend/.env` آن را `true` بگذاری (همین حالا ست است). در production با
    `true` سرور بالا نمی‌آید.

24. **`docker compose up` بدون فایل `.env` هم کار می‌کند.** هر دو سرویس
    `env_file` را `required: false` گرفتند و پیش‌فرض‌های داخل compose کافی‌اند.
    پورت Postgres هم به `127.0.0.1` بسته شد.

### تله‌هایی که در کد دوباره گاز می‌گیرند

- **تصویر/WebP روی این سیستم فقط با کروم:** `System.Drawing` (GDI+) نه WebP
  می‌خواند و نه می‌نویسد. هر کار تصویری (حذف پس‌زمینه، کراپ، WebP) را با کروم
  headless و canvas انجام بده؛ نمونهٔ آماده: `…\Temp\opencode\hero-make.mjs`.
  خروجی canvas را با `btoa()` به base64 ببر وگرنه فایل خالی ذخیره می‌شود.
- **RTL:** فقط خصوصیات منطقی (`ps-*`, `pe-*`, `ms-*`, `me-*`). آیکون جهت‌دار را با
  **معنای LTR** بنویس و با `rtl:-scale-x-100` آینه کن («بعدی» = `ChevronRight` ⇒
  در RTL «<»). `slide-in-from-*`/`slide-out-to-*` **فیزیکی**اند و باید دستی با
  `side` هم‌تراز شوند. `DirectionProvider dir="rtl"` در `main.tsx` الزامی است.
- **آیکون داخل ورودی و پدینگش باید هم‌جهت باشند** (`start-3`/`ps-9` یا
  `end-3`/`pe-9`)؛ وگرنه آیکون روی متن می‌نشیند.
- **آیتم grid بدون `min-w-0`** با یک جدول پهن، **کل صفحه** را از عرض موبایل بیرون
  می‌برد. سرریز را با `documentElement.scrollWidth - clientWidth` پیدا کن و مقصر
  را از فهرست عناصر بیرون‌زده بگیر. (در RTL اسکرول‌بار سمت چپ است، پس برای «عنصر
  بیرون‌زده» با `window.innerWidth` بسنج، نه `clientWidth`.)
- **ارقام:** نمایش همیشه فارسی (`formatNumber`, `formatRating`, `toFaDigits`)؛
  ورودی/دیتابیس/API لاتین می‌ماند. کدهای لاتین (کد سفارش، `refId`, `cardPan`,
  تلفن، ایمیل) داخل `dir="ltr"` می‌مانند. کلاس `tabular-nums` را برنگردان
  (ارقام جدولی وزیرمتن ۲۶٪ عریض‌ترند و جداکنندهٔ هزارگان را تمام‌عرض می‌کنند).
- **دیالوگ رادیکس داخل `<form>`** رویداد `submit` را در درخت React بالا می‌برد و
  فرم والد هم ذخیره می‌شود (PATCH ناخواسته). مدیرهای دیالوگ‌دار را **بیرون** از
  تگ `<form>` رندر کن.
- **`FormControl` را فقط دور خودِ `Input`** بپیچ، نه دور چند عنصر؛ وگرنه برچسب به
  ورودی وصل نمی‌شود.
- برچسب‌های وضعیت را بین بک‌اند (`statusFa`) و فرانت (`ORDER_STATUS_LABELS`)
  یکسان نگه دار (`processing` = «در حال آماده‌سازی»).
- **`lib/api.ts` هر body را اجباراً JSON می‌کند** (`Content-Type: application/json`
  + `JSON.stringify`) ⇒ برای آپلود فایل (فاز ۶) باید یک مسیر/گزینهٔ تازه اضافه
  شود، وگرنه `FormData` بی‌صدا به `{}` تبدیل می‌شود.

---

## ۳) برای شروع کار

### اجرا

```powershell
# go روی PATH ارثی نیست — همیشه پیشوند بزن:
$env:Path = "C:\Program Files\Go\bin;" + $env:Path

# بار اول
powershell -ExecutionPolicy Bypass -File scripts/dev-db.ps1    # نقش/دیتابیس/pg_trgm
cd "D:\Projects\E-Commerce Website\backend"; go run ./cmd/seed  # مهاجرت + ۵۰ محصول

# اجرای روزمره (دو پنجرهٔ جدا)
cd backend;  go run ./cmd/api         # → http://127.0.0.1:8080
cd frontend; cmd /c "npm run dev"     # → http://localhost:5173

# بررسی‌ها
cd backend;  go build ./... ; go vet ./... ; go test ./...
cd frontend; cmd /c "npm run build"    # tsc --noEmit + vite build
cd frontend; cmd /c "npm run typecheck"
cd frontend; cmd /c "npm run test"     # ۲۲۵ تست، ۱۲ فایل

# اسکریپت‌های آماده (خروجی در %TEMP%)
cmd /c "scripts\check-backend.cmd"        # build + vet + gofmt + test → check.txt
cmd /c "scripts\fmt-backend.cmd"          # gofmt -w → fmt.txt
cmd /c "scripts\check-frontend-full.cmd"  # test + build → fetest.txt
cmd /c "scripts\start-api2.cmd"           # API جدا (minimized) → apirun2.txt
cmd /c "scripts\stop-api.cmd"             # هر چه روی 8080 است را می‌کشد
powershell -ExecutionPolicy Bypass -File scripts\verify-patch.ps1       # PATCH جزئی ادمین
powershell -ExecutionPolicy Bypass -File scripts\verify-fixes2.ps1      # اعتبارسنجی/فیلتر/موجودی
cmd /c "scripts\verify-rollback.cmd"      # up/down مهاجرت‌ها روی دیتابیس دورریز
cmd /c "scripts\verify-images.cmd"        # یکتایی تصویر اصلی + شکل URLها
```

> `make` روی این سیستم نصب نیست؛ اهداف Makefile معادل دستورهای بالا هستند.

### دسترسی‌ها

```
DSN          : postgres://shalvarsara:shalvarsara@localhost:5432/shalvarsara?sslmode=disable
سوپریوزر     : postgres / postgres
نقش اپ       : shalvarsara / shalvarsara (superuser)

مدیر   : admin@example.com    / Admin@12345
مشتری  : customer@example.com / Customer@12345   (موبایل 09121111111)

کوپن‌های seed: WELCOME10  و  OFF50000
```

متغیرهای مهم `backend/.env`:

| کلید | مقدار |
|---|---|
| `APP_ENV` | `development` |
| `HTTP_PORT` | `8080` (اگر ست نشده باشد `PORT` خوانده می‌شود — میزبان‌هایی مثل Render آن را تزریق می‌کنند) |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173` |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | `15m` / `720h` |
| `RUN_MIGRATIONS` / `SEED_ON_START` | `true` / `false` |
| `TRUST_PROXY_HEADER` / `PROXY_HEADER` / `TRUSTED_PROXIES` | `false` / `X-Forwarded-For` / `127.0.0.1/8,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16` — محلی **خاموش** بماند تا هدر قابل جعل نباشد؛ روی Render/پشت CDN `true` (و اگر پروکسی آدرس عمومی دارد، باید در `TRUSTED_PROXIES` باشد) |
| `ORDER_EXPIRY` | `30m` — سفارش پرداخت‌نشده بعد از این مدت لغو و موجودی/کوپن آزاد می‌شود؛ `0` خاموش می‌کند |
| `ZARINPAL_SANDBOX` | `true` |
| `SMS_TEST_MODE` | محلی `true` (کد در پاسخ API) — پیش‌فرض خودش `false` است و production با `true` بالا نمی‌آید |
| `ZARINPAL_CALLBACK_URL` | `http://localhost:5173/payment/callback` |
| `ZARINPAL_RESULT_URL` | `http://localhost:5173/payment/result` |
| `ADMIN_PASSWORD` | در `backend/.env` مقدار دارد؛ **هیچ پیش‌فرضی در کد نیست** |

### استقرار روی Render

`render.yaml` در ریشهٔ مخزن سه سرویس می‌سازد: `shalvarsara-api` (Web Service با
Docker از `backend/Dockerfile`، context `backend/`)، `shalvarsara-web` (Static Site
از `frontend/dist`) و `shalvarsara-db` (Postgres 16، پلن free). سرویس API پورت را
از `PORT` می‌گیرد (پیش‌فرض Render: ۱۰۰۰۰) پس روی Render `HTTP_PORT` ست نشود.
`VITE_API_BASE_URL` در زمان build داخل باندل پخته می‌شود ⇒ تغییر دامنهٔ API یعنی
rebuild. پلن free: سرویس **API** بعد از ۱۵ دقیقه بی‌کاری می‌خوابد (Static Site
نمی‌خوابد)، دیتابیس **۳۰ روز** عمر دارد و دیسک پایدار ندارد (مهم برای آپلود فاز ۶).
مقدار `CORS_ORIGINS` را می‌توان بدون اسکیم نوشت (`shop.example.com`) —
`normalizeOrigins` خودش `https://` می‌گذارد.

**دسترسی از ایران:** `TRUST_PROXY_HEADER=true` در `render.yaml` ست است (Render و
آروان هر دو پروکسی‌اند؛ بدون آن محدودکنندهٔ نرخ همه را یک آی‌پی می‌بیند). مسیر
دامنه + CDN آروان در `DEPLOY-ARVAN.md`. اگر خواستی برگردی به میزبان ایرانی،
استقرار چابکان (با CLI و اسکریپت‌های استیج) در تاریخچهٔ گیت است: کامیت `0eb7cc7`
و فایل `DEPLOY-CHABOKAN.md` در همان کامیت (در Revert بعدی حذف شده).

> **تلهٔ پینگر برای گرم نگه داشتن:** GitHub Actions در مخزن **پرایوت** هر اجرا
> حداقل ۱ دقیقه از سهمیهٔ ۲۰۰۰ دقیقه‌ای ماهانه می‌خورد؛ پینگ ۵ دقیقه‌ای ≈ ۸۶۰۰
> دقیقه در ماه ⇒ به‌جای آن از پینگر بیرونی رایگان (UptimeRobot/cron-job.org)
> استفاده کن یا سرویس را بین جلسات بخوابان.

### تله‌های محیط این سیستم

- **`localhost` اول به `::1` (IPv6) حل می‌شود، ولی سرور Go فقط روی IPv4 گوش
  می‌دهد** → هر جا آدرس می‌دهی صریحاً `127.0.0.1` بنویس. (پروکسی Vite روی
  `http://127.0.0.1:8080` است؛ PostgreSQL با `localhost` کار می‌کند.)
- **Windscribe (VPN)** نصب است و بالاپایین می‌شود؛ فعلاً روی localhost اثری ندارد
  ولی اگر اتصال عجیبی دیدی اول `netsh winhttp show proxy` را چک کن.
- **Docker کار نمی‌کند** (WSL2 نصب نیست، `dockerDesktopLinuxEngine` بالا نمی‌آید)
  → PostgreSQL 16 بومی روی ویندوز: سرویس `postgresql-x64-16`، پورت 5432.
  `docker-compose.yml` فقط برای دیپلوی روی سرور نگه داشته شده و تست نشده است.
- **`npm` در PowerShell بلاک است** → `cmd /c "npm …"`.
- **خروجی کنسول برای متن فارسی mojibake می‌دهد** (داده سالم است) → خروجی را در
  فایل بنویس و با ابزار read بخوان.
- **فایل‌های `.ps1` با متن فارسی** باید UTF-8 **با BOM** ذخیره شوند. برای JSON
  بدون BOM بنویس (`[IO.File]::WriteAllText($p,$c,(New-Object System.Text.UTF8Encoding $false))`)
  و بدنهٔ curl را در فایل بده (`--data-binary "@file"`) — PowerShell 5.1 کوتیشن‌های
  JSON را حذف می‌کند و `Set-Content -Encoding UTF8` BOM می‌گذارد.
- **ابزار مرورگر:** تب‌ها بین دو فراخوانی `execute` ممکن است از بین بروند → هر
  سناریو را در **یک** فراخوانی انجام بده. برای صفحه‌های lazy قبل از snapshot با
  `wait(condition:"text")` منتظر یک متن شناخته‌شده بمان. (`evaluate` کلیدش
  `script` است، `network.get` کلیدش `id`، و `snapshot` فقط `{tabID, depth: ≤20}`.)
- **هارنس CDP** برای تست دقیق/ریسپانسیو: کروم مستقل با
  `--headless=new --remote-debugging-port=9333` +
  `Emulation.setDeviceMetricsOverride` (پس عرض و media queryها واقعی‌اند) و
  اسکرین‌شات هم می‌گیرد. اسکریپت‌های دوباره‌قابل‌اجرا در
  `C:\Users\Hosein\AppData\Local\Temp\opencode\`:
  `mobile-audit.mjs`، `admin-smoke.mjs`، `register-smoke.mjs`،
  `transactions-smoke.mjs`، `phase5-test.mjs`، `order-smoke.ps1`، `payment-smoke.ps1`.
- سرور API لاگش در `…\Temp\opencode\api.log` است. **هر تغییر Go ری‌استارت لازم
  دارد**؛ پورت را با `Get-NetTCPConnection -LocalPort 8080` پیدا و پروسه را بکش.
- تست مرورگر را روی همان `localhost:5173` بزن که `ZARINPAL_RESULT_URL` دارد؛
  نشست بین `127.0.0.1:5173` و `localhost:5173` مشترک نیست.

---

> **پس از پایان هر فاز:** همین فایل را به‌روزرسانی کن — کار انجام‌شده را از بخش ۱
> بردار، تله/مشکل تازه را به بخش ۲ اضافه کن — بعد `git add -A` → `git commit -m "…"`
> → `git push`. پیش از کامیت مطمئن شو `backend/.env` استیج نشده باشد
> (`git status --short`).
