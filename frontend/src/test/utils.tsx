import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DirectionProvider } from "@radix-ui/react-direction";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Test helpers.
 *
 * `renderWithProviders` mirrors the provider stack of `main.tsx` (minus the
 * theme/session bootstrap, which are app concerns rather than component ones)
 * so a component under test sees the same context it sees in the browser.
 */

/** A fresh client per test: no retries, no cache shared between tests. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export interface RenderWithProvidersOptions {
  /** Initial history entry, e.g. "/products/denim-blue". */
  route?: string;
  /** Extra entries so `navigate(-1)` inside a test has somewhere to go. */
  routes?: string[];
  /** Reuse a client when a test needs to seed or inspect the cache. */
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route, routes, queryClient }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const client = queryClient ?? createTestQueryClient();
  const initialEntries = routes ?? [route ?? "/"];

  const result = render(
    <DirectionProvider dir="rtl">
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={initialEntries}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          {ui}
        </MemoryRouter>
      </QueryClientProvider>
    </DirectionProvider>,
  );

  return { ...result, queryClient: client };
}
