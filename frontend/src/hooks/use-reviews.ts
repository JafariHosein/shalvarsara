import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { reviewService, type ReviewPayload } from "@/services/reviews";
import { useIsAuthenticated } from "@/store/auth-store";

/** Reviews per page on the product screen. */
export const REVIEWS_PAGE_SIZE = 5;

/** Published reviews of one product, one page at a time. */
export function useProductReviews(slug: string, page = 1) {
  return useQuery({
    queryKey: ["reviews", "product", slug, page],
    queryFn: ({ signal }) =>
      reviewService.list(slug, { page, limit: REVIEWS_PAGE_SIZE }, signal),
    enabled: slug.length > 0,
    placeholderData: keepPreviousData,
  });
}

/**
 * The signed-in customer's own review, plus whether they are allowed to write
 * one at all (the server only accepts reviews from verified buyers).
 */
export function useMyReview(slug: string) {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ["reviews", "mine", slug],
    queryFn: ({ signal }) => reviewService.mine(slug, signal),
    enabled: isAuthenticated && slug.length > 0,
  });
}

/** First review or an edit; both wait in the moderation queue. */
export function useCreateReview(slug: string) {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (payload: ReviewPayload) => reviewService.create(slug, payload),
    onSuccess: () => {
      // Touch every review list: the author's own panel, and the public list
      // that the review will join once an admin approves it.
      void client.invalidateQueries({ queryKey: ["reviews"] });
      toast.success("نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
