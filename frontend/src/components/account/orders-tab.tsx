import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ChevronDown,
  Clock,
  CreditCard,
  Loader2,
  PackageSearch,
  Receipt,
  Truck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, EmptyStateLink } from "@/components/common/empty-state";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { SmartImage } from "@/components/common/smart-image";
import { useOrders } from "@/hooks/use-orders";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatNumber, formatToman, toFaDigits } from "@/lib/format";
import { writeLastPayment } from "@/lib/payment-session";
import { paymentService } from "@/services/payments";
import { type Order } from "@/types/api";

/** Item thumbnails, capped so a long order does not stretch the card. */
function ItemThumbs({ order }: { order: Order }) {
  const shown = order.items.slice(0, 4);
  const extra = order.items.length - shown.length;

  return (
    <div className="flex items-center gap-2">
      {shown.map((item) => (
        <Link key={item.id} to={`/products/${item.slug}`} title={item.title}>
          <SmartImage src={item.imageUrl} alt={item.title} wrapperClassName="size-11 rounded-md" />
        </Link>
      ))}
      {extra > 0 && (
        <span className="flex size-11 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
          +{formatNumber(extra)}
        </span>
      )}
    </div>
  );
}

/** The expanded body of an order: lines, money breakdown and shipping address. */
function OrderDetails({ order }: { order: Order }) {
  return (
    <div className="space-y-4 border-t bg-muted/20 p-4">
      <ul className="space-y-3">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            <Link to={`/products/${item.slug}`} className="shrink-0">
              <SmartImage src={item.imageUrl} alt={item.title} wrapperClassName="size-12 rounded-md" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/products/${item.slug}`} className="line-clamp-1 text-sm font-medium hover:text-primary">
                {toFaDigits(item.title)}
              </Link>
              <p className="text-xs text-muted-foreground">
                {toFaDigits(item.variantLabel || "—")}
                <span className="mx-1.5">·</span>
                {formatNumber(item.quantity)} عدد
              </p>
            </div>
            <span className="shrink-0 text-sm">{formatToman(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">جمع کالاها</span>
            <span>{formatToman(order.subtotal)}</span>
          </div>
          {order.discount > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">تخفیف {order.couponCode ? `(${order.couponCode})` : ""}</span>
              <span className="text-primary">−{formatToman(order.discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">هزینه ارسال</span>
            <span>{order.shippingCost === 0 ? "رایگان" : formatToman(order.shippingCost)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-semibold">
            <span>مبلغ کل</span>
            <span className="text-primary">{formatToman(order.total)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-background p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <Truck className="size-4 text-primary" />
            ارسال به
          </p>
          <p className="leading-6 text-muted-foreground">
            {order.shippingAddress.receiverName} — {order.shippingAddress.province}، {order.shippingAddress.city}،{" "}
            {order.shippingAddress.line1}
          </p>
          <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
            {order.shippingAddress.phone}
          </p>
          {order.note && (
            <p className="mt-2 border-t pt-2 text-xs leading-6 text-muted-foreground">
              <span className="font-semibold text-foreground">توضیحات: </span>
              {order.note}
            </p>
          )}

          {order.shipment && (
            <div className="mt-2 space-y-1 border-t pt-2 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <Truck className="size-3.5 text-primary" />
                مرسوله
              </p>
              <p className="leading-6 text-muted-foreground">
                {order.shipment.carrier}
                <span className="mx-1.5">·</span>
                کد رهگیری:{" "}
                <span dir="ltr" className="font-mono">
                  {order.shipment.trackingCode}
                </span>
              </p>
              {order.shipment.shippedAt && (
                <p className="text-muted-foreground">زمان ارسال: {formatDateTime(order.shipment.shippedAt)}</p>
              )}
              {order.shipment.deliveredAt && (
                <p className="text-muted-foreground">زمان تحویل: {formatDateTime(order.shipment.deliveredAt)}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {order.payment?.status === "failed" && order.payment.message && (
        <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          آخرین تلاش پرداخت: {order.payment.message}
        </p>
      )}
    </div>
  );
}

/** One order row, collapsed by default. */
function OrderCard({ order }: { order: Order }) {
  const [open, setOpen] = React.useState(false);

  const pay = useMutation({
    mutationFn: () => paymentService.start(order.id),
    onSuccess: (start) => {
      // Guarded write: a storage failure must not abort the redirect, or the
      // customer would be left on this page with the order already created.
      writeLastPayment(start);
      window.location.assign(start.gatewayUrl);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const payLabel = order.status === "pending" && order.payment ? "ادامه پرداخت" : "پرداخت سفارش";

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-3 space-y-0 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-bold">
              <Receipt className="size-4 text-primary" />
              <span dir="ltr">{order.code}</span>
            </span>
            <OrderStatusBadge status={order.status} />
          </div>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            {formatDateTime(order.createdAt)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ItemThumbs order={order} />
          <div className="flex items-center gap-3">
            <span className="text-sm">
              <span className="text-muted-foreground">مبلغ: </span>
              <span className="font-extrabold text-primary">{formatToman(order.total)}</span>
            </span>
            {order.status === "pending" && (
              <Button size="sm" className="gap-1.5" disabled={pay.isPending} onClick={() => pay.mutate()}>
                {pay.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CreditCard className="size-3.5" />}
                {payLabel}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpen((value) => !value)}>
              جزئیات
              <ChevronDown className={open ? "size-3.5 rotate-180 transition-transform" : "size-3.5 transition-transform"} />
            </Button>
          </div>
        </div>

        {/* The tracking code is the thing customers come back for, so it shows
            even while the details are collapsed. */}
        {order.shipment && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Truck className="size-3.5 shrink-0 text-primary" />
            {order.shipment.carrier}
            <span className="mx-0.5">—</span>
            کد رهگیری:
            <span dir="ltr" className="font-mono">
              {order.shipment.trackingCode}
            </span>
          </p>
        )}
      </CardHeader>

      {open && <OrderDetails order={order} />}
    </Card>
  );
}

/** The «سفارش‌ها» tab of the account page. */
export function OrdersTab() {
  const [page, setPage] = React.useState(1);
  const orders = useOrders(page, 10);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  if (orders.isLoading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (orders.isError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <AlertCircle className="size-7 text-destructive" />
          <p className="text-sm text-muted-foreground">{errorMessage(orders.error)}</p>
          <Button variant="outline" onClick={() => orders.refetch()}>
            تلاش دوباره
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!orders.data || orders.data.items.length === 0) {
    return (
      <EmptyState
        title="هنوز سفارشی ثبت نکرده‌اید"
        description="پس از ثبت اولین سفارش، وضعیت و جزئیات آن همین‌جا نمایش داده می‌شود."
      >
        <EmptyStateLink to="/products">مشاهده محصولات</EmptyStateLink>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {orders.data.items.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}

      {orders.data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            صفحه قبل
          </Button>
          <span className="text-xs text-muted-foreground">
            صفحه {formatNumber(orders.data.page)} از {formatNumber(orders.data.totalPages)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= orders.data.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            صفحه بعد
          </Button>
        </div>
      )}

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <PackageSearch className="size-3.5" />
        در صورت وجود مشکل در سفارش، از طریق پشتیبانی پیگیری کنید.
      </p>
    </div>
  );
}
