import { Link, NavLink, Outlet } from "react-router-dom";
import {
  Boxes,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  MessageSquareText,
  Receipt,
  ShieldCheck,
  Star,
  Store,
  TicketPercent,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

interface NavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Only the index route needs an exact match. */
  end?: boolean;
  /** Marks a section that is planned but not built yet. */
  soon?: boolean;
}

const NAV: NavEntry[] = [
  { to: "/admin", label: "داشبورد", icon: LayoutDashboard, end: true },
  { to: "/admin/products", label: "محصولات", icon: Boxes },
  { to: "/admin/categories", label: "دسته‌بندی‌ها", icon: FolderTree },
  { to: "/admin/orders", label: "سفارش‌ها", icon: Receipt },
  { to: "/admin/payments", label: "تراکنش‌ها", icon: CreditCard },
  { to: "/admin/users", label: "کاربران", icon: Users },
  { to: "/admin/reviews", label: "نظرات", icon: Star },
  { to: "/admin/coupons", label: "کدهای تخفیف", icon: TicketPercent },
  { to: "/admin/sms", label: "پنل پیامکی", icon: MessageSquareText, soon: true },
];

/**
 * Shell of the management panel: a header, the navigation and the routed screen.
 * The navigation is a vertical menu that sits on the start edge (the right side
 * in RTL) from `lg` up, and stacks above the content on smaller screens.
 */
export function AdminLayout() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="container py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <ShieldCheck className="size-6 shrink-0 text-primary" />
            پنل مدیریت
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.name ? `${user.name} عزیز، خوش آمدید.` : "به پنل مدیریت خوش آمدید."}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/">
            <Store className="size-4" />
            مشاهده فروشگاه
          </Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          {/* Two tidy columns on a phone keep the menu short; a single column
              from `sm` up matches the module's vertical nature. */}
          <nav
            aria-label="بخش‌های پنل مدیریت"
            className="grid grid-cols-2 gap-1.5 rounded-xl border bg-card p-2 sm:grid-cols-3 lg:grid-cols-1"
          >
            {NAV.map(({ to, label, icon: Icon, end, soon }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {/* `min-w-0` + `truncate` keep a long label from shoving the
                    «به‌زودی» tag out of the row. */}
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {soon && (
                  <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px] font-medium">
                    به‌زودی
                  </Badge>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
