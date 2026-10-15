/**
 * Persian formatting helpers.
 *
 * Money travels through the app as an integer number of Toman. Convert to Rial
 * only at the ZarinPal boundary (see `tomanToRial`).
 */

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Render a number with Persian digits and the Persian thousands separator. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fa-IR").format(value);
}

/**
 * Render a rating such as 4.5 with Persian digits and the Persian decimal
 * separator (٫, U+066B) — never the Latin "4.5", which reads as a stray full
 * stop inside a Persian sentence.
 */
export function formatRating(value: number): string {
  return new Intl.NumberFormat("fa-IR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Render an integer Toman amount, e.g. 250000 -> "۲۵۰٬۰۰۰ تومان". */
export function formatToman(amount: number): string {
  return `${formatNumber(amount)} تومان`;
}

/** Compact price for tight spaces, e.g. 250000 -> "۲۵۰ هزار". */
export function formatTomanCompact(amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${formatNumber(Number(millions.toFixed(1)))} میلیون تومان`;
  }
  if (amount >= 1_000) {
    return `${formatNumber(Math.round(amount / 1_000))} هزار تومان`;
  }
  return formatToman(amount);
}

/** Format a date on the Persian (Jalali) calendar, e.g. "۲۵ مهر ۱۴۰۵". */
export function formatDate(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(date);
}

/** Format a date and time on the Persian calendar. */
export function formatDateTime(value: Date | string | number): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Convert Latin digits in a string to Persian digits. */
export function toFaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Convert Persian/Arabic digits back to Latin so `parseInt` and the API work. */
export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

/** ZarinPal expects Rial; the app stores Toman. */
export function tomanToRial(toman: number): number {
  return toman * 10;
}

/** Convert a Rial amount from the gateway back to Toman. */
export function rialToToman(rial: number): number {
  return Math.round(rial / 10);
}

/** Human percentage discount, e.g. 0.25 -> "۲۵٪". */
export function formatPercent(ratio: number): string {
  return `${formatNumber(Math.round(ratio * 100))}٪`;
}
