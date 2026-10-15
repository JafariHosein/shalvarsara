import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, Receipt, Search, Truck, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { useAdminOrders } from "@/hooks/use-admin";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { ORDER_STATUS_LABELS, type AdminOrderQuery, type OrderStatus } from "@/types/api";

const PAGE_SIZE = 20;
const STATUSES: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "canceled"];

/** Every order of the shop, with search, a status filter and paging. */
export function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const q = params.get("q") ?? "";
  const rawStatus = params.get("status");
  const status: OrderStatus | "all" = STATUSES.includes(rawStatus as OrderStatus)
    ? (rawStatus as OrderStatus)
    : "all";

  const [search, setSearch] = React.useState(q);
  React.useEffect(() => setSearch(q), [q]);

  const query: AdminOrderQuery = React.useMemo(
    () => ({ q: q || undefined, status, page, limit: PAGE_SIZE }),
    [q, status, page],
  );

  const { data, isLoading, isFetching } = useAdminOrders(query);

  const apply = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (!value) next.delete(key);
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

  const filtersApplied = q !== "" || status !== "all";

  return (
    <>
      <AdminPageHeader
        icon={Receipt}
        title="سفارش‌ها"
        description={data ? `${formatNumber(data.total)} سفارش` : "سفارش‌های ثبت‌شده فروشگاه"}
      />

      <Card className="mb-6">
        <CardContent className="pt-6">
          <form
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              apply({ q: search.trim() });
            }}
          >
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="admin-order-q">جست‌وجو</Label>
              <div className="relative">
                <Search className="absolute inset-y-0 end-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="admin-order-q"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="کد سفارش، نام گیرنده یا شماره تماس"
                  className="pe-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>وضعیت</Label>
              <Select value={status} onValueChange={(value) => apply({ status: value === "all" ? undefined : value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  {STATUSES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {ORDER_STATUS_LABELS[option]}
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
              {filtersApplied ? "سفارشی با این مشخصات پیدا نشد." : "هنوز سفارشی ثبت نشده است."}
            </p>
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>کد سفارش</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>اقلام</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>مرسوله</TableHead>
                    <TableHead className="text-end">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow key={row.order.id}>
                      <TableCell>
                        <Link
                          to={`/admin/orders/${row.order.id}`}
                          className="font-bold hover:text-primary"
                          dir="ltr"
                        >
                          {row.order.code}
                        </Link>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {formatDateTime(row.order.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="block max-w-[12rem] truncate">{row.customerName || "—"}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground" dir="ltr">
                          {row.customerPhone || row.order.shippingAddress.phone}
                        </span>
                      </TableCell>
                      <TableCell>{formatNumber(row.itemsCount)}</TableCell>
                      <TableCell className="whitespace-nowrap font-medium">{formatToman(row.order.total)}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={row.order.status} />
                      </TableCell>
                      <TableCell>
                        {row.trackingCode ? (
                          <>
                            <span className="block text-xs text-muted-foreground">{row.carrier}</span>
                            <span className="text-xs" dir="ltr">
                              {row.trackingCode}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button asChild variant="ghost" size="sm" className="gap-1.5">
                          <Link to={`/admin/orders/${row.order.id}`}>
                            <Eye className="size-4" />
                            جزئیات
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <TablePagination page={data.page} totalPages={data.totalPages} onChange={goToPage} className="mt-6" />
            </div>
          )}
        </CardContent>
      </Card>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Truck className="size-3.5" />
        با ثبت کد رهگیری، سفارش در صفحه «سفارش‌ها» برای مشتری هم نمایش داده می‌شود.
      </p>
    </>
  );
}
