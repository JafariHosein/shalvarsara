import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api";

/** Shared React Query client. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Catalogue data changes rarely; 60s of staleness avoids pointless refetches.
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      // Never retry client errors (4xx). Transient network/5xx failures are retried
      // with growing gaps (2s/8s/20s/20s ≈ 90s of cover): on the Render free plan the
      // API spins down after 15 min idle and takes 30–60s to wake, while the Arvan CDN
      // in front of it gives the origin only 15s before answering 504 — so the first
      // visit after an idle period recovers by itself instead of showing an empty page.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 4;
      },
      retryDelay: (attempt) => Math.min(2_000 * 4 ** attempt, 20_000),
    },
    mutations: { retry: false },
  },
});
