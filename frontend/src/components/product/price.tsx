import { formatNumber, formatToman, toFaDigits } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PriceProps {
  /** Original price in Toman. */
  price: number;
  /** Discounted price in Toman, if any. */
  discountPrice?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { final: "text-sm", original: "text-[11px]" },
  md: { final: "text-base", original: "text-xs" },
  lg: { final: "text-2xl", original: "text-sm" },
} as const;

/**
 * Persian price display: the original price is struck through when discounted,
 * and the payable amount is the visually dominant element.
 */
export function Price({ price, discountPrice, size = "md", className }: PriceProps) {
  const hasDiscount =
    discountPrice != null && discountPrice > 0 && discountPrice < price;
  const final = hasDiscount ? discountPrice : price;
  const sizes = SIZES[size];

  return (
    <div className={cn("flex flex-wrap items-baseline gap-2", className)}>
      {hasDiscount && (
        <span
          className={cn("text-muted-foreground line-through", sizes.original)}
          // Screen readers should not announce the old price as the current one.
          aria-hidden="true"
        >
          {formatToman(price)}
        </span>
      )}
      <span className={cn("font-bold text-foreground", sizes.final)}>
        {formatToman(final)}
      </span>
      {hasDiscount && (
        <span className="sr-only">{`قیمت پیش از تخفیف ${formatNumber(price)} تومان`}</span>
      )}
    </div>
  );
}

/** Compact "٪۳۰" style discount chip. */
export function DiscountChip({ percent, className }: { percent: number; className?: string }) {
  if (percent <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground",
        className,
      )}
    >
      {toFaDigits(percent)}٪
    </span>
  );
}
