import { Link } from "react-router-dom";
import {
  AlertCircle,
  Boxes,
  PackageCheck,
  PackageX,
  Receipt,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { useAdminStats } from "@/hooks/use-admin";
import { errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatNumber, formatToman, toFaDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SalesPoint } from "@/types/api";

/** Short Persian day label, e.g. "۱۵ مهر". */
const dayFormat = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "short" });

/** One headline number. */
function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 shrink-0 text-primary" />
      </CardHeader>
      <CardContent>
        <p className="text-xl font-bold sm:text-2xl">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

/** One of the smaller status tiles. */
function MiniStat({ label, value, to, tone }: { label: string; value: number; to: string; tone?: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-muted/60"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-bold", tone)}>{formatNumber(value)}</span>
    </Link>
  );
}

/** Fourteen daily bars. The window is a time series, so it stays LTR. */
function SalesChart({ points }: { points: SalesPoint[] }) {
  const max = Math.max(...points.map((point) => point.revenue), 1);

  return (
    <div dir="ltr" className="flex items-end gap-1 pt-2">
      {points.map((point, index) => {
        const ratio = point.revenue / max;
        return (
          <div key={point.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="flex h-36 w-full items-end">
              <div
                className={cn(
                  "w-full rounded-t transition-colors",
                  point.revenue > 0 ? "bg-primary/80 hover:bg-primary" : "bg-muted",
                )}
                style={{ height: `${point.revenue > 0 ? Math.max(ratio * 100, 6) : 2}%` }}
                title={`${formatDate(point.date)} — ${formatNumber(point.orders)} سفارش، ${formatToman(point.revenue)}`}
              />
            </div>
            <span className={cn("text-[10px] text-muted-foreground", index % 2 === 1 && "hidden sm:block")}>
              {dayFormat.format(new Date(point.date))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Landing screen of the panel: the numbers an operator checks first. */
export function AdminDashboard() {
  const stats = useAdminStats();

  if (stats.isLoading) {
    return (
      <>
        <AdminPageHeader title="داشبورد" description="نمای کلی فروشگاه" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-28 rounded-lg" />
          ))}
        </div>
        <Skeleton className="mt-4 h-64 rounded-lg" />
      </>
    );
  }

  if (stats.isError || !stats.data) {
    return (
      <>
        <AdminPageHeader title="داشبورد" description="نمای کلی فروشگاه" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="size-7 text-destructive" />
            <p className="text-sm text-muted-foreground">{errorMessage(stats.error)}</p>
            <Button variant="outline" onClick={() => stats.refetch()}>
              تلاش دوباره
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const data = stats.data;

  return (
    <>
      <AdminPageHeader title="داشبورد" description="نمای کلی فروشگاه" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="درآمد (بدون سفارش‌های لغوشده)"
          value={formatToman(data.revenue)}
          hint={`میانگین هر سفارش ${formatToman(data.avgOrder)}`}
          icon={Wallet}
        />
        <StatCard
          label="سفارش‌ها"
          value={formatNumber(data.orderCount)}
          hint={`${formatNumber(data.pending)} سفارش در انتظار پرداخت`}
          icon={Receipt}
        />
        <StatCard
          label="محصولات"
          value={formatNumber(data.products)}
          hint={`${formatNumber(data.activeProducts)} فعال · ${formatNumber(data.variants)} گونه`}
          icon={Boxes}
        />
        <StatCard
          label="کاربران"
          value={formatNumber(data.users)}
          hint={`${formatNumber(data.activeCoupons)} کد تخفیف فعال`}
          icon={Users}
        />
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <MiniStat label="در انتظار پرداخت" value={data.pending} to="/admin/orders?status=pending" />
        <MiniStat
          label="در حال آماده‌سازی"
          value={data.toFulfill}
          to="/admin/orders?status=processing"
          tone="text-sky-600 dark:text-sky-400"
        />
        <MiniStat label="ارسال‌شده" value={data.shipped} to="/admin/orders?status=shipped" />
        <MiniStat
          label="تحویل‌شده"
          value={data.delivered}
          to="/admin/orders?status=delivered"
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <MiniStat label="لغوشده" value={data.canceled} to="/admin/orders?status=canceled" />
      </div>

      {data.lowStock > 0 && (
        <Link
          to="/admin/products"
          className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400"
        >
          <PackageX className="size-4 shrink-0" />
          {formatNumber(data.lowStock)} گونه با موجودی کم (۲ عدد یا کمتر) دارید.
        </Link>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>فروش ۱۴ روز گذشته</CardTitle>
          <CardDescription>درآمد سفارش‌های لغوشده در این نمودار حساب نشده است.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.sales.every((point) => point.revenue === 0) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">در این بازه فروشی ثبت نشده است.</p>
          ) : (
            <SalesChart points={data.sales} />
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* min-w-0 lets the column shrink to the screen on a phone; without it
            the orders table below dictates the width of both cards. */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>پرفروش‌ترین محصولات</CardTitle>
            <CardDescription>بر اساس تعداد فروش رفته</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topSellers.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">هنوز فروشی ثبت نشده است.</p>
            ) : (
              <ol className="space-y-3">
                {data.topSellers.map((seller, index) => (
                  <li key={`${seller.productId ?? "x"}-${seller.title}`} className="flex items-center gap-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                      {toFaDigits(index + 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      {seller.slug ? (
                        <Link
                          to={`/products/${seller.slug}`}
                          className="line-clamp-1 text-sm font-medium hover:text-primary"
                        >
                          {toFaDigits(seller.title)}
                        </Link>
                      ) : (
                        <span className="line-clamp-1 text-sm font-medium">{toFaDigits(seller.title)}</span>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(seller.quantity)} عدد · {formatToman(seller.revenue)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>آخرین سفارش‌ها</CardTitle>
              <CardDescription>شش سفارش اخیر فروشگاه</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <Link to="/admin/orders">
                همه سفارش‌ها
                <Truck className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentOrders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">هنوز سفارشی ثبت نشده است.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>کد سفارش</TableHead>
                    <TableHead>مشتری</TableHead>
                    <TableHead>مبلغ</TableHead>
                    <TableHead>وضعیت</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.map((row) => (
                    <TableRow key={row.order.id}>
                      <TableCell className="font-medium">
                        <Link to={`/admin/orders/${row.order.id}`} className="hover:text-primary" dir="ltr">
                          {row.order.code}
                        </Link>
                        <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                          {formatDateTime(row.order.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate">{row.customerName || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatToman(row.order.total)}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={row.order.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <PackageCheck className="size-3.5" />
        برای مدیریت موجودی و قیمت‌ها به بخش «محصولات» سر بزنید.
      </p>
    </>
  );
}
