# Component recipes (storefront)

Patterns this project reuses. All examples assume design tokens from
`design-tokens.md`, formatters from `src/lib/format.ts`, and RTL rules from
`rtl-guidelines.md`. Amounts are integers in **Toman**.

## Price tag (with discount + Persian digits)

```tsx
import { formatToman, toFaDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Price({
  price, discountPrice, className,
}: { price: number; discountPrice?: number | null; className?: string }) {
  const final = discountPrice ?? price;
  const hasOff = !!discountPrice && discountPrice < price;
  const percent = hasOff ? Math.round(((price - final) / price) * 100) : 0;

  return (
    <div className={cn("flex items-baseline gap-2", className)}>
      <span className="text-lg font-bold text-foreground">{formatToman(final)}</span>
      {hasOff && (
        <>
          <span className="text-sm text-muted-foreground line-through">{formatToman(price)}</span>
          <Badge variant="destructive" className="ms-1">
            {toFaDigits(percent)}٪
          </Badge>
        </>
      )}
    </div>
  );
}
```

## Product card

```tsx
export function ProductCard({ product }: { product: Product }) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-md">
      <Link to={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <img
            src={product.primaryImage} alt={product.title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none"
          />
          {product.stock === 0 && (
            <Badge variant="secondary" className="absolute top-2 end-2">ناموجود</Badge>
          )}
        </div>
        <CardContent className="space-y-2 p-3">
          <h3 className="line-clamp-2 text-sm font-medium leading-6">{product.title}</h3>
          <Price price={product.price} discountPrice={product.discountPrice} />
        </CardContent>
      </Link>
    </Card>
  );
}
```

Notes: `aspect-[3/4]` keeps a stable grid; `end-2` places the badge on the reading-start side;
the hover zoom is gated by `motion-reduce` — no entrance animation on every card.

## Size selector

```tsx
export function SizeSelector({ sizes, value, onChange }: SizeSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="انتخاب سایز">
      {sizes.map((s) => {
        const disabled = s.stock === 0;
        const active = value === s.value;
        return (
          <button
            key={s.value} type="button" role="radio" aria-checked={active}
            disabled={disabled} onClick={() => onChange(s.value)}
            className={cn(
              "min-w-11 rounded-md border px-3 py-2 text-sm transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active && "border-primary bg-primary text-primary-foreground",
              !active && "border-input hover:bg-accent",
              disabled && "cursor-not-allowed opacity-40 line-through",
            )}
          >
            {toFaDigits(s.value)}
          </button>
        );
      })}
    </div>
  );
}
```

## Color swatch

```tsx
export function ColorSwatch({ color, value, onChange }: ColorSwatchProps) {
  const active = value === color.hex;
  return (
    <button
      type="button" aria-label={color.name} aria-pressed={active}
      onClick={() => onChange(color.hex)}
      className={cn(
        "size-7 rounded-full border ring-offset-2 ring-offset-background transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "ring-2 ring-ring",
      )}
      style={{ backgroundColor: color.hex }}
    />
  );
}
```

Swatch colour is real data (a product attribute) — inline `style` here is correct, not a token violation.

## Quantity stepper

```tsx
export function QuantityStepper({ value, min = 1, max, onChange }: QtyProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <div className="inline-flex items-center rounded-md border border-input" dir="ltr">
      <Button variant="ghost" size="icon" onClick={inc} disabled={value >= max} aria-label="افزودن">
        <Plus className="size-4" />
      </Button>
      <span className="w-10 text-center text-sm font-medium tabular-nums">{toFaDigits(value)}</span>
      <Button variant="ghost" size="icon" onClick={dec} disabled={value <= min} aria-label="کاهش">
        <Minus className="size-4" />
      </Button>
    </div>
  );
}
```

`dir="ltr"` keeps `+` before `−` consistently; `aria-label`s are Persian.

## Filter sidebar (Sheet on mobile)

