/**
 * Delivery pricing, mirrored from the server for display before checkout.
 *
 * The server owns these rules (`config.ShippingConfig`): the cart, the checkout
 * preview and the stored order all price delivery server-side, and the numbers
 * here only exist so a page can show a fee before the first API round trip.
 * Keep them equal to SHIPPING_FLAT_COST / SHIPPING_FREE_FROM.
 */

/** Orders at or above this amount ship for free, in Toman. */
export const FREE_SHIPPING_THRESHOLD = 2_000_000;

/** Flat delivery fee for smaller orders, in Toman. */
export const SHIPPING_COST = 65_000;

/**
 * Delivery fee charged for a given goods subtotal, in Toman.
 *
 * The threshold is compared against the subtotal before any coupon discount, so
 * applying a coupon never adds a delivery fee.
 */
export function shippingCost(subtotal: number): number {
  if (subtotal <= 0 || subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_COST;
}
