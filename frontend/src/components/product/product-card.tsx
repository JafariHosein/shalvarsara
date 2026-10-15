import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DiscountChip, Price } from "@/components/product/price";
import { RatingStars } from "@/components/product/rating-stars";
import { SmartImage } from "@/components/common/smart-image";
import { WishlistButton } from "@/components/product/wishlist-button";
import { toFaDigits } from "@/lib/format";
import { discountPercent, primaryImage, variantSizes, type Product } from "@/types/api";
import { cn } from "@/lib/utils";

interface ProductCardProps {
  product: Product;
  className?: string;
  /** "compact" trims the meta line for dense grids. */
  variant?: "default" | "compact";
}

/** Catalogue tile: image, badges, title, rating, price and available sizes. */
export function ProductCard({ product, className, variant = "default" }: ProductCardProps) {
  const percent = discountPercent(product);
  const image = primaryImage(product);
  const sizes = variantSizes(product).slice(0, 4);
  const outOfStock = product.stock <= 0;
  const isCompact = variant === "compact";

  return (
    <article
      className={cn(
        // Depth comes from a shadow rather than a border, so the tile sits on
        // any background; the hover ring is one step stronger, not a new colour.
        "group surface surface-hover relative flex flex-col overflow-hidden focus-within:shadow-[var(--shadow-border-hover)]",
        className,
      )}
    >
      <Link to={`/products/${product.slug}`} className="relative block aspect-[4/5] overflow-hidden">
        <SmartImage
          src={image}
          alt={product.title}
          wrapperClassName="size-full"
          className="transition-transform duration-500 group-hover:scale-105"
        />

        {percent > 0 && <DiscountChip percent={percent} className="absolute start-3 top-3" />}

        {outOfStock && (
          <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-[1px]">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <ImageOff className="size-3.5" />
              ناموجود
            </span>
          </div>
        )}
      </Link>

      <WishlistButton productId={product.id} className="absolute end-3 top-3 z-10" />

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{product.brand || product.fabric}</span>
          {product.isFeatured && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              ویژه
            </Badge>
          )}
        </div>

        <Link
          to={`/products/${product.slug}`}
          className="line-clamp-2 min-h-[2.75rem] text-sm font-semibold leading-6 hover:text-primary"
        >
          {toFaDigits(product.title)}
        </Link>

        {!isCompact && <RatingStars value={product.ratingAvg} count={product.ratingCount} />}

        {sizes.length > 0 && !isCompact && (
          <div className="flex flex-wrap gap-1">
            {sizes.map((size) => (
              <span
                key={size}
                className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[11px] text-muted-foreground"
              >
                {toFaDigits(size)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-1">
          <Price price={product.price} discountPrice={product.discountPrice} size="md" />
        </div>
      </div>
    </article>
  );
}

/** Skeleton shown while a page of products loads. */
export function ProductCardSkeleton() {
  return (
    <div className="surface overflow-hidden">
      <div className="aspect-[4/5] animate-pulse bg-muted" />
      <div className="space-y-2 p-3.5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
