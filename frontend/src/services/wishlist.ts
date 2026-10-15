import { http } from "@/lib/api";
import type { Page, WishlistEntry } from "@/types/api";

/**
 * The signed-in customer's saved-for-later list.
 *
 * Every call answers with the complete list, so the caller can replace its
 * cache in one round trip — the same shape the cart endpoints use.
 */
export const wishlistService = {
  list: (signal?: AbortSignal) => http.get<Page<WishlistEntry>>("/wishlist", { auth: true, signal }),

  add: (productId: number) => http.post<Page<WishlistEntry>>("/wishlist", { productId }, { auth: true }),

  remove: (productId: number) => http.delete<Page<WishlistEntry>>(`/wishlist/${productId}`, { auth: true }),
};
