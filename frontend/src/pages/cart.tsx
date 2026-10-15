import { Link } from "react-router-dom";
import { AlertCircle, Minus, Plus, ShieldCheck, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, EmptyStateLink } from "@/components/common/empty-state";
import { SmartImage } from "@/components/common/smart-image";
import { useCart } from "@/hooks/use-cart";
import { formatNumber, formatToman, toFaDigits } from "@/lib/format";
import { FREE_SHIPPING_THRESHOLD, shippingCost } from "@/lib/shipping";
import type { CartLine } from "@/store/cart-store";

/** Warning shown when a line can no longer be bought as it stands. */
function LineWarning({ line }: { line: CartLine }) {
  const message = !line.isAvailable
    ? "این محصول فعلاً موجود نیست و در زمان پرداخت از سفارش حذف می‌شود."
    : line.quantity > line.maxQuantity
      ? `فقط ${formatNumber(line.maxQuantity)} عدد در انبار موجود است.`
      : null;

  if (!message) return null;

  return (
    <p className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
      <AlertCircle className="mt-px size-3.5 shrink-0" />
      {message}
    </p>
  );
}

/** Cart page. Reads the server cart when signed in, the browser cart otherwise. */
export function CartPage() {
  const { lines, subtotal, isLoading, remove, setQuantity, clear } = useCart();

  const shipping = shippingCost(subtotal);
  const total = subtotal + shipping;
  const hasUnavailable = lines.some((line) => !line.isAvailable);

  if (isLoading && lines.length === 0) {
    return (
      <div className="container space-y-4 py-8">
        <Skeleton className="h-8 w-48" />
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container py-16">
        <EmptyState
          title="سبد خرید شما خالی است"
          description="از میان ۵۰ مدل شلوار موجود، مورد دلخواهتان را انتخاب کنید."
        >
          <EmptyStateLink to="/products">شروع خرید</EmptyStateLink>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <ShoppingBag className="size-6 text-primary" />
          سبد خرید
          <span className="text-sm font-normal text-muted-foreground">
            ({lines.length.toLocaleString("fa-IR")} قلم)
          </span>
        </h1>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => {
            clear();
            toast.success("سبد خرید خالی شد.");
          }}
        >
          <Trash2 className="size-4" />
          خالی کردن سبد
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ---------- lines ---------- */}
        <div className="space-y-4">
          {lines.map((line) => (
            <article key={line.key} className="flex gap-4 rounded-lg border bg-card p-3">
              <Link to={`/products/${line.slug}`} className="shrink-0">
                <SmartImage
                  src={line.image}
                  alt={line.title}
                  wrapperClassName="size-24 rounded-md sm:size-28"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    to={`/products/${line.slug}`}
                    className="line-clamp-2 text-sm font-semibold hover:text-primary"
                  >
                    {toFaDigits(line.title)}
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label="حذف از سبد"
                    onClick={() => {
                      remove(line);
                      toast.success("از سبد خرید حذف شد.");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {line.size && <span className="rounded border px-1.5 py-0.5">سایز {toFaDigits(line.size)}</span>}
                  {line.color && <span className="rounded border px-1.5 py-0.5">رنگ {line.color}</span>}
                </div>

                <LineWarning line={line} />

                <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex h-9 items-center rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-none"
                      aria-label="افزودن یکی"
                      disabled={!line.isAvailable || line.quantity >= line.maxQuantity}
                      onClick={() => setQuantity(line, line.quantity + 1)}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                    <span className="w-9 text-center text-sm font-semibold">
                      {line.quantity.toLocaleString("fa-IR")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 rounded-none"
                      aria-label="کاهش یکی"
                      disabled={line.quantity <= 1}
                      onClick={() => setQuantity(line, line.quantity - 1)}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                  </div>

                  <span className="font-bold">{formatToman(line.unitPrice * line.quantity)}</span>
                </div>
              </div>
            </article>
          ))}
        </div>

        {/* ---------- summary ---------- */}
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>خلاصه سفارش</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">جمع کالاها</span>
                <span className="font-medium">{formatToman(subtotal)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">هزینه ارسال</span>
                <span className="font-medium">
                  {shipping === 0 ? "رایگان" : formatToman(shipping)}
                </span>
              </div>

              {shipping > 0 && (
                <p className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                  با {formatToman(FREE_SHIPPING_THRESHOLD - subtotal)} خرید بیشتر، ارسال رایگان می‌شود.
                </p>
              )}

              <Separator />

              <div className="flex justify-between text-base">
                <span className="font-semibold">مبلغ قابل پرداخت</span>
                <span className="font-extrabold text-primary">{formatToman(total)}</span>
              </div>

              {hasUnavailable && (
                <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                  برخی اقلام ناموجود شده‌اند؛ برای ادامهٔ خرید آن‌ها را حذف کنید.
                </p>
              )}

              <Button asChild size="lg" className="w-full" disabled={hasUnavailable}>
                <Link to="/checkout">
                  <ShieldCheck className="size-4" />
                  ادامه فرآیند خرید
                </Link>
              </Button>

              <p className="flex items-start justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-px size-3.5 shrink-0 text-primary" />
                پرداخت امن از طریق درگاه زرین‌پال
              </p>

              <Button asChild variant="ghost" className="w-full">
                <Link to="/products">ادامه خرید</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
