import { z } from "zod";

import { toEnDigits } from "@/lib/format";

/** Normalises Latin/Persian digits before validating numeric fields. */
const digitsOnly = (value: string) => toEnDigits(value).replace(/[^\d]/g, "");

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "ایمیل را وارد کنید.")
    .email("ایمیل معتبر نیست."),
  password: z.string().min(1, "رمز عبور را وارد کنید."),
});

export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "نام باید حداقل ۲ حرف باشد.")
      .max(80, "نام بیش از حد بلند است."),
    email: z
      .string()
      .trim()
      .min(1, "ایمیل را وارد کنید.")
      .email("ایمیل معتبر نیست."),
    // Sign-up verifies the number with an SMS code, so it can no longer be
    // left empty.
    phone: z
      .string()
      .transform(digitsOnly)
      .refine((value) => /^09\d{9}$/.test(value), {
        message: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.",
      }),
    code: z
      .string()
      .transform(digitsOnly)
      .refine((value) => /^\d{6}$/.test(value), { message: "کد تأیید ۶ رقمی را وارد کنید." }),
    password: z
      .string()
      .min(8, "رمز عبور باید حداقل ۸ کاراکتر باشد.")
      .max(72, "رمز عبور بیش از حد بلند است."),
    confirmPassword: z.string().min(1, "تکرار رمز عبور را وارد کنید."),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "رمز عبور و تکرار آن یکسان نیستند.",
  });

export type RegisterValues = z.infer<typeof registerSchema>;

export const profileSchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ حرف باشد.").max(80, "نام بیش از حد بلند است."),
  phone: z
    .string()
    .transform(digitsOnly)
    .refine((value) => value === "" || /^09\d{9}$/.test(value), {
      message: "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.",
    }),
});

export type ProfileValues = z.infer<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Admin panel
// ---------------------------------------------------------------------------

/**
 * Money and quantity inputs stay strings in the form: the admin may type
 * Persian digits, and the value is normalised to a Latin integer on submit.
 */
export function digitsToNumber(value: string): number {
  const digits = toEnDigits(value).replace(/[^\d]/g, "");
  return digits === "" ? 0 : Number(digits);
}

/** A positive integer as text, e.g. "۲۵۰۰۰۰" for a price. */
const moneyField = (message: string, min = 0) =>
  z
    .string()
    .trim()
    .min(1, message)
    .refine((value) => digitsToNumber(value) >= min, message);

export const productSchema = z
  .object({
    title: z.string().trim().min(3, "عنوان باید حداقل ۳ حرف باشد.").max(200, "عنوان بیش از حد بلند است."),
    slug: z
      .string()
      .trim()
      .max(200, "نشانی بیش از حد بلند است.")
      .refine((value) => value === "" || /^[a-z0-9-]+$/.test(value), {
        message: "نشانی فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.",
      }),
    categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید."),
    brand: z.string().trim().max(80, "برند بیش از حد بلند است."),
    gender: z.string().trim().max(40),
    pantType: z.string().trim().max(40),
    fabric: z.string().trim().max(80),
    shortDesc: z.string().trim().max(600, "توضیح کوتاه بیش از حد بلند است."),
    description: z.string().trim().max(6000, "توضیحات بیش از حد بلند است."),
    price: moneyField("قیمت را وارد کنید.", 1),
    discountPrice: z
      .string()
      .trim()
      .refine((value) => value === "" || digitsToNumber(value) >= 0, "قیمت با تخفیف معتبر نیست."),
    stock: z
      .string()
      .trim()
      .refine((value) => value === "" || digitsToNumber(value) >= 0, "موجودی معتبر نیست."),
    sku: z.string().trim().max(64, "کد کالا بیش از حد بلند است."),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
  })
  .refine(
    (values) => {
      const discount = values.discountPrice === "" ? 0 : digitsToNumber(values.discountPrice);
      return discount === 0 || discount < digitsToNumber(values.price);
    },
    { path: ["discountPrice"], message: "قیمت با تخفیف باید کمتر از قیمت اصلی باشد." },
  );

export type ProductFormValues = z.infer<typeof productSchema>;

export const variantSchema = z.object({
  size: z.string().trim().min(1, "اندازه را وارد کنید.").max(20, "اندازه بیش از حد بلند است."),
  color: z.string().trim().min(1, "رنگ را وارد کنید.").max(40, "رنگ بیش از حد بلند است."),
  colorHex: z
    .string()
    .trim()
    .refine((value) => value === "" || /^#?[0-9a-fA-F]{3,8}$/.test(value), "کد رنگ معتبر نیست."),
  stock: z
    .string()
    .trim()
    .refine((value) => value === "" || digitsToNumber(value) >= 0, "موجودی معتبر نیست."),
  sku: z.string().trim().max(64, "کد کالا بیش از حد بلند است."),
  extraPrice: z
    .string()
    .trim()
    .refine((value) => value === "" || digitsToNumber(value) >= 0, "اختلاف قیمت معتبر نیست."),
});

export type VariantFormValues = z.infer<typeof variantSchema>;

export const imageSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "نشانی تصویر را وارد کنید.")
    .url("نشانی تصویر معتبر نیست (با http یا https شروع شود).")
    .max(500, "نشانی تصویر بیش از حد بلند است."),
  alt: z.string().trim().max(300, "متن جایگزین بیش از حد بلند است."),
  isPrimary: z.boolean(),
  sortOrder: z
    .string()
    .trim()
    .refine((value) => value === "" || digitsToNumber(value) >= 0, "ترتیب نمایش معتبر نیست."),
});

export type ImageFormValues = z.infer<typeof imageSchema>;

export const adminCategorySchema = z.object({
  name: z.string().trim().min(2, "نام دسته‌بندی را وارد کنید.").max(80, "نام بیش از حد بلند است."),
  slug: z
    .string()
    .trim()
    .max(80, "نشانی بیش از حد بلند است.")
    .refine((value) => value === "" || /^[a-z0-9-]+$/.test(value), {
      message: "نشانی فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد.",
    }),
  parentId: z.string().trim(),
  sortOrder: z
    .string()
    .trim()
    .refine((value) => value === "" || digitsToNumber(value) >= 0, "ترتیب نمایش معتبر نیست."),
});

export type AdminCategoryFormValues = z.infer<typeof adminCategorySchema>;

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "کد تخفیف باید حداقل ۳ کاراکتر باشد.")
      .max(40, "کد تخفیف بیش از حد بلند است.")
      .refine((value) => /^[A-Za-z0-9_-]+$/.test(value), {
        message: "کد تخفیف فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد.",
      }),
    type: z.enum(["percent", "fixed"]),
    amount: moneyField("مقدار تخفیف را وارد کنید.", 1),
    minOrder: z
      .string()
      .trim()
      .refine((value) => value === "" || digitsToNumber(value) >= 0, "حداقل مبلغ سفارش معتبر نیست."),
    maxUses: z
      .string()
      .trim()
      .refine((value) => value === "" || digitsToNumber(value) >= 0, "سقف استفاده معتبر نیست."),
    expiresAt: z.string().trim(),
    isActive: z.boolean(),
  })
  .refine((values) => values.type !== "percent" || digitsToNumber(values.amount) <= 100, {
    path: ["amount"],
    message: "درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.",
  });

export type CouponFormValues = z.infer<typeof couponSchema>;

/** Turn an input value into the RFC3339 timestamp the API expects. */
export function dateInputToISO(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Turn an API timestamp back into a `yyyy-MM-dd` value for `input[type=date]`. */
export function isoToDateInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
