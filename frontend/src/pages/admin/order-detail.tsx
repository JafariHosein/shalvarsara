import * as React from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  PackageCheck,
  Receipt,
  Save,
  Truck,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { AdminPageHeader } from "@/components/admin/page-header";
import { OrderStatusBadge } from "@/components/common/order-status-badge";
import { PaymentStatusBadge } from "@/components/common/payment-status-badge";
import { useAdminOrder, useSaveShipment, useSetOrderStatus } from "@/hooks/use-admin";
import { errorMessage } from "@/lib/api";
import { formatDateTime, formatNumber, formatToman, rialToToman, toFaDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ORDER_NEXT_STEPS,
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from "@/types/api";

/** The happy path, in the order an order walks through it. */
const TIMELINE: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered"];

/** A labelled row used in the side panels. */
function Field({ label, children, ltr = false }: { label: string; children: React.ReactNode; ltr?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("text-end", ltr && "font-mono text-xs")} dir={ltr ? "ltr" : undefined}>
        {children}
      </span>
    </div>
  );
}

/** Progress of one order through the fulfilment pipeline. */
function Timeline({ status }: { status: OrderStatus }) {
  if (status === "canceled") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-400">
        <XCircle className="size-4 shrink-0" />
        این سفارش لغو شده است؛ کالاهای آن به انبار برگشته‌اند.
      </div>
    );
  }

  const current = TIMELINE.indexOf(status);

  return (
    <ol className="flex items-start gap-1">
      {TIMELINE.map((step, index) => {
        const done = index <= current;
        return (
          <li key={step} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-xs font-bold",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : toFaDigits(index + 1)}
            </span>
            <span className={cn("text-[11px] leading-4", done ? "text-foreground" : "text-muted-foreground")}>
              {ORDER_STATUS_LABELS[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** One order: its lines, its payment, and the actions an operator can take. */
export function AdminOrderDetail() {
  const { id } = useParams();
  const orderId = id ? Number(id) : undefined;

  const orderQuery = useAdminOrder(orderId);
  const order = orderQuery.data;

  const setStatus = useSetOrderStatus();
  const saveShipment = useSaveShipment();

  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [carrier, setCarrier] = React.useState("");
  const [trackingCode, setTrackingCode] = React.useState("");

  const storedCarrier = order?.shipment?.carrier ?? "";
  const storedTracking = order?.shipment?.trackingCode ?? "";

  // Mirror the stored shipment into the inputs, without clobbering whatever the
  // operator is halfway through typing.
  React.useEffect(() => {
    setCarrier(storedCarrier);
    setTrackingCode(storedTracking);
  }, [order?.id, storedCarrier, storedTracking]);

  if (orderQuery.isLoading) {
    return (
      <>
        <AdminPageHeader icon={Receipt} title="سفارش" />
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <>
        <AdminPageHeader icon={Receipt} title="سفارش" />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <AlertCircle className="size-7 text-destructive" />
            <p className="text-sm text-muted-foreground">
              {orderQuery.error ? errorMessage(orderQuery.error) : "این سفارش پیدا نشد."}
            </p>
            <Button asChild variant="outline">
              <Link to="/admin/orders">بازگشت به فهرست سفارش‌ها</Link>
            </Button>
          </CardContent>
        </Card>
      </>
    );
  }

  const steps = ORDER_NEXT_STEPS[order.status] ?? [];
  const shipmentDirty = carrier.trim() !== storedCarrier || trackingCode.trim() !== storedTracking;
  const canSaveShipment = carrier.trim() !== "" && trackingCode.trim() !== "" && shipmentDirty;

  return (
    <>
      <AdminPageHeader
        icon={Receipt}
        title={`سفارش ${order.code}`}
        description={`ثبت‌شده در ${formatDateTime(order.createdAt)}`}
      >
        <OrderStatusBadge status={order.status} className="px-3 py-1" />
        <Button asChild variant="ghost" className="gap-1.5">
          <Link to="/admin/orders">
            <ArrowRight className="size-4" />
            بازگشت
          </Link>
        </Button>
      </AdminPageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* min-w-0 keeps the column from being stretched by the wide items
            table; the table itself scrolls inside its own wrapper. */}
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>وضعیت سفارش</CardTitle>
            </CardHeader>
            <CardContent>
              <Timeline status={order.status} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>اقلام سفارش</CardTitle>
              <CardDescription>قیمت‌ها همان لحظه ثبت سفارش است.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[520px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>کالا</TableHead>
                    <TableHead>قیمت واحد</TableHead>
                    <TableHead>تعداد</TableHead>
                    <TableHead className="text-end">جمع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link to={`/products/${item.slug}`} className="font-medium hover:text-primary">
                          {toFaDigits(item.title)}
                        </Link>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {item.variantLabel ? toFaDigits(item.variantLabel) : "بدون گونه"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatToman(item.unitPrice)}</TableCell>
                      <TableCell>{formatNumber(item.quantity)}</TableCell>
                      <TableCell className="whitespace-nowrap text-end">{formatToman(item.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Separator className="my-4" />

              <div className="ms-auto w-full max-w-xs space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">جمع کالاها</span>
                  <span>{formatToman(order.subtotal)}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      تخفیف {order.couponCode ? `(${order.couponCode})` : ""}
                    </span>
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
            </CardContent>
          </Card>

          {order.payment ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  پرداخت
                </CardTitle>
                <PaymentStatusBadge status={order.payment.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <Field label="مبلغ پرداخت">{formatToman(rialToToman(order.payment.amount))}</Field>
                <Field label="درگاه">{order.payment.gateway}</Field>
                {order.payment.refId ? <Field label="شماره پیگیری" ltr>{order.payment.refId}</Field> : null}
                {order.payment.cardPan ? <Field label="کارت" ltr>{order.payment.cardPan}</Field> : null}
                {order.payment.authority ? <Field label="شناسه تراکنش" ltr>{order.payment.authority}</Field> : null}
                <Field label="آخرین به‌روزرسانی">{formatDateTime(order.payment.createdAt)}</Field>
                {order.payment.message ? (
                  <p className="flex items-start gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    <AlertCircle className="mt-px size-3.5 shrink-0" />
                    {order.payment.message}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>اقدام‌ها</CardTitle>
              <CardDescription>
                {steps.length > 0
                  ? "گام بعدی این سفارش را انتخاب کنید."
                  : "این سفارش به پایان راه رسیده است."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {steps.length === 0 ? (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  وضعیت «{ORDER_STATUS_LABELS[order.status]}» نهایی است.
                </p>
              ) : (
                steps.map((step) => {
                  const Icon =
                    step.status === "canceled"
                      ? XCircle
                      : step.status === "paid"
                        ? CheckCircle2
                        : step.status === "processing"
                          ? PackageCheck
                          : step.status === "shipped"
                            ? Truck
                            : Check;
                  return (
                    <Button
                      key={step.status}
                      variant={step.status === "canceled" ? "outline" : "default"}
                      className={cn(
                        "w-full justify-start gap-2",
                        step.status === "canceled" && "text-destructive hover:text-destructive",
                      )}
                      disabled={setStatus.isPending}
                      onClick={() => {
                        if (step.status === "canceled") setConfirmCancel(true);
                        else setStatus.mutate({ id: order.id, status: step.status });
                      }}
                    >
                      {setStatus.isPending && setStatus.variables?.status === step.status ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                      {step.label}
                    </Button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                مرسوله
              </CardTitle>
              <CardDescription>
                با ثبت کد رهگیری، مشتری آن را در «سفارش‌های من» می‌بیند.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="shipment-carrier">شرکت حمل</Label>
                <Input
                  id="shipment-carrier"
                  value={carrier}
                  onChange={(event) => setCarrier(event.target.value)}
                  placeholder="پست پیشتاز، تیپاکس، …"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="shipment-tracking">کد رهگیری</Label>
                <Input
                  id="shipment-tracking"
                  value={trackingCode}
                  onChange={(event) => setTrackingCode(event.target.value)}
                  dir="ltr"
                  className="text-start"
                  placeholder="1234567890"
                />
              </div>

              <Button
                className="w-full gap-1.5"
                disabled={!canSaveShipment || saveShipment.isPending}
                onClick={() => saveShipment.mutate({ id: order.id, carrier: carrier.trim(), trackingCode: trackingCode.trim() })}
              >
                {saveShipment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {order.shipment ? "ویرایش مرسوله" : "ثبت مرسوله"}
              </Button>

              {order.shipment ? (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <Field label="وضعیت مرسوله">{order.shipment.status}</Field>
                  {order.shipment.shippedAt ? (
                    <Field label="زمان ارسال">{formatDateTime(order.shipment.shippedAt)}</Field>
                  ) : null}
                  {order.shipment.deliveredAt ? (
                    <Field label="زمان تحویل">{formatDateTime(order.shipment.deliveredAt)}</Field>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                گیرنده
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Field label="نام">{order.shippingAddress.receiverName}</Field>
              <Field label="موبایل" ltr>
                {order.shippingAddress.phone}
              </Field>
              <Field label="استان">{order.shippingAddress.province}</Field>
              <Field label="شهر">{order.shippingAddress.city}</Field>
              <Field label="نشانی">{order.shippingAddress.line1}</Field>
              <Field label="کد پستی" ltr>
                {order.shippingAddress.postalCode}
              </Field>
              {order.note ? (
                <p className="rounded-md bg-muted p-2 text-xs leading-6 text-muted-foreground">
                  <span className="font-semibold text-foreground">یادداشت مشتری: </span>
                  {order.note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        destructive
        title="لغو سفارش"
        confirmLabel="سفارش را لغو کن"
        isPending={setStatus.isPending}
        description={
          <>
            سفارش {order.code} لغو می‌شود و موجودی کالاهای آن به انبار برمی‌گردد. این کار قابل بازگشت نیست.
          </>
        }
        onConfirm={() =>
          setStatus.mutate({ id: order.id, status: "canceled" }, { onSuccess: () => setConfirmCancel(false) })
        }
      />
    </>
  );
}
