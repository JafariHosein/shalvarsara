import { http } from "@/lib/api";
import type { MergeCartResult, ServerCart } from "@/types/api";

export interface AddCartItemPayload {
  productId: number;
  variantId: number | null;
  quantity: number;
}

/** One browser-side line, as sent to POST /cart/merge. */
export interface MergeCartLinePayload {
  productId: number;
  variantId: number | null;
  quantity: number;
}

/**
 * Signed-in cart endpoints.
 *
 * Every call answers with the complete cart, so the caller can replace its state
 * in one round trip instead of refetching.
 */
export const cartService = {
  get: (signal?: AbortSignal) => http.get<ServerCart>("/cart", { auth: true, signal }),

  addItem: (payload: AddCartItemPayload) => http.post<ServerCart>("/cart/items", payload, { auth: true }),

  updateItem: (id: number, quantity: number) =>
    http.patch<ServerCart>(`/cart/items/${id}`, { quantity }, { auth: true }),

  removeItem: (id: number) => http.delete<ServerCart>(`/cart/items/${id}`, { auth: true }),

  clear: () => http.delete<ServerCart>("/cart", { auth: true }),

  merge: (items: MergeCartLinePayload[]) =>
    http.post<MergeCartResult>("/cart/merge", { items }, { auth: true }),
};
