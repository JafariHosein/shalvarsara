import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PackageCheck, RotateCcw, Ruler, SlidersHorizontal, Truck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ProductGrid } from "@/components/product/product-grid";
import { FilterPanel, type ProductFilters } from "@/components/product/filter-panel";
import { useCategories } from "@/hooks/use-categories";
import { useProducts } from "@/hooks/use-products";
import { formatNumber } from "@/lib/format";
import { SORT_LABELS, type ProductQuery, type ProductSort } from "@/types/api";

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

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Catalogue page: filters, sorting, results grid and pagination. */
export function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = readFilters(params);
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const { data: categories } = useCategories();

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
    // Functional form: several fields can change in one tick (a range typed in
    // quickly, or a multi-key reset), and reading `params` from the render
    // closure would let the later patch overwrite the earlier one.
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [key, value] of Object.entries(patch)) {
          if (value === "" || value === false || value === undefined) next.delete(key);
          else next.set(key, String(value));
        }
        next.delete("page");
        return next;
      },
      { replace: true },
    );
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

  const categoryName = (categories ?? []).find((item) => item.slug === filters.category)?.name;

  const chips: ActiveChip[] = [];
  if (filters.category) {
    chips.push({
      key: "category",
      label: `دسته: ${categoryName ?? filters.category}`,
      onRemove: () => updateFilters({ category: "" }),
    });
  }
  if (filters.minPrice || filters.maxPrice) {
    // Only say «تا» / «از» when that side is actually set: printing
    // «بی‌نهایت» for a missing bound reads like a glitch, not a filter.
    const from = filters.minPrice ? formatNumber(Number(filters.minPrice)) : null;
    const to = filters.maxPrice ? formatNumber(Number(filters.maxPrice)) : null;
    const label =
      from && to
        ? `قیمت: از ${from} تا ${to} تومان`
        : from
          ? `قیمت: از ${from} تومان`
          : `قیمت: تا ${to} تومان`;
    chips.push({
      key: "price",
      label,
      onRemove: () => updateFilters({ minPrice: "", maxPrice: "" }),
    });
  }
  if (filters.inStock) {
    chips.push({ key: "inStock", label: "فقط کالاهای موجود", onRemove: () => updateFilters({ inStock: false }) });
  }
  if (filters.sort !== "newest") {
    chips.push({
      key: "sort",
      label: `ترتیب: ${SORT_LABELS[filters.sort]}`,
      onRemove: () => updateFilters({ sort: "newest" }),
    });
  }

  const totalPages = data?.totalPages ?? 0;

  return (
    <div className="container py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold">
            {filters.q ? `نتایج جست‌وجو برای «${filters.q}»` : "همه شلوارها"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {data
              ? `${formatNumber(data.total)} محصول یافت شد${totalPages > 1 ? ` — صفحهٔ ${formatNumber(page)} از ${formatNumber(totalPages)}` : ""}`
              : "در حال بارگذاری…"}
          </p>
        </div>

        {/* Filters on mobile live in a drawer. The drawer opens from the same
            side as the trigger, which sits at the inline end (left) in RTL. */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2 lg:hidden">
              <SlidersHorizontal className="size-4" />
              فیلترها
              {chips.length > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground tabular-nums">
                  {formatNumber(chips.length)}
                </span>
              )}
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

      {/* Active filters are visible (and removable) without opening the panel. */}
      {chips.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">فیلترهای فعال:</span>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="group inline-flex items-center gap-1.5 rounded-full bg-card py-1 ps-3 pe-2 text-xs shadow-[var(--shadow-border)] transition-colors duration-150 hover:text-destructive"
            >
              <span className="tabular-nums">{chip.label}</span>
              <X className="size-3.5 opacity-60 transition-opacity duration-150 group-hover:opacity-100" />
            </button>
          ))}
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-primary" onClick={resetFilters}>
            <RotateCcw className="size-3" />
            پاک کردن همه
          </Button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="hidden lg:block">
          <div className="surface sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto p-5">
            <FilterPanel value={filters} onChange={updateFilters} onReset={resetFilters} />
          </div>
        </aside>

        <div className="min-w-0">
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
                <PaginationBar
                  className="mt-10"
                  page={page}
                  totalPages={totalPages}
                  total={data?.total}
                  pageSize={PAGE_SIZE}
                  itemLabel="محصول"
                  onChange={goToPage}
                />
              )}
            </>
          )}

          {/* A little guidance under the results, instead of an abrupt end. */}
          <section aria-label="راهنمای خرید" className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Ruler,
                title: "راهنمای انتخاب سایز",
                text: "دور کمر و دم پا را با جدول سایز مقایسه کنید.",
                to: "/#size-guide",
              },
              {
                icon: Truck,
                title: "ارسال سریع",
                text: "تهران و کرج یک‌روزه، سایر شهرها ۲ تا ۴ روز کاری.",
                to: "/#services",
              },
              {
                icon: PackageCheck,
                title: "۷ روز مهلت بازگشت",
                text: "اگر سایز نبود، بدون هزینه تعویض می‌کنیم.",
                to: "/#faq",
              },
            ].map(({ icon: Icon, title, text, to }) => (
              <Link key={title} to={to} className="surface surface-hover block p-4">
                <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
                <p className="mt-3 text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground text-pretty">{text}</p>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
