import { http } from "@/lib/api";
import type { Order, OrderPreview, Page } from "@/types/api";

export interface CreateOrderPayload {
  addressId: number;
  couponCode?: string;
  note?: string;
}

/**
 * Order endpoints. Every call is scoped to the signed-in user on the server, so
 * an id from another account reads as a 404.
 *
 * `preview` prices the current cart with exactly the rules `create` will apply,
 * which is why the checkout page never computes a total of its own: what the
 * customer is shown is what they are charged.
 */
export const orderService = {
  preview: (couponCode?: string, signal?: AbortSignal) =>
    http.post<OrderPreview>("/orders/preview", { couponCode: couponCode ?? "" }, { auth: true, signal }),

  create: (payload: CreateOrderPayload) => http.post<Order>("/orders", payload, { auth: true }),

  list: (page = 1, limit = 10, signal?: AbortSignal) =>
    http.get<Page<Order>>("/orders", { auth: true, query: { page, limit }, signal }),

  get: (id: number, signal?: AbortSignal) => http.get<Order>(`/orders/${id}`, { auth: true, signal }),
};
