import { http } from "@/lib/api";
import type { MyReview, ProductReviews, Review } from "@/types/api";

export interface ReviewPayload {
  rating: number;
  comment: string;
}

/**
 * Product reviews.
 *
 * Reading published reviews is public; writing one needs the token and, on the
 * server side, a delivered order that contains the product.
 */
export const reviewService = {
  list: (slug: string, params: { page?: number; limit?: number } = {}, signal?: AbortSignal) =>
    http.get<ProductReviews>(`/products/${slug}/reviews`, { query: params, signal }),

  /** Whether the signed-in customer may review the product, and their own review. */
  mine: (slug: string, signal?: AbortSignal) =>
    http.get<MyReview>(`/products/${slug}/reviews/mine`, { auth: true, signal }),

  /** First review or an edit — both wait for moderation. */
  create: (slug: string, payload: ReviewPayload) =>
    http.post<Review>(`/products/${slug}/reviews`, payload, { auth: true }),
};
