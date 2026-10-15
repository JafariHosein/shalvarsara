import * as React from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronRight, CreditCard, Headset, Minus, Plus, ShoppingBag, ShieldCheck, Truck, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { EmptyState } from "@/components/common/empty-state";
import { SmartImage } from "@/components/common/smart-image";
import { DiscountChip, Price } from "@/components/product/price";
import { ProductGrid } from "@/components/product/product-grid";
import { RatingStars } from "@/components/product/rating-stars";
import { useProduct, useRelatedProducts } from "@/hooks/use-products";
import { useCart } from "@/hooks/use-cart";
import { formatNumber, toEnDigits, toFaDigits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { discountPercent, variantColors, variantSizes, type ProductVariant } from "@/types/api";

/** A colour choice, with availability for the currently selected size. */
type ColorOption = { color: string; colorHex: string; stock: number; disabled?: boolean };

/** Small colour swatch button. */
function ColorSwatch({
  color,
  hex,
  selected,
  disabled,
  onClick,
}: {
  color: string;
  hex: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={color}
      title={color}
      className={cn(
        "grid size-9 place-items-center rounded-full border-2 transition-colors",
        selected ? "border-primary" : "border-border hover:border-muted-foreground/50",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span className="size-6 rounded-full border" style={{ backgroundColor: hex }} />
    </button>
  );
}

/** Quantity stepper clamped to the available stock. */
function QuantityStepper({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="inline-flex h-10 items-center rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-none"
        aria-label="افزودن یکی"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        <Plus className="size-4" />
      </Button>
      <span className="w-10 text-center text-sm font-semibold" data-testid="quantity">
        {value.toLocaleString("fa-IR")}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 rounded-none"
        aria-label="کاهش یکی"
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
      >
        <Minus className="size-4" />
      </Button>
    </div>
  );
}

/** Product page: gallery, variant picker, description and related items. */
export function ProductDetailPage() {
  const { slug = "" } = useParams();
  const { data: product, isLoading, isError } = useProduct(slug);
  const related = useRelatedProducts(slug, 8);
  const { add: addToCart } = useCart();

  const [activeImage, setActiveImage] = React.useState(0);
  const [size, setSize] = React.useState<string>("");
  const [color, setColor] = React.useState<string>("");
  const [quantity, setQuantity] = React.useState(1);

  // Reset the selection whenever a different product is opened.
  React.useEffect(() => {
    setActiveImage(0);
    setQuantity(1);
    setSize("");
    setColor("");
  }, [slug]);

  const sizes = React.useMemo(() => (product ? variantSizes(product) : []), [product]);
  const colors = React.useMemo(() => (product ? variantColors(product) : []), [product]);

  // Default to the first in-stock size/colour once data arrives.
  React.useEffect(() => {
    if (!product) return;
    if (!size && sizes.length) setSize(sizes[0]);
  }, [product, size, sizes]);

  React.useEffect(() => {
    if (!product || color) return;
    const first = colors.find((entry) => entry.stock > 0) ?? colors[0];
    if (first) setColor(first.color);
  }, [product, color, colors]);

  /** The concrete variant matching the current selection, if any. */
  const selectedVariant: ProductVariant | null = React.useMemo(() => {
    if (!product || !size || !color) return null;
    return product.variants.find((variant) => variant.size === size && variant.color === color) ?? null;
  }, [product, size, color]);

  const availableStock = selectedVariant ? selectedVariant.stock : (product?.stock ?? 0);
  const inStock = availableStock > 0;

  // Colours that exist for the chosen size (so impossible combinations cannot be picked).
  const colorsForSize = React.useMemo<ColorOption[]>(() => {
    if (!product || !size) return colors;
    const allowed = new Set(
      product.variants.filter((variant) => variant.size === size).map((variant) => variant.color),
    );
    return colors.map((entry) => ({ ...entry, disabled: !allowed.has(entry.color) }));
  }, [product, size, colors]);

  if (isError) {
    return (
      <div className="container py-16">
        <EmptyState
          title="محصول پیدا نشد"
          description="ممکن است این محصول حذف شده یا نشانی اشتباه باشد."
        >
          <Button asChild className="mt-2">
            <Link to="/products">بازگشت به فروشگاه</Link>
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (isLoading || !product) {
    return (
      <div className="container grid gap-10 py-10 lg:grid-cols-2">
        <Skeleton className="aspect-[4/5] w-full rounded-lg" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-40" />
        </div>
      </div>
    );
  }

  const percent = discountPercent(product);
  const images = product.images.length ? product.images : [{ id: 0, productId: product.id, url: "", alt: product.title, isPrimary: true, sortOrder: 0 }];
  const current = images[Math.min(activeImage, images.length - 1)];

  function handleAddToCart() {
    if (!product) return;
    if (sizes.length > 0 && !size) {
      toast.error("لطفاً اندازه را انتخاب کنید.");
      return;
    }
    if (!inStock) {
      toast.error("این ترکیب سایز و رنگ موجود نیست.");
      return;
    }
    addToCart(product, selectedVariant, quantity);
    toast.success("به سبد خرید اضافه شد.", {
      description: toFaDigits(product.title),
      action: { label: "مشاهده سبد", onClick: () => (window.location.href = "/cart") },
    });
  }

  return (
    <div className="container py-8">
      {/* breadcrumb */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="مسیر صفحه">
        <Link to="/" className="hover:text-primary">
          خانه
        </Link>
        <ChevronRight className="size-3.5 rtl:-scale-x-100" />
        <Link to="/products" className="hover:text-primary">
          محصولات
        </Link>
        {product.category && (
          <>
            <ChevronRight className="size-3.5 rtl:-scale-x-100" />
            <Link to={`/products?category=${product.category.slug}`} className="hover:text-primary">
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="size-3.5 rtl:-scale-x-100" />
        <span className="truncate text-foreground">{toFaDigits(product.title)}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        {/* ---------- gallery ---------- */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border bg-card">
            <SmartImage
              src={current.url}
              alt={current.alt || product.title}
              wrapperClassName="aspect-[4/5] w-full"
            />
            {percent > 0 && <DiscountChip percent={percent} className="absolute start-4 top-4" />}
          </div>

          {images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {images.map((image, index) => (
                <button
                  key={image.id || index}
                  type="button"
                  onClick={() => setActiveImage(index)}
                  className={cn(
                    "overflow-hidden rounded-lg border transition-colors",
                    index === activeImage ? "border-primary" : "border-border hover:border-muted-foreground/50",
                  )}
                  aria-label={`تصویر ${index + 1}`}
                >
                  <SmartImage
                    src={image.url}
                    alt={image.alt || product.title}
                    wrapperClassName="aspect-square w-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ---------- info ---------- */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{product.pantType}</Badge>
            <Badge variant="outline">{product.gender}</Badge>
            {product.brand && <span className="text-sm text-muted-foreground">برند {product.brand}</span>}
          </div>

          <h1 className="text-2xl font-extrabold leading-9 sm:text-3xl">{toFaDigits(product.title)}</h1>

          <RatingStars value={product.ratingAvg} count={product.ratingCount} />

          <Separator />

          <Price price={product.price} discountPrice={product.discountPrice} size="lg" />

          <p className="leading-8 text-muted-foreground">{product.shortDesc}</p>

          {/* sizes */}
          {sizes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">اندازه</span>
                <span className="text-xs text-muted-foreground">جدول سایز بر حسب سانتی‌متر</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {sizes.map((option) => {
                  const stock = product.variants
                    .filter((variant) => variant.size === option)
                    .reduce((sum, variant) => sum + variant.stock, 0);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSize(option)}
                      disabled={stock <= 0}
                      aria-pressed={size === option}
                      className={cn(
                        "min-w-12 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                        size === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hover:border-primary",
                        stock <= 0 && "cursor-not-allowed opacity-40 line-through",
                      )}
                    >
                      {toFaDigits(option)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* colours */}
          {colorsForSize.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">
                رنگ
                {color && <span className="ms-2 text-muted-foreground">{color}</span>}
              </span>
              <div className="flex flex-wrap gap-2">
                {colorsForSize.map((entry) => (
                  <ColorSwatch
                    key={entry.color}
                    color={entry.color}
                    hex={entry.colorHex}
                    selected={color === entry.color}
                    disabled={entry.disabled}
                    onClick={() => setColor(entry.color)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* quantity + add */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <QuantityStepper value={quantity} max={Math.max(1, availableStock)} onChange={setQuantity} />
            <Button size="lg" className="flex-1 gap-2 sm:flex-none" disabled={!inStock} onClick={handleAddToCart}>
              <ShoppingBag className="size-5" />
              {inStock ? "افزودن به سبد خرید" : "ناموجود"}
            </Button>
          </div>

          {inStock && availableStock <= 5 && (
            <p className="text-xs font-medium text-destructive">
              تنها {formatNumber(availableStock)} عدد از این ترکیب باقی مانده است.
            </p>
          )}

          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <Truck className="size-4 text-primary" />
            ارسال از تهران — سفارش‌های تا ساعت ۱۴ امروز، فردا تحویل داده می‌شوند.
          </div>

          {/* Trust row: icon + two short lines, sized to sit under the buy box. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { icon: ShieldCheck, title: "ضمانت اصالت", text: "کالای اصل و فاکتوردار" },
              { icon: Undo2, title: "۷ روز بازگشت", text: "بدون قید و شرط" },
              { icon: CreditCard, title: "پرداخت امن", text: "درگاه زرین‌پال" },
              { icon: Headset, title: "پشتیبانی", text: "۹ تا ۱۸ هر روز" },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-lg bg-muted/40 p-3">
                {/* 1.75 stroke: matches the small, regular-weight label beside it. */}
                <Icon className="size-4 text-primary" strokeWidth={1.75} />
                <p className="mt-2 text-xs font-semibold">{title}</p>
                <p className="text-[11px] leading-5 text-muted-foreground text-pretty">{text}</p>
              </div>
            ))}
          </div>

          {/* details */}
          <Accordion type="single" collapsible defaultValue="description" className="rounded-lg border bg-card px-4">
            <AccordionItem value="description">
              <AccordionTrigger>توضیحات محصول</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-sm leading-8 text-muted-foreground">
                  {product.description
                    .split("\n")
                    .filter(Boolean)
                    .map((paragraph) => (
                      <p key={paragraph}>{toFaDigits(paragraph)}</p>
                    ))}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="size-guide">
              <AccordionTrigger>راهنمای انتخاب سایز</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  <p className="text-sm leading-7 text-muted-foreground text-pretty">
                    سایز شلوار همان دور کمر بر حسب اینچ است. اگر دور کمر خود را با متری
                    می‌شناسید، عدد مقابل سایز را ببینید؛ سایز ۳۲ یعنی دور کمر نزدیک به
                    ۸۱ سانتی‌متر. اگر بین دو سایز مرزی هستید، سایز بزرگ‌تر را انتخاب
                    کنید — شلوار تن‌شده کمتر از شلوار گشاد جذاب به نظر می‌رسد.
                  </p>

                  {sizes.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-24">سایز</TableHead>
                          <TableHead>دور کمر (سانتی‌متر)</TableHead>
                          <TableHead>قد پا / دم پا</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sizes.map((option) => {
                          const inches = Number(toEnDigits(option).replace(/\D/g, ""));
                          const waist = Number.isFinite(inches) && inches > 0 ? Math.round(inches * 2.54) : null;
                          const stock = product.variants
                            .filter((variant) => variant.size === option)
                            .reduce((sum, variant) => sum + variant.stock, 0);
                          return (
                            <TableRow key={option}>
                              <TableCell className="font-bold tnum">{toFaDigits(option)}</TableCell>
                              <TableCell className="tnum">
                                {waist != null ? `${toFaDigits(waist)}` : "—"}
                                {waist != null && <span className="ms-1 text-xs text-muted-foreground">سانتی‌متر</span>}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {stock > 0 ? "بسته به مدل" : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}

                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-success" />
                      دور کمر را روی لباس راحت (نه روی بدن) اندازه بگیرید.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-success" />
                      شلوار بگ و اسکینی معمولاً کش دارند و یک سایز بالا هم تن می‌خورند.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-1 size-4 shrink-0 text-success" />
                      اگر سایز شما ناموجود بود، از پشتیبانی بخواهید هنگام موجود شدن خبرتان کنیم.
                    </li>
                  </ul>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="specs">
              <AccordionTrigger>مشخصات</AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-2 text-sm">
                  {[
                    ["نوع شلوار", product.pantType],
                    ["جنس پارچه", product.fabric],
                    ["مخاطب", product.gender],
                    ["برند", product.brand],
                    ["کد کالا", product.sku],
                  ]
                    .filter(([, value]) => Boolean(value))
                    .map(([label, value]) => (
                      <div key={label} className="flex justify-between border-b pb-2 last:border-0">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-medium" dir="auto">
                          {value}
                        </dd>
                      </div>
                    ))}
                </dl>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="shipping">
              <AccordionTrigger>ارسال و بازگشت</AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" />
                    ارسال به سراسر ایران با پست پیشتاز و تیپاکس.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" />
                    امکان بازگشت کالا تا ۷ روز پس از تحویل، در صورت استفاده‌نشدن و سالم بودن بسته‌بندی.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-success" />
                    هزینه ارسال برای سفارش‌های بالای ۲ میلیون تومان رایگان است.
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      {/* ---------- related ---------- */}
      {related.data && related.data.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-extrabold">محصولات مشابه</h2>
          <ProductGrid products={related.data} skeletonCount={4} />
        </section>
      )}
    </div>
  );
}
