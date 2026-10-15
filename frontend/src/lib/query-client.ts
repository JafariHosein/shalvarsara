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
      // Never retry client errors; retry transient network/5xx failures twice.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: { retry: false },
  },
});
