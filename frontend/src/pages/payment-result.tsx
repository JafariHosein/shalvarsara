import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Loader2, Receipt, RotateCcw, XCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SmartImage } from "@/components/common/smart-image";
import { useOrder } from "@/hooks/use-orders";
import { formatDateTime, formatNumber, formatToman, toFaDigits } from "@/lib/format";
import { readLastPayment } from "@/lib/payment-session";
import { isPaidOrderStatus, ORDER_STATUS_LABELS, type Order } from "@/types/api";

/** One line of the receipt. */
function ReceiptRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** Full receipt for a paid order. */
function PaidReceipt({ order }: { order: Order }) {
  return (
    <Card className="overflow-hidden">
      <div className="bg-primary/5 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-bold">
            <Receipt className="size-4 text-primary" />
            شماره سفارش: <span dir="ltr">{order.code}</span>
          </span>
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="size-3.5 text-primary" />
            پرداخت‌شده
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-4 pt-6">
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex gap-3">
              <Link to={`/products/${item.slug}`} className="shrink-0">
                <SmartImage src={item.imageUrl} alt={item.title} wrapperClassName="size-14 rounded-md" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link to={`/products/${item.slug}`} className="line-clamp-1 text-sm font-medium hover:text-primary">
                  {toFaDigits(item.title)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {toFaDigits(item.variantLabel)}
                  <span className="mx-1.5">·</span>
                  {formatNumber(item.quantity)} عدد
                </p>
              </div>
              <span className="shrink-0 text-sm">{formatToman(item.lineTotal)}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="space-y-2">
          <ReceiptRow label="جمع کالاها" value={formatToman(order.subtotal)} />
          {order.discount > 0 && (
            <ReceiptRow
              label={order.couponCode ? `تخفیف (${order.couponCode})` : "تخفیف"}
              value={<span className="text-primary">−{formatToman(order.discount)}</span>}
            />
          )}
          <ReceiptRow
            label="هزینه ارسال"
            value={order.shippingCost === 0 ? "رایگان" : formatToman(order.shippingCost)}
          />
          <Separator />
          <ReceiptRow
            label="مبلغ پرداخت‌شده"
            value={<span className="font-extrabold text-primary">{formatToman(order.total)}</span>}
          />
          {order.payment?.refId && (
            <ReceiptRow label="شماره پیگیری" value={<span dir="ltr">{order.payment.refId}</span>} />
          )}
          {order.payment?.cardPan && (
            <ReceiptRow label="کارت پرداخت" value={<span dir="ltr">{order.payment.cardPan}</span>} />
          )}
          {order.paidAt && <ReceiptRow label="زمان پرداخت" value={formatDateTime(order.paidAt)} />}
        </div>

        <Separator />

        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="mb-1 font-semibold">ارسال به</p>
          <p className="leading-6 text-muted-foreground">
            {order.shippingAddress.receiverName} — {order.shippingAddress.province}، {order.shippingAddress.city}،{" "}
            {order.shippingAddress.line1}
          </p>
          <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
            {order.shippingAddress.phone}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Where ZarinPal sends the customer back to.
 *
 * The API already verified the payment and redirected here with `?order=&status=`;
 * this page only reads the stored order back and presents it. The query string is
 * treated as a hint — the order status shown always comes from the API.
 */
export function PaymentResultPage() {
  const [params] = useSearchParams();
  const orderParam = params.get("order");
  const status = params.get("status");

  const orderId = orderParam && /^\d+$/.test(orderParam) ? Number(orderParam) : undefined;
  const stored = React.useMemo(() => readLastPayment(), []);
  const order = useOrder(orderId);

  // Remembered from the redirect: only used to decorate the failure screens.
  const remembered = stored && stored.orderId === orderId ? stored : undefined;
  // `paid` is the first of several captured statuses: by the time the customer
  // comes back, the warehouse may already have moved the order to processing or
  // even shipped it. Anything at or past `paid` means the payment succeeded.
  const paid = isPaidOrderStatus(order.data?.status);
  // No id in the return URL is a different failure from "we could not read it".
  const missingOrder = !orderId;

  if (status === "error") {
    return (
      <div className="container max-w-2xl py-16">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-7 text-destructive" />
            </span>
            <h1 className="text-xl font-extrabold">تراکنش پیدا نشد</h1>
            <p className="max-w-md text-sm leading-7 text-muted-foreground">
              اطلاعات این بازگشت به هیچ تراکنش ثبت‌شده‌ای تعلق ندارد. اگر مبلغی از حساب شما کسر شده است، با پشتیبانی
              تماس بگیرید.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link to="/account/orders">مشاهده سفارش‌ها</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/products">ادامه خرید</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">نتیجه پرداخت</h1>
        {remembered?.sandbox && (
          <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            پرداخت آزمایشی (سندباکس زرین‌پال)
          </Badge>
        )}
      </div>

      {order.isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">در حال دریافت وضعیت سفارش…</p>
          </CardContent>
        </Card>
      ) : paid && order.data ? (
        <>
          <Alert className="mb-6 border-primary/30 bg-primary/5">
            <CheckCircle2 className="size-4 text-primary" />
            <AlertTitle>پرداخت با موفقیت انجام شد</AlertTitle>
            <AlertDescription>
              سفارش شما ثبت و پرداخت آن تأیید شد. جزئیات در بخش «سفارش‌های من» قابل پیگیری است.
            </AlertDescription>
          </Alert>

          <PaidReceipt order={order.data} />

          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/account/orders">پیگیری سفارش</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/products">ادامه خرید</Link>
            </Button>
          </div>
        </>
      ) : (
        <>
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="size-4" />
            <AlertTitle>{missingOrder ? "سفارشی برای نمایش نیست" : "پرداخت انجام نشد"}</AlertTitle>
            <AlertDescription>
              {missingOrder
                ? "نشانی بازگشت شناسهٔ سفارش را همراه ندارد. اگر مبلغی از حساب شما کسر شده است، با پشتیبانی تماس بگیرید."
                : order.isError
                  ? "وضعیت این سفارش قابل خواندن نبود. با ورود به حساب کاربری، وضعیت واقعی سفارش را ببینید."
                  : order.data?.status === "canceled"
                    ? "این سفارش لغو شده است. اگر مبلغی از حساب شما کسر شده باشد حداکثر تا ۷۲ ساعت به‌صورت خودکار بازگردانده می‌شود."
                    : "پرداخت این سفارش تکمیل نشده است. اگر مبلغی از حساب شما کسر شده باشد حداکثر تا ۷۲ ساعت به‌صورت خودکار بازگردانده می‌شود."}
            </AlertDescription>
          </Alert>

          {order.data && (
            <Card className="mb-6">
              <CardContent className="space-y-3 py-6">
                <ReceiptRow label="شماره سفارش" value={<span dir="ltr">{order.data.code}</span>} />
                <ReceiptRow
                  label="وضعیت"
                  value={ORDER_STATUS_LABELS[order.data.status] ?? order.data.status}
                />
                <ReceiptRow label="مبلغ سفارش" value={formatToman(order.data.total)} />
                {order.data.payment?.message && (
                  <ReceiptRow label="پیام درگاه" value={<span className="text-xs">{order.data.payment.message}</span>} />
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <Button asChild className="gap-2">
              <Link to="/account/orders">
                <RotateCcw className="size-4" />
                تلاش دوباره برای پرداخت
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/products">ادامه خرید</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
