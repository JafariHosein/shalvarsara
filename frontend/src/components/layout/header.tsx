import { Link, NavLink } from "react-router-dom";
import { Menu, ShoppingCart } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Logo } from "@/components/common/logo";
import { SearchBar } from "@/components/layout/search-bar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { useCategories } from "@/hooks/use-categories";
import { useCart } from "@/hooks/use-cart";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/products", label: "همه شلوارها" },
  { to: "/products?sort=discount", label: "تخفیف‌دار" },
  { to: "/products?sort=popular", label: "پرفروش‌ها" },
];

/** Cart button with a live item-count badge. */
function CartButton({ onNavigate }: { onNavigate?: () => void }) {
  const { count } = useCart();
  return (
    <Button asChild variant="ghost" size="icon" className="relative" aria-label="سبد خرید">
      <Link to="/cart" onClick={onNavigate}>
        <ShoppingCart className="size-5" />
        {count > 0 && (
          <Badge className="absolute -end-1 -top-1 size-5 justify-center rounded-full p-0 text-[10px]">
            {formatNumber(count)}
          </Badge>
        )}
      </Link>
    </Button>
  );
}

/** Mobile navigation drawer. Opens from the inline start — the side the
 *  hamburger sits on in RTL. */
function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const { data: categories } = useCategories();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="منو">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="start" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-start">
            <Logo />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <SearchBar onSubmitted={() => setOpen(false)} />

          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <Separator />

          <div className="space-y-1">
            <p className="px-3 pb-1 text-xs font-semibold text-muted-foreground">دسته‌بندی‌ها</p>
            {(categories ?? []).map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.slug}`}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <span>{category.name}</span>
                <span className="text-xs text-muted-foreground">{formatNumber(category.productCount)}</span>
              </Link>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Sticky site header with search, catalogue navigation and account controls. */
export function Header() {
  const { data: categories } = useCategories();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="container flex h-16 items-center gap-3">
        <MobileNav />
        <Logo className="shrink-0" />

        <SearchBar className="mx-2 hidden max-w-xl flex-1 md:block" />

        <div className="ms-auto flex items-center gap-1">
          <ThemeToggle />
          <CartButton />
          <UserMenu />
        </div>
      </div>

      <div className="hidden border-t lg:block">
        <div className="container flex h-11 items-center gap-1 text-sm">
          <NavLink
            to="/products"
            end
            className={({ isActive }) =>
              cn(
                "rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive && "text-primary",
              )
            }
          >
            همه شلوارها
          </NavLink>

          {(categories ?? []).map((category) => (
            <Link
              key={category.id}
              to={`/products?category=${category.slug}`}
              className="rounded-md px-3 py-1.5 font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {category.name}
            </Link>
          ))}

          <Link
            to="/products?sort=discount"
            className="rounded-md px-3 py-1.5 font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            تخفیف‌دار
          </Link>
        </div>
      </div>
    </header>
  );
}
