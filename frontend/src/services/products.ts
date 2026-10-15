import { http } from "@/lib/api";
import type { Page, Product, ProductQuery } from "@/types/api";

export const productService = {
  /** GET /products — filtered, sorted and paginated. */
  list: (query: ProductQuery, signal?: AbortSignal) =>
    http.get<Page<Product>>("/products", {
      signal,
      query: {
        q: query.q,
        category: query.category,
        categoryId: query.categoryId,
        size: query.size,
        color: query.color,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        inStock: query.inStock,
        featured: query.featured,
        gender: query.gender,
        pantType: query.pantType,
        sort: query.sort,
        page: query.page,
        limit: query.limit,
      },
    }),

  /** GET /products/:slug */
  getBySlug: (slug: string, signal?: AbortSignal) =>
    http.get<Product>(`/products/${encodeURIComponent(slug)}`, { signal }),

  /** GET /products/:slug/related */
  related: (slug: string, limit = 8, signal?: AbortSignal) =>
    http.get<Product[]>(`/products/${encodeURIComponent(slug)}/related`, { query: { limit }, signal }),

  /** GET /products/suggest — live search. */
  suggest: (q: string, signal?: AbortSignal) =>
    http.get<Product[]>("/products/suggest", { query: { q, limit: 6 }, signal }),
};
