import { ProductCard, ProductCardSkeleton } from "@/components/product/product-card";
import type { Product } from "@/types/api";
import { cn } from "@/lib/utils";

interface ProductGridProps {
  products: Product[] | undefined;
  isLoading?: boolean;
  skeletonCount?: number;
  className?: string;
}

/** Responsive product grid with a matching loading state. */
export function ProductGrid({ products, isLoading, skeletonCount = 8, className }: ProductGridProps) {
  const gridClass = cn(
    "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4",
    className,
  );

  if (isLoading || !products) {
    return (
      <div className={gridClass}>
        {Array.from({ length: skeletonCount }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
