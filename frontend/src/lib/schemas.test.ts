import {
  adminCategorySchema,
  couponSchema,
  dateInputToISO,
  digitsToNumber,
  imageSchema,
  isDigitsOnly,
  isoToDateInput,
  loginSchema,
  productSchema,
  profileSchema,
  registerSchema,
  variantSchema,
} from "@/lib/schemas";

/** Field-level messages from a failed parse, keyed by path. */
function messagesOf(result: { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } }) {
  const out: Record<string, string[]> = {};
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.join(".") || "<root>";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

const validProduct = {
  title: "شلوار جین مردانه",
  slug: "jeans-men",
  categoryId: "3",
  brand: "شلوارسرا",
  gender: "men",
  pantType: "jeans",
  fabric: "دنیم",
  shortDesc: "شلوار جین آبی",
  description: "توضیح کامل",
  price: "250000",
  discountPrice: "",
  stock: "10",
  sku: "SKU-1",
  isActive: true,
  isFeatured: false,
};

describe("digitsToNumber", () => {
  it("parses Latin digits", () => {
    expect(digitsToNumber("250000")).toBe(250_000);
  });

  it("parses Persian digits", () => {
    expect(digitsToNumber("۲۵۰۰۰۰")).toBe(250_000);
    expect(digitsToNumber("۱۲۳۴")).toBe(1_234);
  });

  it("parses Arabic-Indic digits", () => {
    expect(digitsToNumber("١٢٣٤")).toBe(1_234);
  });

  it("ignores grouping separators and spaces", () => {
    expect(digitsToNumber("250,000")).toBe(250_000);
    expect(digitsToNumber("۲۵۰٬۰۰۰")).toBe(250_000);
    expect(digitsToNumber(" 250 000 ")).toBe(250_000);
  });

  it("returns 0 for an empty or non-numeric string", () => {
    expect(digitsToNumber("")).toBe(0);
    expect(digitsToNumber("abc")).toBe(0);
  });
});

describe("isDigitsOnly", () => {
  it("accepts digits with separators and Persian digits", () => {
    expect(isDigitsOnly("250000")).toBe(true);
    expect(isDigitsOnly("۲۵۰٬۰۰۰")).toBe(true);
    expect(isDigitsOnly("250,000")).toBe(true);
    expect(isDigitsOnly("250 000")).toBe(true);
  });

  it("accepts a leading currency word, which the form may leave in", () => {
    expect(isDigitsOnly("تومان 250000")).toBe(true);
    expect(isDigitsOnly("تومان ۲۵۰۰۰۰")).toBe(true);
  });

  it("rejects text that merely contains digits", () => {
    expect(isDigitsOnly("abc")).toBe(false);
    expect(isDigitsOnly("12abc")).toBe(false);
    expect(isDigitsOnly("1.5")).toBe(false);
    expect(isDigitsOnly("-5")).toBe(false);
    expect(isDigitsOnly("")).toBe(false);
  });
});

describe("productSchema", () => {
  it("accepts a valid payload", () => {
    expect(productSchema.safeParse(validProduct).success).toBe(true);
  });

  it("accepts Persian digits in money and stock fields", () => {
    const result = productSchema.safeParse({
      ...validProduct,
      price: "۲۵۰۰۰۰",
      discountPrice: "۲۰۰۰۰۰",
      stock: "۱۰",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(digitsToNumber(result.data.price)).toBe(250_000);
    }
  });

  it("rejects non-numeric text in a money field instead of coercing it to 0", () => {
    const result = productSchema.safeParse({ ...validProduct, price: "abc" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["price"]).toContain("قیمت را وارد کنید.");
  });

  it("rejects text that only starts with digits in the price", () => {
    expect(productSchema.safeParse({ ...validProduct, price: "12abc" }).success).toBe(false);
  });

  it("rejects non-numeric text in an optional numeric field", () => {
    const discount = productSchema.safeParse({ ...validProduct, discountPrice: "ده هزار" });
    expect(discount.success).toBe(false);
    expect(messagesOf(discount)["discountPrice"]).toContain("قیمت با تخفیف معتبر نیست.");

    const stock = productSchema.safeParse({ ...validProduct, stock: "abc" });
    expect(stock.success).toBe(false);
    expect(messagesOf(stock)["stock"]).toContain("موجودی معتبر نیست.");
  });

  it("accepts an empty optional discount and stock", () => {
    expect(
      productSchema.safeParse({ ...validProduct, discountPrice: "", stock: "" }).success,
    ).toBe(true);
  });

  it("requires a minimum price of 1", () => {
    const result = productSchema.safeParse({ ...validProduct, price: "0" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["price"]).toContain("قیمت را وارد کنید.");
  });

  it("rejects a discount that is not below the price", () => {
    const result = productSchema.safeParse({
      ...validProduct,
      price: "250000",
      discountPrice: "250000",
    });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["discountPrice"]).toContain("قیمت با تخفیف باید کمتر از قیمت اصلی باشد.");
  });

  it("reports a missing title and category", () => {
    const result = productSchema.safeParse({ ...validProduct, title: "", categoryId: "" });
    expect(result.success).toBe(false);
    const messages = messagesOf(result);
    expect(messages["title"]).toContain("عنوان باید حداقل ۳ حرف باشد.");
    expect(messages["categoryId"]).toContain("دسته‌بندی را انتخاب کنید.");
  });

  it("rejects an invalid slug", () => {
    const result = productSchema.safeParse({ ...validProduct, slug: "Jeans Men!" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["slug"]?.[0]).toContain("نشانی فقط می‌تواند");
  });
});

describe("variantSchema", () => {
  const validVariant = {
    size: "32",
    color: "آبی",
    colorHex: "#2563EB",
    stock: "5",
    sku: "V-1",
    extraPrice: "",
  };

  it("accepts a valid variant", () => {
    expect(variantSchema.safeParse(validVariant).success).toBe(true);
  });

  it.each(["#fff", "#ffffff", "#ffffffff", "fff", "ffffff"])(
    "accepts the hex colour %s",
    (colorHex) => {
      expect(variantSchema.safeParse({ ...validVariant, colorHex }).success).toBe(true);
    },
  );

  it.each(["#fffff", "#fffffff", "#gggggg", "not-a-colour", "1,2,3"])(
    "rejects the malformed hex colour %s",
    (colorHex) => {
      const result = variantSchema.safeParse({ ...validVariant, colorHex });
      expect(result.success).toBe(false);
      expect(messagesOf(result)["colorHex"]?.[0]).toContain("کد رنگ معتبر نیست");
    },
  );

  it("allows an empty colour so the input is optional", () => {
    expect(variantSchema.safeParse({ ...validVariant, colorHex: "" }).success).toBe(true);
  });

  it("requires a size and a colour", () => {
    const result = variantSchema.safeParse({ ...validVariant, size: "", color: "" });
    expect(result.success).toBe(false);
    const messages = messagesOf(result);
    expect(messages["size"]).toContain("اندازه را وارد کنید.");
    expect(messages["color"]).toContain("رنگ را وارد کنید.");
  });

  it("rejects non-numeric stock and extra price", () => {
    expect(variantSchema.safeParse({ ...validVariant, stock: "abc" }).success).toBe(false);
    expect(variantSchema.safeParse({ ...validVariant, extraPrice: "abc" }).success).toBe(false);
  });
});

describe("imageSchema", () => {
  const validImage = { url: "https://cdn.example.com/p/x.webp", alt: "شلوار", isPrimary: true, sortOrder: "1" };

  it("accepts an absolute https URL", () => {
    expect(imageSchema.safeParse(validImage).success).toBe(true);
    expect(imageSchema.safeParse({ ...validImage, url: "http://localhost:8080/x.png" }).success).toBe(true);
  });

  it("accepts root-relative paths, which is how the seeder stores images", () => {
    expect(imageSchema.safeParse({ ...validImage, url: "/products/jeans-navy-a-1.webp" }).success).toBe(true);
    expect(imageSchema.safeParse({ ...validImage, url: "/x.png" }).success).toBe(true);
  });

  it("rejects a protocol-relative URL, which would point at another host", () => {
    const result = imageSchema.safeParse({ ...validImage, url: "//evil.example/x.png" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["url"]?.[0]).toContain("نشانی تصویر");
  });

  it("rejects plain text that is not a URL or a path", () => {
    expect(imageSchema.safeParse({ ...validImage, url: "not a url" }).success).toBe(false);
  });

  it("rejects a bare relative path without the leading slash", () => {
    expect(imageSchema.safeParse({ ...validImage, url: "products/x.webp" }).success).toBe(false);
  });

  it("requires a non-empty URL", () => {
    const result = imageSchema.safeParse({ ...validImage, url: "" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["url"]).toContain("نشانی تصویر را وارد کنید.");
  });

  it("rejects non-numeric sort order", () => {
    const result = imageSchema.safeParse({ ...validImage, sortOrder: "first" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["sortOrder"]).toContain("ترتیب نمایش معتبر نیست.");
  });
});

describe("loginSchema", () => {
  it("accepts a valid email and password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "secret1" }).success).toBe(true);
  });

  it("trims the email before validating", () => {
    const result = loginSchema.safeParse({ email: "  a@b.co  ", password: "x" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("a@b.co");
  });

  it("reports required-field violations with Persian messages", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    const messages = messagesOf(result);
    expect(messages["email"]).toContain("ایمیل را وارد کنید.");
    expect(messages["password"]).toContain("رمز عبور را وارد کنید.");
  });

  it("rejects an invalid email address", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["email"]).toContain("ایمیل معتبر نیست.");
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "حسین",
    email: "a@b.co",
    phone: "09123456789",
    code: "123456",
    password: "secret123",
    confirmPassword: "secret123",
  };

  it("accepts a valid sign-up", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("normalises Persian digits in the phone and code", () => {
    const result = registerSchema.safeParse({
      ...valid,
      phone: "۰۹۱۲۳۴۵۶۷۸۹",
      code: "۱۲۳۴۵۶",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe("09123456789");
      expect(result.data.code).toBe("123456");
    }
  });

  it("rejects a phone that does not start with 09", () => {
    const result = registerSchema.safeParse({ ...valid, phone: "12345678901" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["phone"]?.[0]).toContain("شماره موبایل باید ۱۱ رقم");
  });

  it("rejects a code that is not six digits", () => {
    expect(registerSchema.safeParse({ ...valid, code: "123" }).success).toBe(false);
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "different" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["confirmPassword"]).toContain("رمز عبور و تکرار آن یکسان نیستند.");
  });

  it("enforces the password length window", () => {
    expect(registerSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(
      registerSchema.safeParse({ ...valid, password: "x".repeat(73), confirmPassword: "x".repeat(73) }).success,
    ).toBe(false);
  });

  it("reports a too-short name", () => {
    const result = registerSchema.safeParse({ ...valid, name: "ح" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["name"]).toContain("نام باید حداقل ۲ حرف باشد.");
  });
});

describe("profileSchema", () => {
  it("accepts an empty phone", () => {
    expect(profileSchema.safeParse({ name: "حسین", phone: "" }).success).toBe(true);
  });

  it("normalises Persian digits in the phone", () => {
    const result = profileSchema.safeParse({ name: "حسین", phone: "۰۹۱۲۳۴۵۶۷۸۹" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.phone).toBe("09123456789");
  });

  it("rejects an invalid phone", () => {
    expect(profileSchema.safeParse({ name: "حسین", phone: "12345" }).success).toBe(false);
  });
});

describe("couponSchema", () => {
  const valid = {
    code: "OFF10",
    type: "percent" as const,
    amount: "10",
    minOrder: "",
    maxUses: "",
    expiresAt: "",
    isActive: true,
  };

  it("accepts a valid percentage coupon", () => {
    expect(couponSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a percentage above 100", () => {
    const result = couponSchema.safeParse({ ...valid, amount: "101" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["amount"]).toContain("درصد تخفیف نمی‌تواند بیشتر از ۱۰۰ باشد.");
  });

  it("allows a fixed discount above 100", () => {
    expect(couponSchema.safeParse({ ...valid, type: "fixed", amount: "50000" }).success).toBe(true);
  });

  it("rejects non-numeric amounts", () => {
    expect(couponSchema.safeParse({ ...valid, amount: "ten" }).success).toBe(false);
  });

  it("rejects an invalid coupon code", () => {
    const result = couponSchema.safeParse({ ...valid, code: "کد تخفیف" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["code"]?.[0]).toContain("کد تخفیف فقط می‌تواند");
  });
});

describe("adminCategorySchema", () => {
  it("accepts a valid category", () => {
    expect(
      adminCategorySchema.safeParse({ name: "شلوار", slug: "pants", parentId: "", sortOrder: "1" }).success,
    ).toBe(true);
  });

  it("reports a missing name", () => {
    const result = adminCategorySchema.safeParse({ name: "", slug: "", parentId: "", sortOrder: "" });
    expect(result.success).toBe(false);
    expect(messagesOf(result)["name"]).toContain("نام دسته‌بندی را وارد کنید.");
  });
});

describe("date helpers", () => {
  it("turns a date input into an end-of-day ISO timestamp", () => {
    const iso = dateInputToISO("2026-10-17");
    expect(iso).not.toBeNull();
    expect(new Date(iso as string).getHours()).toBe(23);
  });

  it("returns null for an empty or invalid date", () => {
    expect(dateInputToISO("")).toBeNull();
    expect(dateInputToISO("not-a-date")).toBeNull();
  });

  it("turns an API timestamp back into a date input value", () => {
    expect(isoToDateInput("2026-10-17T20:30:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns an empty string when there is no usable timestamp", () => {
    expect(isoToDateInput(null)).toBe("");
    expect(isoToDateInput("")).toBe("");
    expect(isoToDateInput("nope")).toBe("");
  });

  it("round-trips a date through both helpers", () => {
    expect(isoToDateInput(dateInputToISO("2026-03-21"))).toBe("2026-03-21");
  });
});
