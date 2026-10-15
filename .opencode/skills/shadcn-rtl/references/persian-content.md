# Persian content conventions

## Numbers and digits

Use Persian (Eastern Arabic-Indic) digits for display: `۰۱۲۳۴۵۶۷۸۹`.

```ts
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
export const toFaDigits = (v: string | number) =>
  String(v).replace(/\d/g, (d) => PERSIAN[+d]);
export const toEnDigits = (v: string) =>
  v.replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
   .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
```

`Intl.NumberFormat("fa-IR")` already emits Persian digits and the Persian thousands
separator `٬` (U+066C). Prefer it over manual grouping:

```ts
new Intl.NumberFormat("fa-IR").format(1250000); // ۱٬۲۵۰٬۰۰۰
```

**Normalize on input, never on display.** Convert to English digits (`toEnDigits`)
before sending to the API, before `parseInt`, and before phone/OTP validation.
Otherwise `parseInt("۱۲")` is `NaN`.

Persian digits in inputs are readable but awkward to type; keep numeric fields
`dir="ltr"` and accept both digit sets.

## Currency

- Internal unit: **integer Toman** everywhere (DB, API, state). Never store floats.
- Display: `formatToman(n)` → `۲۵۰٬۰۰۰ تومان` (with a space, no "ریال").
- ZarinPal boundary: convert **Toman → Rial** by multiplying by `10` when building the
  payment request, and divide by `10` when reconciling a callback. Keep this in one
  helper, never inline.

```ts
export const tomanToRial = (toman: number) => toman * 10;
export const rialToToman = (rial: number) => Math.round(rial / 10);
```

Options like `۱۲ ماه` / `۴۵ روز` are written with Persian digits.

## Dates (Jalali)

Modern runtimes format `fa-IR` with the Persian (Jalali) calendar automatically:

```ts
new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(new Date());
// ۲۵ مهر ۱۴۰۵
```

For relative times, parsing, and range pickers use Jalali-aware libraries:
`dayjs` + `jalaliday` + `jalaliDatepicker`, or `date-fns-jalali`. Do **not** hand-roll
Gregorian → Jalali conversion.

- Show dates as `۲۵ مهر ۱۴۰۵` (long) or `۱۴۰۵/۰۷/۲۵` (compact, e.g. in tables).
- Week starts on **شنبه (Saturday)**. Order: شنبه، یکشنبه، دوشنبه، سه‌شنبه، چهارشنبه، پنجشنبه، جمعه.

## Typography

- Font: **Vazirmatn** (variable). Fallback chain: `Vazirmatn Variable, system-ui, sans-serif`.
- Persian needs more line-height than Latin: body ≈ `leading-8` (2rem), headings ≈ `leading-tight`.
- Avoid `letter-spacing`/`tracking-*` on Persian text — it breaks joined letterforms.
- Avoid `uppercase`/`capitalize`/`italic` styling on Persian — they have no effect or look wrong.
- Use Persian punctuation: comma `،`, question mark `؟`, semicolon `؛`, and the correct
  directional marks when mixing with Latin/number runs: RLM `\u200F`, LRM `\u200E`.
- Wrap full mixed-direction strings in a `<bdi>` when interpolating into a sentence.

## Copy voice

Persian UI copy is concrete, calm, and action-first (see the `frontend-design` skill):

- Buttons name the action: «افزودن به سبد»، «تکمیل خرید»، «ثبت نظر»، «ذخیره تغییرات».
  Not «ارسال»، «ثبت»، «ادامه».
- Keep a term consistent across the flow: the button «افزودن به سبد» produces the toast
  «به سبد خرید اضافه شد». The button «پرداخت» leads to the page «پرداخت سفارش».
- Numbers with units read naturally: «۳ عدد در سبد»، «۲۵۰٬۰۰۰ تومان»، «۲ روز کاری».
- ZWNJ (`\u200C`) joins Persian word parts correctly: «می‌شود»، «نمی‌تواند»،
  «سفارش‌ها»، «تخفیف‌دار». Missing ZWNJ is the most common Persian typo — check it.

## Error and empty states (Persian, interface voice)

Errors say what happened and how to fix it; they do not apologise or stay vague.

| Situation | Message |
| --- | --- |
| Wrong credentials | «ایمیل یا رمز عبور نادرست است.» |
| Duplicate email | «این ایمیل قبلاً ثبت شده است. وارد شوید یا ایمیل دیگری انتخاب کنید.» |
| Out of stock | «این سایز موجود نیست. سایز دیگری انتخاب کنید.» |
| Payment failed | «پرداخت انجام نشد. مبلغ کسر نشده است. دوباره تلاش کنید.» |
| Payment canceled by user | «از پرداخت انصراف دادید. سفارش شما در سبد باقی مانده است.» |
| Network error | «ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.» |
| Empty cart | «سبد خرید خالی است.» + action «مشاهده محصولات» |
| Empty search | «محصولی با این مشخصات پیدا نشد.» + hint about changing filters |
| Empty orders | «هنوز سفارشی ثبت نکردهاید.» + action «شروع خرید» |
| Missing field | «این فیلد الزامی است.» |

Toast vocabulary: success = «… انجام شد» / «… اضافه شد» / «… ذخیره شد»; failure = «… انجام نشد».

## Persian Zod error map

Override zod's default English messages once, globally:

```ts
import { z } from "zod";

z.setErrorMap((issue) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === "undefined"
        ? { message: "این فیلد الزامی است." }
        : { message: "مقدار واردشده نامعتبر است." };
    case z.ZodIssueCode.too_small:
      return { message: "مقدار واردشده کوتاه است." };
    case z.ZodIssueCode.too_big:
      return { message: "مقدار واردشده بیش از حد مجاز است." };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "ایمیل معتبر نیست." };
      if (issue.validation === "url")   return { message: "نشانی معتبر نیست." };
      return { message: "قالب مقدار واردشده درست نیست." };
    default:
      return { message: "مقدار واردشده نامعتبر است." };
  }
});
```

Validation helpers matching this store:

- Iranian mobile: `/^09\d{9}$/` after `toEnDigits`.
- Postal code: `/^\d{10}$/`.
- Password: at least 8 characters, containing a letter and a digit.

## Product seed copy (for the 50 items)

Seed data should read like a real Persian shop, not lorem ipsum:

- Title: «شلوار جین مردانه مدل اسلیم فیت» / «شلوار پارچه‌ای زنانه کمرکش‌دار».
- Short spec: «جنس: جین کشی — قد: ۱۰۰ سانتی‌متر — کمر: کشی».
- Categories: مردانه، زنانه، بچگانه; types: جین، پارچه‌ای، کتان، کارگو، اسلش، بگ، اسکینی.
- Sizes: numeric waist (۳۰–۴۶) for men, S–XXL or numeric for women.
- Colours in Persian: مشکی، سرمه‌ای، آبی روشن، خاکستری، بژ، زیتونی، قهوه‌ای.
