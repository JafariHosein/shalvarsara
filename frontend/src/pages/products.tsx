import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationNumber,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { EmptyState } from "@/components/common/empty-state";
import { ProductGrid } from "@/components/product/product-grid";
import { FilterPanel, type ProductFilters } from "@/components/product/filter-panel";
import { useProducts } from "@/hooks/use-products";
import { formatNumber } from "@/lib/format";
import type { ProductQuery, ProductSort } from "@/types/api";

const PAGE_SIZE = 12;
const SORTS: ProductSort[] = ["newest", "cheapest", "expensive", "popular", "discount", "rating"];

/** Reads the filter state out of the URL so results are shareable. */
function readFilters(params: URLSearchParams): ProductFilters {
  const sort = params.get("sort") as ProductSort | null;
  return {
    q: params.get("q") ?? "",
    category: params.get("category") ?? "",
    sort: sort && SORTS.includes(sort) ? sort : "newest",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    inStock: params.get("inStock") === "true",
  };
}

/** Builds page numbers around the current page, with gaps collapsed. */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "gap")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (previous && page - previous > 1) result.push("gap");
    result.push(page);
    previous = page;
  }
  return result;
}

/** Catalogue page: filters, sorting, results grid and pagination. */
export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const query: ProductQuery = React.useMemo(
    () => ({
      q: filters.q || undefined,
      category: filters.category || undefined,
      sort: filters.sort,
      minPrice: filters.minPrice ? Number(filters.minPrice) : undefined,
      maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined,
      inStock: filters.inStock || undefined,
      featured: params.get("featured") === "true" || undefined,
      page,
      limit: PAGE_SIZE,
    }),
    [filters, page, params],
  );

  const { data, isLoading, isFetching, isError } = useProducts(query);

  /** Merge a patch into the URL and jump back to the first page. */
  const updateFilters = (patch: Partial<ProductFilters>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === "" || value === false || value === undefined) next.delete(key);
      else next.set(key, String(value));
    }
    next.delete("page");
    setParams(next, { replace: true });
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    // Keep a search term; it is a deliberate user action, not a filter.
    if (filters.q) next.set("q", filters.q);
    setParams(next, { replace: true });
  };

  const goToPage = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="container py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">
            {filters.q ? `نتایج جست‌وجو برای «${filters.q}»` : "همه شلوارها"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data ? `${formatNumber(data.total)} محصول یافت شد` : "در حال بارگذاری…"}
          </p>
        </div>

        {/* Filters on mobile live in a drawer. The drawer opens from the same
            side as the trigger, which sits at the inline end (left) in RTL. */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2 lg:hidden">
              <SlidersHorizontal className="size-4" />
              فیلترها
            </Button>
          </SheetTrigger>
          <SheetContent side="end" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="text-start">فیلترها</SheetTitle>
            </SheetHeader>
            <div className="mt-6">
              <FilterPanel value={filters} onChange={updateFilters} onReset={resetFilters} />
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-32 rounded-lg border bg-card p-5">
            <FilterPanel value={filters} onChange={updateFilters} onReset={resetFilters} />
          </div>
        </aside>

        <div>
          {isError ? (
            <EmptyState
              title="بارگذاری محصولات ناموفق بود"
              description="ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید."
            />
          ) : !isLoading && data && data.items.length === 0 ? (
            <EmptyState
              title="محصولی با این مشخصات پیدا نشد"
              description="فیلترها را تغییر دهید یا همه فیلترها را حذف کنید."
            >
              <Button variant="outline" className="mt-2" onClick={resetFilters}>
                حذف فیلترها
              </Button>
            </EmptyState>
          ) : (
            <>
              <ProductGrid
                products={data?.items}
                isLoading={isLoading}
                skeletonCount={PAGE_SIZE}
                className={isFetching && !isLoading ? "opacity-60 transition-opacity" : undefined}
              />

              {totalPages > 1 && (
                <Pagination className="mt-10">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (page > 1) goToPage(page - 1);
                        }}
                      />
                    </PaginationItem>

                    {pageWindow(page, totalPages).map((entry, index) =>
                      entry === "gap" ? (
                        <PaginationItem key={`gap-${index}`}>
                          <span className="px-2 text-muted-foreground">…</span>
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={entry}>
                          <PaginationNumber
                            page={entry}
                            href="#"
                            isActive={entry === page}
                            onClick={(event) => {
                              event.preventDefault();
                              goToPage(entry);
                            }}
                          />
                        </PaginationItem>
                      ),
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (page < totalPages) goToPage(page + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
