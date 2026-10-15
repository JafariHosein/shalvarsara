/**
 * Single source of truth for every human contact detail on the storefront.
 *
 * ⚠️ The values below are placeholders for this demo build. Replace them with
 * the real support handles before going live — nothing else has to change:
 * the support widget, the footer and the contact rows all read from here.
 */
import { toFaDigits } from "@/lib/format";

export const CONTACT = {
  /** Telegram username, without the leading "@". */
  telegramUsername: "shalvarsara_support",
  /** Landline, ASCII so it can be dialled from the `tel:` link. */
  phone: "021-00000000",
  /** Mobile, ASCII so it can be dialled from the `tel:` link. */
  mobile: "0912-000-0000",
  email: "support@shalvarsara.ir",
  instagramUsername: "shalvarsara",
  /** When a human actually answers. */
  hours: "شنبه تا پنجشنبه، ۹ تا ۱۸",
  /** Shown under the contact rows in the support widget. */
  responseTime: "معمولاً کمتر از ۳۰ دقیقه پاسخ می‌دهیم",
} as const;

/** Persian-digit versions of the same values, ready to render. */
export const CONTACT_FA = {
  telegramId: `@${CONTACT.telegramUsername}`,
  phone: toFaDigits(CONTACT.phone),
  mobile: toFaDigits(CONTACT.mobile),
} as const;

/** Ready-made hrefs. Digits and separators are stripped for the tel: links. */
export const CONTACT_LINKS = {
  telegram: `https://t.me/${CONTACT.telegramUsername}`,
  instagram: `https://instagram.com/${CONTACT.instagramUsername}`,
  phone: `tel:${CONTACT.phone.replace(/[^\d+]/g, "")}`,
  mobile: `tel:${CONTACT.mobile.replace(/[^\d+]/g, "")}`,
  email: `mailto:${CONTACT.email}`,
} as const;
