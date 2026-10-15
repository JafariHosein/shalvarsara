import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  BadgePercent,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AddressDialog } from "@/components/account/addresses-tab";
import { EmptyState, EmptyStateLink } from "@/components/common/empty-state";
import { SmartImage } from "@/components/common/smart-image";
import { useOrderPreview } from "@/hooks/use-orders";
import { ApiError, errorMessage } from "@/lib/api";
import { CART_QUERY_KEY } from "@/lib/cart-cache";
import { formatNumber, formatToman, toEnDigits, toFaDigits } from "@/lib/format";
import { LAST_PAYMENT_KEY, type StoredPaymentStart } from "@/lib/payment-session";
import { addressService } from "@/services/addresses";
import { orderService } from "@/services/orders";
import { paymentService } from "@/services/payments";
import type { Address, OrderPreviewItem } from "@/types/api";

/** The four steps a customer walks through, with the current one highlighted. */
function Steps({ current }: { current: number }) {
  const steps = ["سبد خرید", "اطلاعات ارسال", "پرداخت", "تأیید"];
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm">
      {steps.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                done
                  ? "flex size-6 items-center justify-center rounded-full bg-primary/15 text-primary"
                  : step === current
                    ? "flex size-6 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground"
                    : "flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground"
              }
            >
              {done ? <Check className="size-3.5" /> : formatNumber(step)}
            </span>
            <span className={step === current ? "font-semibold" : "text-muted-foreground"}>{label}</span>
            {step < steps.length && <span className="mx-1 text-muted-foreground/50">←</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** One selectable shipping address. */
function AddressOption({
  address,
  selected,
  onSelect,
}: {
  address: Address;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={
        selected
          ? "w-full rounded-lg border-2 border-primary bg-primary/5 p-3 text-start transition-colors"
          : "w-full rounded-lg border-2 border-transparent bg-muted/40 p-3 text-start transition-colors hover:bg-muted"
      }
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <MapPin className={selected ? "size-4 text-primary" : "size-4 text-muted-foreground"} />
          {address.receiverName}
        </span>
        <span className="flex items-center gap-2">
          {address.isDefault && <Badge variant="secondary">پیش‌فرض</Badge>}
          {selected && <Check className="size-4 text-primary" />}
        </span>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {address.province}، {address.city}، {address.line1}
        {address.line2 ? `، ${address.line2}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        <span dir="ltr">{address.phone}</span>
        <span className="mx-2">·</span>
        کد پستی <span dir="ltr">{address.postalCode}</span>
      </p>
    </button>
  );
}

/** A preview line: what will be ordered, priced by the server. */
function PreviewLine({ item }: { item: OrderPreviewItem }) {
  return (
    <li className="flex gap-3">
      <Link to={`/products/${item.slug}`} className="shrink-0">
        <SmartImage src={item.imageUrl} alt={item.title} wrapperClassName="size-16 rounded-md" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link to={`/products/${item.slug}`} className="line-clamp-1 text-sm font-medium hover:text-primary">
          {toFaDigits(item.title)}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {toFaDigits(item.variantLabel || "—")}
          <span className="mx-1.5">·</span>
          {formatNumber(item.quantity)} عدد
        </p>
        {!item.isAvailable && (
          <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3.5" />
            موجودی کافی نیست
          </p>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold">{formatToman(item.lineTotal)}</span>
    </li>
  );
}

/**
 * Checkout: shipping address, coupon and the server-priced total, then off to
 * ZarinPal.
 *
 * Every number on this page comes from `POST /orders/preview`, so the amount the
 * customer approves here is exactly the amount the order is created with.
 */
export function CheckoutPage() {
  const queryClient = useQueryClient();

  const [couponInput, setCouponInput] = React.useState("");
  const [coupon, setCoupon] = React.useState("");
  const [addressId, setAddressId] = React.useState<number | null>(null);
  const [note, setNote] = React.useState("");

  const addresses = useQuery({
    queryKey: ["addresses"],
    queryFn: ({ signal }) => addressService.list(signal),
  });

  const preview = useOrderPreview(coupon);
  const emptyCart = preview.error instanceof ApiError && preview.error.code === "empty_cart";

  // Preselect the default address (or the only one) once the book has loaded.
  React.useEffect(() => {
    if (addressId !== null || !addresses.data?.length) return;
    const preferred = addresses.data.find((address) => address.isDefault) ?? addresses.data[0];
    setAddressId(preferred.id);
  }, [addresses.data, addressId]);

  const applyCoupon = useMutation({
    mutationFn: (code: string) => orderService.preview(code),
    onSuccess: (data, code) => {
      setCoupon(data.couponCode ?? code.trim().toUpperCase());
      toast.success("کد تخفیف اعمال شد.");
    },
    onError: (error) => {
      setCoupon("");
      toast.error(errorMessage(error));
    },
  });

  const pay = useMutation({
    mutationFn: async () => {
      const order = await orderService.create({
        addressId: addressId as number,
        couponCode: coupon || undefined,
        note: note.trim() || undefined,
      });
      const start = await paymentService.start(order.id);
      return { order, start };
    },
    onSuccess: ({ start }) => {
      // Hand the order back to the cart badge before leaving the SPA, and keep
      // the session details so the result page can show the amount and the
      // sandbox badge even before its own request finishes.
      void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      const stored: StoredPaymentStart = {
        paymentId: start.paymentId,
        orderId: start.orderId,
        orderCode: start.orderCode,
        authority: start.authority,
        amountRial: start.amountRial,
        sandbox: start.sandbox,
      };
      sessionStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(stored));
      window.location.assign(start.gatewayUrl);
    },
    onError: async (error) => {
      // The order may have been rejected because the cart changed under us.
      if (error instanceof ApiError && error.code === "out_of_stock") {
        await queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        await preview.refetch();
      }
      toast.error(errorMessage(error));
    },
  });

  if (emptyCart) {
    return (
      <div className="container py-16">
        <EmptyState title="سبد خرید شما خالی است" description="برای تسویه حساب، ابتدا کالایی به سبد اضافه کنید.">
          <EmptyStateLink to="/products">مشاهده محصولات</EmptyStateLink>
        </EmptyState>
      </div>
    );
  }

  const data = preview.data;
  const paying = pay.isPending;
  const blocked = paying || !data || data.hasUnavailable || addressId === null;

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <ShoppingBag className="size-6 text-primary" />
          تسویه حساب
        </h1>
        <Steps current={2} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* ---------- shipping address ---------- */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-4 text-primary" />
                آدرس تحویل
              </CardTitle>
              <AddressDialog
                trigger={
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Plus className="size-3.5" />
                    آدرس جدید
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {addresses.isLoading ? (
                <Skeleton className="h-24 w-full rounded-lg" />
              ) : addresses.isError ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>بارگذاری آدرس‌ها ناموفق بود. صفحه را دوباره بارگذاری کنید.</AlertDescription>
                </Alert>
              ) : addresses.data && addresses.data.length > 0 ? (
                addresses.data.map((address) => (
                  <AddressOption
                    key={address.id}
                    address={address}
                    selected={address.id === addressId}
                    onSelect={() => setAddressId(address.id)}
                  />
                ))
              ) : (
                <Alert>
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    برای ثبت سفارش، حداقل یک آدرس تحویل لازم است. با دکمهٔ «آدرس جدید» نخستین آدرس خود را اضافه کنید.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* ---------- coupon ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgePercent className="size-4 text-primary" />
                کد تخفیف
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={couponInput}
                  onChange={(event) => setCouponInput(toEnDigits(event.target.value).toUpperCase())}
                  placeholder="مثلاً WELCOME10"
                  dir="ltr"
                  className="text-start"
                  disabled={paying}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    const code = couponInput.trim();
                    if (code) applyCoupon.mutate(code);
                  }}
                />
                {coupon ? (
                  <Button
                    variant="outline"
                    className="shrink-0 gap-1.5"
                    disabled={paying}
                    onClick={() => {
                      setCoupon("");
                      setCouponInput("");
                      toast.info("کد تخفیف برداشته شد.");
                    }}
                  >
                    <X className="size-4" />
                    حذف
                  </Button>
                ) : (
                  <Button
                    className="shrink-0"
                    disabled={paying || applyCoupon.isPending || couponInput.trim().length === 0}
                    onClick={() => applyCoupon.mutate(couponInput.trim())}
                  >
                    {applyCoupon.isPending ? <Loader2 className="size-4 animate-spin" /> : "اعمال"}
                  </Button>
                )}
              </div>

              {coupon && data && data.discount > 0 && (
                <p className="flex items-center gap-1.5 rounded-md bg-primary/10 p-2 text-xs text-primary">
                  <Check className="size-3.5" />
                  کد «{coupon}» اعمال شد؛ {formatToman(data.discount)} تخفیف لحاظ شده است.
                </p>
              )}
            </CardContent>
          </Card>

          {/* ---------- note ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توضیحات سفارش (اختیاری)</CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="order-note" className="sr-only">
                توضیحات سفارش
              </Label>
              <Textarea
                id="order-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={500}
                rows={3}
                disabled={paying}
                placeholder="مثلاً: برای بسته‌بندی کادویی با من تماس بگیرید."
              />
            </CardContent>
          </Card>
        </div>

        {/* ---------- summary ---------- */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>خلاصه سفارش</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full rounded-md" />
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              ) : preview.isError ? (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>{errorMessage(preview.error)}</AlertDescription>
                </Alert>
              ) : data ? (
                <>
                  <ul className="space-y-3">
                    {data.items.map((item) => (
                      <PreviewLine key={`${item.productId}-${item.variantId ?? 0}`} item={item} />
                    ))}
                  </ul>

                  <Separator />

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      جمع کالاها ({formatNumber(data.itemCount)} عدد)
                    </span>
                    <span className="font-medium">{formatToman(data.subtotal)}</span>
                  </div>

                  {data.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">تخفیف</span>
                      <span className="font-medium text-primary">−{formatToman(data.discount)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="size-4" />
                      هزینه ارسال
                    </span>
                    <span className="font-medium">
                      {data.shippingCost === 0 ? "رایگان" : formatToman(data.shippingCost)}
                    </span>
                  </div>

                  {data.shippingCost > 0 && (
                    <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                      با {formatToman(data.freeFrom - data.subtotal)} خرید بیشتر، ارسال رایگان می‌شود.
                    </p>
                  )}

                  <Separator />

                  <div className="flex justify-between text-base">
                    <span className="font-semibold">مبلغ قابل پرداخت</span>
                    <span className="font-extrabold text-primary">{formatToman(data.total)}</span>
                  </div>
                </>
              ) : null}

              {data?.hasUnavailable && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertDescription>
                    برخی اقلام ناموجود شده‌اند.{" "}
                    <Link to="/cart" className="font-semibold underline">
                      بازگشت به سبد خرید
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

              <Button size="lg" className="w-full gap-2" disabled={blocked} onClick={() => pay.mutate()}>
                {paying ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                {paying ? "در حال انتقال به درگاه…" : "پرداخت و انتقال به درگاه"}
              </Button>

              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" />
                پرداخت از طریق درگاه امن زرین‌پال انجام می‌شود و موجودی کالا در همان لحظه برای شما رزرو می‌گردد.
              </p>

              <Button asChild variant="ghost" className="w-full" disabled={paying}>
                <Link to="/cart">بازگشت به سبد خرید</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
