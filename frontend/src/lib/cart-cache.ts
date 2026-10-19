import { queryClient } from "@/lib/query-client";
import { cartService } from "@/services/cart";
import { useCartStore } from "@/store/cart-store";
import type { ServerCart } from "@/types/api";

/** React Query key for the signed-in user's cart. */
export const CART_QUERY_KEY = ["cart"] as const;

/**
 * Ceiling the merge endpoint accepts per line. The guest cart is only clamped by
 * stock, which can be far higher than this, so a line above it would make the
 * whole merge fail validation — and because the failure is silent, the guest
 * basket would simply never transfer.
 */
export const MAX_MERGE_QUANTITY = 99;

/** Replace the cached cart with a response the server just sent. */
export function setCachedCart(cart: ServerCart): void {
  queryClient.setQueryData(CART_QUERY_KEY, cart);
}

/** Read the cached cart, if any. */
export function getCachedCart(): ServerCart | undefined {
  return queryClient.getQueryData<ServerCart>(CART_QUERY_KEY);
}

/**
 * Hand the browser's guest cart over to the account that just signed in.
 *
 * Runs after the tokens are stored and the user is marked authenticated, so the
 * request is authorised. A fetch that was already in flight for the previous
 * (empty) cart is cancelled first, otherwise its late response could overwrite
 * the merged result.
 *
 * The guest cart is only cleared once the server has accepted it, so a failed
 * merge can be retried on the next sign-in.
 *
 * @returns how many guest lines the server had to drop (delisted or out of
 *   stock), or -1 when the merge itself failed.
 */
export function syncGuestCart(): Promise<number> {
  // One merge at a time: React StrictMode runs mount effects twice, and two
  // simultaneous merges would add every guest line to the cart twice.
  inFlight ??= runMerge().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

let inFlight: Promise<number> | null = null;

async function runMerge(): Promise<number> {
  const { lines, clear } = useCartStore.getState();
  if (lines.length === 0) return 0;

  try {
    await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });

    const result = await cartService.merge(
      lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        // The endpoint rejects anything above 99, and one out-of-range line
        // fails the whole request.
        quantity: Math.min(Math.max(1, line.quantity), MAX_MERGE_QUANTITY),
      })),
    );

    setCachedCart(result.cart);
    clear();
    return result.skipped;
  } catch {
    // Keep the guest cart so the next sign-in can try again. -1 (rather than 0)
    // so callers can tell "nothing was dropped" from "nothing was merged".
    return -1;
  }
}
