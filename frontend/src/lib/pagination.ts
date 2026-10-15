import { toEnDigits } from "@/lib/format";

/**
 * Collapse a run of digits around the current page so the pagination never
 * shows more than a handful of buttons.
 *
 * Shared by the storefront and the admin tables so both behave identically.
 */
export function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("gap");
    result.push(page);
    previous = page;
  }
  return result;
}

/**
 * Group digits in threes while typing, keeping the value itself separator-free.
 * Input may be Persian or Latin digits; the output is always Latin + ",".
 */
export function groupDigits(value: string): string {
  const digits = toEnDigits(value).replace(/\D/g, "");
  if (digits === "") return "";
  // Drop leading zeros so "007" does not become "0,007".
  return digits.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