```tsx
export function FilterPanel(props: FilterProps) {
  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block">
        <FilterFields {...props} />
      </aside>

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="lg:hidden">
            <SlidersHorizontal className="me-2 size-4" /> فیلترها
          </Button>
        </SheetTrigger>
        <SheetContent side="end" className="w-80 overflow-y-auto">
          <SheetHeader><SheetTitle>فیلترها</SheetTitle></SheetHeader>
          <div className="mt-4"><FilterFields {...props} /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

## Cart drawer

```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button variant="ghost" size="icon" className="relative" aria-label="سبد خرید">
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute -top-1 -end-1 grid size-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">
          {toFaDigits(count)}
        </span>
      )}
    </Button>
  </SheetTrigger>
  <SheetContent side="end" className="flex w-full flex-col sm:max-w-md">
    <SheetHeader><SheetTitle>سبد خرید</SheetTitle></SheetHeader>
    {/* items */}
    <div className="mt-auto space-y-3 border-t pt-4">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">جمع کل</span>
        <span className="font-bold">{formatToman(total)}</span>
      </div>
      <Button className="w-full" asChild><Link to="/checkout">تکمیل خرید</Link></Button>
    </div>
  </SheetContent>
</Sheet>
```

## Order status badge

```tsx
const STATUS: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending:    { label: "در انتظار پرداخت", variant: "secondary" },
  paid:       { label: "پرداخت‌شده",       variant: "success" },
  processing: { label: "در حال پردازش",   variant: "warning" },
  shipped:    { label: "ارسال‌شده",        variant: "default" },
  delivered:  { label: "تحویل‌شده",        variant: "success" },
  canceled:   { label: "لغوشده",          variant: "destructive" },
};

export const OrderStatusBadge = ({ status }: { status: OrderStatus }) => (
  <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
);
```

Add `success` / `warning` variants to `badge.tsx` via `cva` (do not fork the file).

## Empty / loading / error states

Every list needs all three. Use `Skeleton` grids for loading, an illustrated `EmptyState`
with a single clear action for empty, and an inline `Alert` with a retry `Button` for errors.

```tsx
export function ProductGridState({ state, onRetry, children }: GridStateProps) {
  if (state === "loading") return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
  if (state === "error") return (
    <Alert variant="destructive" className="max-w-md">
      <AlertTitle>بارگذاری محصولات ناموفق بود</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>اتصال خود را بررسی کنید و دوباره تلاش کنید.</span>
        <Button variant="outline" size="sm" onClick={onRetry}>تلاش دوباره</Button>
      </AlertDescription>
    </Alert>
  );
  if (state === "empty") return (
    <EmptyState
      title="محصولی پیدا نشد"
      description="فیلترها را تغییر دهید یا عبارت دیگری جستجو کنید."
    />
  );
  return <>{children}</>;
}
```

## Admin data table

Use the shadcn **Table** primitives with TanStack Table. Keep the toolbar and column
headers Persian (`text-start`), numbers `tabular-nums`, and row actions in a
`DropdownMenu` aligned to `end`.

```tsx
<TableHead className="text-start">عنوان</TableHead>
<TableHead className="text-start">موجودی</TableHead>
<TableCell className="tabular-nums">{toFaDigits(row.stock)}</TableCell>
<TableCell className="text-end">
  <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
    <DropdownMenuContent align="end">…</DropdownMenuContent>
  </DropdownMenu>
</TableCell>
```

## Form field wrapper

```tsx
<FormField control={form.control} name="phone" render={({ field }) => (
  <FormItem>
    <FormLabel>شماره تماس</FormLabel>
    <FormControl>
      <Input dir="ltr" inputMode="tel" placeholder="۰۹۱۲۳۴۵۶۷۸۹"
             {...field} onChange={(e) => field.onChange(toEnDigits(e.target.value))} />
    </FormControl>
    <FormMessage />
  </FormItem>
)} />
```

Error text lives in `FormMessage` and comes from a Persian zod error map — never show the raw
English zod message.
