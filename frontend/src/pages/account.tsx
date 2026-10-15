import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Loader2,
  Heart,
  Lock,
  MapPin,
  Receipt,
  Save,
  UserCog,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AddressesTab } from "@/components/account/addresses-tab";
import { OrdersTab } from "@/components/account/orders-tab";
import { WishlistTab } from "@/components/account/wishlist-tab";
import { authService } from "@/services/auth";
import { errorMessage } from "@/lib/api";
import { profileSchema, type ProfileValues } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

/** Profile tab: edit name and phone. */
function ProfileTab() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: {
      name: user?.name ?? "",
      phone: user?.phone ?? "",
    },
  });

  async function onSubmit(values: ProfileValues) {
    try {
      const updated = await authService.updateProfile({
        name: values.name,
        phone: values.phone || undefined,
      });
      setUser(updated);
      toast.success("اطلاعات حساب ذخیره شد.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const submitting = form.formState.isSubmitting;
  const dirty = form.formState.isDirty;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>اطلاعات کاربری</CardTitle>
        <CardDescription>
          نام و شماره تماس شما برای ارسال سفارش و اطلاع‌رسانی استفاده می‌شود.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>نام و نام خانوادگی</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>شماره موبایل</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        dir="ltr"
                        inputMode="tel"
                        autoComplete="tel"
                        className="text-start"
                        placeholder="09123456789"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-2">
              <FormLabel htmlFor="account-email" className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" />
                ایمیل
              </FormLabel>
              <Input
                id="account-email"
                value={user?.email ?? ""}
                dir="ltr"
                readOnly
                disabled
                className="text-start"
              />
              <p className="text-xs text-muted-foreground">
                ایمیل حساب قابل تغییر نیست. برای تغییر، با پشتیبانی تماس بگیرید.
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-end gap-3">
              <span className="text-xs text-muted-foreground">
                {dirty ? "تغییرات ذخیره نشده دارید." : "همه‌چیز ذخیره شده است."}
              </span>
              <Button type="submit" className="gap-2" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                ذخیره تغییرات
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

interface NavEntry {
  value: "profile" | "addresses" | "orders" | "wishlist";
  path: string;
  label: string;
  icon: LucideIcon;
}

const TABS: NavEntry[] = [
  { value: "profile", path: "/account", label: "اطلاعات کاربری", icon: UserRound },
  { value: "addresses", path: "/account/addresses", label: "آدرس‌ها", icon: MapPin },
  { value: "orders", path: "/account/orders", label: "سفارش‌ها", icon: Receipt },
  { value: "wishlist", path: "/account/wishlist", label: "علاقه‌مندی‌ها", icon: Heart },
];

type AccountTab = NavEntry["value"];

/** First letter of the name, for the little avatar. */
function initial(name?: string): string {
  const trimmed = (name ?? "").trim();
  return trimmed ? trimmed.charAt(0) : "؟";
}

/** Account dashboard: a vertical menu on the start edge and the active section. */
export function AccountPage() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  // The section lives in the URL so «پیگیری سفارش» in the footer and the user
  // menu can deep-link straight to the orders list, and the back button works.
  const last = location.pathname.replace(/\/+$/, "").split("/").pop();
  const tab: AccountTab = (TABS.map((entry) => entry.value) as string[]).includes(last ?? "")
    ? (last as AccountTab)
    : "profile";

  // An unknown section under /account falls back to the profile and the URL is
  // tidied up, so the highlighted menu item and the shown panel always agree.
  const known = location.pathname === "/account" || tab !== "profile";
  React.useEffect(() => {
    if (!known) navigate("/account", { replace: true });
  }, [known, navigate]);

  return (
    <div className="container py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-5">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold">
            <UserCog className="size-6 shrink-0 text-primary" />
            حساب کاربری
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user?.name ? `${user.name} عزیز، خوش آمدید.` : "به حساب کاربری خود خوش آمدید."}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="rounded-xl border bg-card p-3">
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <span
                aria-hidden="true"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-bold text-primary"
              >
                {initial(user?.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name ?? "کاربر مهمان"}</p>
                <p className="truncate text-xs text-muted-foreground" dir="ltr">
                  {user?.email ?? "—"}
                </p>
              </div>
            </div>

            <nav aria-label="بخش‌های حساب کاربری" className="mt-3 flex flex-col gap-1">
              {TABS.map(({ value, path, label, icon: Icon }) => (
                <NavLink
                  key={value}
                  to={path}
                  end={path === "/account"}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )
                  }
                >
                  <Icon className="size-4 shrink-0" />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          {tab === "profile" ? <ProfileTab /> : null}
          {tab === "addresses" ? <AddressesTab /> : null}
          {tab === "orders" ? <OrdersTab /> : null}
          {tab === "wishlist" ? <WishlistTab /> : null}
        </main>
      </div>
    </div>
  );
}
