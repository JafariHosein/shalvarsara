import { useQuery } from "@tanstack/react-query";

import { orderService } from "@/services/orders";

/** The server's priced view of the current cart, for the checkout page. */
export function useOrderPreview(couponCode?: string) {
  return useQuery({
    queryKey: ["orders", "preview", couponCode ?? ""],
    queryFn: () => orderService.preview(couponCode),
    // Prices and stock move while the customer shops, so never serve a stale
    // total; a preview is one cheap request.
    staleTime: 0,
    retry: false,
  });
}

/** A page of the signed-in user's orders. */
export function useOrders(page = 1, limit = 10) {
  return useQuery({
    queryKey: ["orders", "list", page, limit],
    queryFn: ({ signal }) => orderService.list(page, limit, signal),
  });
}

/** One of the signed-in user's orders. */
export function useOrder(id: number | undefined) {
  return useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: ({ signal }) => orderService.get(id as number, signal),
    enabled: typeof id === "number" && id > 0,
  });
}
