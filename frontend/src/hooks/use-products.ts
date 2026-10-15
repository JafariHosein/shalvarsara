import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { productService } from "@/services/products";
import type { ProductQuery } from "@/types/api";

/** Paginated, filtered product list. Keeps the previous page while loading. */
export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: ["products", query],
    queryFn: ({ signal }) => productService.list(query, signal),
    placeholderData: keepPreviousData,
  });
}

/** A single product by slug. */
export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: ({ signal }) => productService.getBySlug(slug, signal),
    enabled: slug.length > 0,
  });
}

/** Products related to the given slug. */
export function useRelatedProducts(slug: string, limit = 8) {
  return useQuery({
    queryKey: ["products", "related", slug, limit],
    queryFn: ({ signal }) => productService.related(slug, limit, signal),
    enabled: slug.length > 0,
  });
}
