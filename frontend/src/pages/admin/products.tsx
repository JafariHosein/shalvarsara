import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Boxes, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { SmartImage } from "@/components/common/smart-image";
import { Price } from "@/components/product/price";
import { useAdminCategories, useAdminProducts, useDeleteProduct, useUpdateProductFlags } from "@/hooks/use-admin";
import { formatNumber, toFaDigits } from "@/lib/format";
import { SORT_LABELS, type AdminProductQuery, type Product, type ProductSort } from "@/types/api";

const PAGE_SIZE = 20;
const SORTS: ProductSort[] = ["newest", "cheapest", "expensive", "popular", "discount", "rating"];

function readSort(params: URLSearchParams): ProductSort {
  const sort = params.get("sort") as ProductSort | null;
  return sort && SORTS.includes(sort) ? sort : "newest";
}

/** Which products the panel shows: active, inactive or everything. */
type ActiveFilter = "all" | "true" | "false";

function readActive(params: URLSearchParams): ActiveFilter {
  const value = params.get("active");
  return value === "true" || value === "false" ? value : "all";
}

/** Catalogue table with search, filters, quick toggles and paging. */
export function AdminProducts() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const q = params.get("q") ?? "";
  const categoryId = params.get("categoryId") ?? "";
  const active = readActive(params);
  const sort = readSort(params);

  const [search, setSearch] = React.useState(q);
  React.useEffect(() => setSearch(q), [q]);

  const [pendingDelete, setPendingDelete] = React.useState<Product | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const categories = useAdminCategories();
  const remove = useDeleteProduct();
  const toggle = useUpdateProductFlags();

  const query: AdminProductQuery = React.useMemo(
    () => ({
      q: q || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      active,
      sort,
      page,
      limit: PAGE_SIZE,
    }),
    [q, categoryId, active, sort, page],
  );

  const { data, isLoading, isFetching } = useAdminProducts(query);

  /** Apply a filter patch and go back to the first page. */
  const apply = (patch: Record<string, string | undefined | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page");
    setParams(next, { replace: true });
  };

  const reset = () => {
    setParams(new URLSearchParams(), { replace: true });
    setSearch("");
  };

  const goToPage = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filtersApplied = q !== "" || categoryId !== "" || active !== "all" || sort !== "newest";

  return (
    <>
      <AdminPageHeader
        icon={Boxes}
        title="محصولات"
        description={data ? `${formatNumber(data.total)} محصول` : "فهرست محصولات فروشگاه"}
      >
        <Button asChild className="gap-1.5">
          <Link to="/admin/products/new">
            <Plus className="size-4" />
            محصول جدید
          </Link>
        </Button>
      </AdminPageHeader>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              apply({ q: search.trim() });
            }}
          >
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="admin-product-q">جست‌وجو</Label>
              <div className="relative">
                <Search className="absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="admin-product-q"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="نام یا کد کالا"
                  className="pe-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>دسته‌بندی</Label>
              <Select
                value={categoryId || "all"}
                onValueChange={(value) => apply({ categoryId: value === "all" ? undefined : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="همه دسته‌ها" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه دسته‌ها</SelectItem>
                  {(categories.data ?? []).map((category) => (
                    <SelectItem key={category.id} value={String(category.id)}>
                      {toFaDigits(category.name)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>وضعیت نمایش</Label>
              <Select value={active} onValueChange={(value) => apply({ active: value === "all" ? undefined : value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="true">فقط فعال</SelectItem>
                  <SelectItem value="false">فقط غیرفعال</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ترتیب</Label>
              <Select value={sort} onValueChange={(value) => apply({ sort: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {SORT_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" variant="secondary" className="gap-1.5">
                <Search className="size-4" />
                اعمال جست‌وجو
              </Button>
              {filtersApplied && (
                <Button type="button" variant="ghost" className="gap-1.5" onClick={reset}>
                  <X className="size-4" />
                  حذف فیلترها
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <Skeleton key={index} className="h-14 rounded-md" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {filtersApplied ? "محصولی با این مشخصات پیدا نشد." : "هنوز محصولی ثبت نشده است."}
            </p>
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>محصول</TableHead>
                    <TableHead>دسته‌بندی</TableHead>
                    <TableHead>قیمت</TableHead>
                    <TableHead>موجودی</TableHead>
                    <TableHead>فعال</TableHead>
                    <TableHead className="text-end">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <SmartImage
                            src={product.images[0]?.url}
                            alt={product.title}
                            wrapperClassName="size-11 shrink-0 rounded-md"
                          />
                          <div className="min-w-0">
                            <Link
                              to={`/admin/products/${product.id}`}
                              className="line-clamp-1 font-medium hover:text-primary"
                            >
                              {toFaDigits(product.title)}
                            </Link>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground" dir="ltr">
                              {product.slug}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {product.category ? toFaDigits(product.category.name) : "—"}
                      </TableCell>
                      <TableCell>
                        <Price price={product.price} discountPrice={product.discountPrice} size="sm" />
                      </TableCell>
                      <TableCell>
                        <span className={product.stock === 0 ? "text-destructive" : undefined}>
                          {formatNumber(product.stock)}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          فروش: {formatNumber(product.soldCount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={product.isActive}
                          disabled={busyId === product.id}
                          aria-label={`نمایش محصول ${product.title}`}
                          onCheckedChange={(checked) => {
                            setBusyId(product.id);
                            toggle.mutate(
                              { id: product.id, body: { isActive: checked } },
                              { onSettled: () => setBusyId(null) },
                            );
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" aria-label="ویرایش محصول">
                            <Link to={`/admin/products/${product.id}`}>
                              <Pencil className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="حذف محصول"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setPendingDelete(product)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

                            <PaginationBar
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                pageSize={PAGE_SIZE}
                itemLabel="محصول"
                onChange={goToPage}
                className="mt-6"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        destructive
        title="حذف محصول"
        confirmLabel="حذف کن"
        isPending={remove.isPending}
        description={
          pendingDelete ? (
            <>
              محصول «{toFaDigits(pendingDelete.title)}» از فروشگاه برداشته می‌شود. سفارش‌های ثبت‌شده دست‌نخورده
              می‌مانند.
            </>
          ) : null
        }
        onConfirm={() => {
          if (!pendingDelete) return;
          remove.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
        }}
      />
    </>
  );
}
