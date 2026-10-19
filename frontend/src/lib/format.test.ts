import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatRating,
  formatToman,
  formatTomanCompact,
  rialToToman,
  toEnDigits,
  toFaDigits,
  tomanToRial,
} from "@/lib/format";

/**
 * Normalise a Persian-formatted string back to a plain ASCII number so an
 * assertion can be about the *value* even when the platform chooses a different
 * bidi mark or minus glyph. Intl in Node emits U+200E before a negative number
 * and U+2212 for the sign; both are presentation details.
 */
function toAscii(value: string): string {
  return toEnDigits(value)
    .replace(/[\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/\u066c/g, ",") // Arabic thousands separator
    .replace(/\u066b/g, ".") // Arabic decimal separator
    .replace(/\u2212/g, "-");
}

const PERSIAN_DIGITS = /^[۰-۹]+$/;

describe("formatNumber", () => {
  it("renders Persian digits with the Persian thousands separator", () => {
    expect(formatNumber(250_000)).toBe("۲۵۰٬۰۰۰");
  });

  it("renders zero", () => {
    expect(formatNumber(0)).toBe("۰");
  });

  it("groups every three digits in large values", () => {
    expect(formatNumber(1_234_567_890)).toBe("۱٬۲۳۴٬۵۶۷٬۸۹۰");
    expect(toAscii(formatNumber(1_234_567_890))).toBe("1,234,567,890");
  });

  it("never emits Latin digits", () => {
    expect(formatNumber(12_345)).not.toMatch(/[0-9]/);
  });
});

describe("formatToman", () => {
  it("appends the currency word to a grouped Persian amount", () => {
    expect(formatToman(250_000)).toBe("۲۵۰٬۰۰۰ تومان");
  });

  it("keeps the sign of a negative amount", () => {
    expect(toAscii(formatToman(-1_234))).toBe("-1,234 تومان");
  });

  it("formats zero without a separator", () => {
    expect(formatToman(0)).toBe("۰ تومان");
  });
});

describe("formatTomanCompact", () => {
  it("switches to millions at one million and above", () => {
    expect(formatTomanCompact(2_500_000)).toBe("۲٫۵ میلیون تومان");
    expect(formatTomanCompact(1_000_000)).toBe("۱ میلیون تومان");
  });

  it("uses thousands between one thousand and one million", () => {
    expect(formatTomanCompact(250_000)).toBe("۲۵۰ هزار تومان");
    expect(formatTomanCompact(1_000)).toBe("۱ هزار تومان");
  });

  it("falls back to the full amount below one thousand", () => {
    expect(formatTomanCompact(500)).toBe("۵۰۰ تومان");
  });
});

describe("formatRating", () => {
  it("always shows one decimal with the Persian decimal separator", () => {
    expect(formatRating(4.5)).toBe("۴٫۵");
    expect(formatRating(5)).toBe("۵٫۰");
    expect(formatRating(0)).toBe("۰٫۰");
  });
});

describe("formatPercent", () => {
  it("turns a ratio into a Persian percentage", () => {
    expect(formatPercent(0.25)).toBe("۲۵٪");
    expect(formatPercent(0)).toBe("۰٪");
    expect(formatPercent(1)).toBe("۱۰۰٪");
  });
});

describe("toFaDigits / toEnDigits", () => {
  it("converts Latin digits to Persian and back", () => {
    expect(toFaDigits(1234567890)).toBe("۱۲۳۴۵۶۷۸۹۰");
    expect(toEnDigits("۱۲۳۴۵۶۷۸۹۰")).toBe("1234567890");
  });

  it("converts Arabic-Indic digits too", () => {
    expect(toEnDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("leaves non-digit characters alone", () => {
    expect(toFaDigits("a1b2")).toBe("a۱b۲");
    expect(toEnDigits("۱۲۳ تومان")).toBe("123 تومان");
  });

  it("is a round trip for digits", () => {
    const digits = "۹۸۷۶۵۴۳۲۱۰";
    expect(toFaDigits(toEnDigits(digits))).toBe(digits);
    expect(toEnDigits(digits)).toMatch(PERSIAN_DIGITS.test(digits) ? /^[0-9]+$/ : /^$/);
  });
});

describe("Toman / Rial conversion", () => {
  it("multiplies by ten going to Rial", () => {
    expect(tomanToRial(0)).toBe(0);
    expect(tomanToRial(1)).toBe(10);
    expect(tomanToRial(250_000)).toBe(2_500_000);
  });

  it("divides by ten coming back, rounding to whole Toman", () => {
    expect(rialToToman(2_500_000)).toBe(250_000);
    expect(rialToToman(10_004)).toBe(1_000);
    expect(rialToToman(10_006)).toBe(1_001);
  });

  it("round-trips whole Toman amounts", () => {
    for (const amount of [0, 1, 999, 250_000, 12_345_678]) {
      expect(rialToToman(tomanToRial(amount))).toBe(amount);
    }
  });
});

describe("formatDate / formatDateTime", () => {
  it("renders a valid date in Persian without Latin digits", () => {
    const value = formatDate("2026-10-17T09:30:00Z");
    expect(value).not.toBe("—");
    expect(value).not.toMatch(/[0-9]/);
  });

  it("returns a dash for an unparseable date", () => {
    expect(formatDate("not a date")).toBe("—");
    expect(formatDateTime("not a date")).toBe("—");
  });

  it("includes a time component only for formatDateTime", () => {
    expect(formatDateTime("2026-10-17T09:30:00Z")).not.toBe("—");
  });
});
