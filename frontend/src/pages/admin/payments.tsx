import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CreditCard, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PaginationBar } from "@/components/common/pagination-bar";
import { PaymentStatusBadge } from "@/components/common/payment-status-badge";
import { useAdminPayments } from "@/hooks/use-admin";
import { formatDateTime, formatToman, rialToToman, toFaDigits } from "@/lib/format";
import type { AdminPaymentQuery, PaymentStatus } from "@/types/api";

const PAGE_SIZE = 20;
const ALL = "__all__";

const STATUSES: { value: PaymentStatus | "all"; label: string }[] = [
  { value: "all", label: "همهٔ وضعیت‌ها" },
  { value: "verified", label: "پرداخت موفق" },
  { value: "initiated", label: "در انتظار پرداخت" },
  { value: "failed", label: "پرداخت ناموفق" },
];

/**
 * Transactions: every gateway attempt, newest first.
 *
 * Amounts arrive in Rial because that is what the gateway stores; the table
 * converts and labels them in Toman like the rest of the panel. The list
 * refreshes itself (see `useAdminPayments`), so a payment that succeeds while
 * the admin is looking at the screen flips to «پرداخت موفق» on its own.
 */
export function AdminPayments() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";

  const [search, setSearch] = React.useState(q);
  React.useEffect(() => setSearch(q), [q]);

  const query = React.useMemo<AdminPaymentQuery>(
    () => ({ q: q || undefined, status: status ? (status as AdminPaymentQuery["status"]) : undefined, page, limit: PAGE_SIZE }),
    [q, status, page],
  );
  const { data, isLoading, isFetching } = useAdminPayments(query);

  const applyFilters = (patch: { q?: string; status?: string }) => {
    const next = new URLSearchParams();
    if (patch.q) next.set("q", patch.q);
    if (patch.status && patch.status !== ALL) next.set("status", patch.status);
    setParams(next, { replace: true });
  };

  const goToPage = (target: number) => {
    const next = new URLSearchParams(params);
    if (target <= 1) next.delete("page");
    else next.set("page", String(target));
    setParams(next);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="تراکنش‌ها"
        description="هر تلاش برای پرداخت، همراه سفارش و مشتری‌اش. جست‌وجو با کد سفارش، شناسهٔ تراکنش یا شمارهٔ پیگیری بانک."
      />

      <Card>
        <CardContent className="pt-6">
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters({ q: search.trim(), status });
            }}
          >
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor="admin-payment-q">جست‌وجو</Label>
              {/* Wrapper and input share the same direction so the glyph can
                  never sit on top of the value. */}
              <div className="relative" dir="ltr">
                <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground" />
                <Input
                  id="admin-payment-q"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="کد سفارش، authority یا شماره پیگیری"
                  className="ps-9"
                />
              </div>
            </div>

            <div className="min-w-[12rem] space-y-2">
              <Label htmlFor="admin-payment-status">وضعیت</Label>
              <Select value={status || ALL} onValueChange={(value) => applyFilters({ q, status: value })}>
                <SelectTrigger id="admin-payment-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" variant="secondary" className="gap-1.5">
              <Search className="size-4" />
              جست‌وجو
            </Button>

            {(q || status) && (
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  setSearch("");
                  setParams(new URLSearchParams(), { replace: true });
                }}
              >
                <X className="size-4" />
                حذف فیلتر
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-14 rounded-md" />
              ))}
            </div>
          ) : !data || data.items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              {q || status ? "تراکنشی با این مشخصات پیدا نشد." : "هنوز هیچ تراکنشی ثبت نشده است."}
            </p>
          ) : (
            <div className={isFetching ? "opacity-60 transition-opacity" : undefined}>
              <Table className="min-w-[880px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>سفارش</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>مبلغ (تومان)</TableHead>
                    <TableHead>درگاه</TableHead>
                    <TableHead>شناسه تراکنش</TableHead>
                    <TableHead>وضعیت</TableHead>
                    <TableHead>زمان</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((row) => (
                    <TableRow key={row.payment.id}>
                      <TableCell>
                        <Link
                          to={`/admin/orders/${row.payment.orderId}`}
                          className="flex items-center gap-1.5 font-mono text-xs font-semibold text-primary hover:underline"
                          dir="ltr"
                        >
                          <CreditCard className="size-3.5 shrink-0" strokeWidth={1.75} />
                          {row.orderCode}
                        </Link>
                      </TableCell>
                      <TableCell className="min-w-0">
                        {/* Long names truncate; the phone is the clickable bit. */}
                        <p className="truncate text-sm font-medium">{row.customerName || "—"}</p>
                        {row.customerPhone && (
                          <p className="text-xs text-muted-foreground" dir="ltr">
                            {toFaDigits(row.customerPhone)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-semibold tabular-nums">
                        {formatToman(rialToToman(row.payment.amount))}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground" dir="ltr">
                        {row.payment.gateway}
                      </TableCell>
                      <TableCell className="min-w-[9rem]">
                        <p className="font-mono text-xs" dir="ltr">
                          {row.payment.refId || row.payment.authority || "—"}
                        </p>
                        {row.payment.refId && row.payment.authority ? (
                          <p className="truncate text-[11px] text-muted-foreground" dir="ltr">
                            {row.payment.authority}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={row.payment.status} label={row.statusFa} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(row.payment.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <p className="mt-4 text-center text-[11px] text-muted-foreground">
                این فهرست هر ۳۰ ثانیه یک بار به‌روز می‌شود.
              </p>
            </div>
          )}

          {data && data.totalPages > 1 && (
            <PaginationBar
              className="mt-6"
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={PAGE_SIZE}
              itemLabel="تراکنش"
              onChange={goToPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
