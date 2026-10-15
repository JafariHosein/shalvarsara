import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { wishlistService } from "@/services/wishlist";
import { useIsAuthenticated } from "@/store/auth-store";
import type { Page, WishlistEntry } from "@/types/api";

export const WISHLIST_QUERY_KEY = ["wishlist"] as const;

/** The signed-in customer's saved products. Guests get nothing but an empty list. */
export function useWishlist() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: WISHLIST_QUERY_KEY,
    queryFn: ({ signal }) => wishlistService.list(signal),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
}

/** Product ids on the wishlist — what every heart button reads. */
export function useWishlistIds(): Set<number> {
  const { data } = useWishlist();
  return React.useMemo(
    () => new Set((data?.items ?? []).map((entry) => entry.product.id)),
    [data],
  );
}

export interface UseToggleWishlist {
  /** Saves the product, or removes it when it is already on the list. */
  toggle: (productId: number) => void;
  /** The product whose request is in flight, for a per-tile spinner. */
  pendingProductId?: number;
  isPending: boolean;
}

/**
 * Add/remove one product. Both endpoints answer with the whole list, so the
 * cache is replaced rather than invalidated: the heart flips without a refetch.
 */
export function useToggleWishlist(): UseToggleWishlist {
  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: (payload: { productId: number; saved: boolean }) =>
      payload.saved ? wishlistService.remove(payload.productId) : wishlistService.add(payload.productId),
    onSuccess: (list) => client.setQueryData<Page<WishlistEntry>>(WISHLIST_QUERY_KEY, list),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return {
    toggle: (productId) => {
      // Membership is read from the cache at click time, so two quick clicks
      // on the same tile cannot both send "add".
      const current = client.getQueryData<Page<WishlistEntry>>(WISHLIST_QUERY_KEY);
      const saved = (current?.items ?? []).some((entry) => entry.product.id === productId);
      mutation.mutate({ productId, saved });
    },
    pendingProductId: mutation.isPending ? mutation.variables?.productId : undefined,
    isPending: mutation.isPending,
  };
}
