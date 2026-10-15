import { useLocation, useNavigate } from "react-router-dom";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useToggleWishlist, useWishlistIds } from "@/hooks/use-wishlist";
import { useIsAuthenticated } from "@/store/auth-store";
import { cn } from "@/lib/utils";

interface WishlistButtonProps {
  productId: number;
  /** "icon" is the heart on a catalogue tile; "pill" is the product-page button. */
  variant?: "icon" | "pill";
  className?: string;
}

/**
 * Saves a product for later, or removes it again.
 *
 * Guests cannot have a wishlist, so the first click sends them to the sign-in
 * screen with the current page remembered as the return address.
 */
export function WishlistButton({ productId, variant = "icon", className }: WishlistButtonProps) {
  const isAuthenticated = useIsAuthenticated();
  const saved = useWishlistIds().has(productId);
  const { toggle, pendingProductId } = useToggleWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const pending = pendingProductId === productId;
  const label = saved ? "حذف از علاقه‌مندی‌ها" : "افزودن به علاقه‌مندی‌ها";

  function onClick() {
    if (!isAuthenticated) {
      toast.info("برای ذخیرهٔ محصول، ابتدا وارد حساب کاربری شوید.");
      navigate("/login", { state: { from: location.pathname + location.search } });
      return;
    }
    toggle(productId);
  }

  if (variant === "pill") {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={label}
        className={cn("gap-2", saved && "border-rose-500/40", className)}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Heart className={cn("size-4", saved && "fill-rose-500 text-rose-500")} />
        )}
        {saved ? "در علاقه‌مندی‌ها" : "علاقه‌مندی"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-8 place-items-center rounded-full border border-border/60 bg-background/85 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors",
        "hover:border-rose-500/40 hover:text-rose-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        saved && "border-rose-500/40 text-rose-500",
        className,
      )}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Heart className={cn("size-4 transition-transform", saved && "scale-110 fill-rose-500")} />
      )}
    </button>
  );
}
