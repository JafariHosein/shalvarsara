import { Heart } from "lucide-react";

import { EmptyState, EmptyStateLink } from "@/components/common/empty-state";
import { ProductCard, ProductCardSkeleton } from "@/components/product/product-card";
import { useWishlist } from "@/hooks/use-wishlist";
import { formatNumber } from "@/lib/format";

/**
 * «علاقه‌مندی‌ها» tab: the products the customer saved, drawn with the very
 * same tile the catalogue uses. The heart on each tile removes the product
 * from the list, so there is no second “remove” button to learn.
 */
export function WishlistTab() {
  const { data, isLoading } = useWishlist();
  const entries = data?.items ?? [];

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        title="فهرست علاقه‌مندی‌ها خالی است."
        description="هر محصولی را که می‌خواهید بعداً ببینید، با زدن قلب روی کارت آن ذخیره کنید."
      >
        <EmptyStateLink to="/products">مشاهدهٔ محصولات</EmptyStateLink>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Heart className="size-4 shrink-0 fill-rose-500 text-rose-500" />
        {formatNumber(entries.length)} محصول ذخیره شده است؛ با زدن قلب روی هر کارت، از این فهرست حذف
        می‌شود.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry) => (
          <ProductCard key={entry.product.id} product={entry.product} />
        ))}
      </div>
    </div>
  );
}
