import type { PaymentStart } from "@/types/api";

/**
 * The payment session is mirrored into sessionStorage on the way out to the
 * gateway. The dashboard is a full page navigation, so React state is gone by
 * the time the customer comes back; this copy lets the result page show the
 * order number, the amount and the sandbox badge while its own request is still
 * in flight — and even if that request fails.
 *
 * It is a convenience cache only. Nothing here is trusted: the order status
 * always comes from the API.
 */
export const LAST_PAYMENT_KEY = "shalvarsara.lastPayment";

export type StoredPaymentStart = Omit<PaymentStart, "gatewayUrl">;

/** Read the last payment session, or null when there is none/is unreadable. */
export function readLastPayment(): StoredPaymentStart | null {
  try {
    const raw = sessionStorage.getItem(LAST_PAYMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPaymentStart;
    if (typeof parsed?.orderId !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Record the session before the browser leaves for the gateway.
 *
 * Guarded on purpose: callers write this immediately before
 * `window.location.assign(gatewayUrl)`, so a throw here (storage disabled, or
 * the quota is full) would abort the redirect and surface as a failed payment —
 * even though the order exists and the gateway session is already open.
 */
export function writeLastPayment(start: PaymentStart): void {
  try {
    const { gatewayUrl: _gatewayUrl, ...rest } = start;
    sessionStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(rest));
  } catch {
    /* the cache is a convenience; never let it block the redirect */
  }
}
