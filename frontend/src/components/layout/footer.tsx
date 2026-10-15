import { Link } from "react-router-dom";
import {
  Clock,
  Heart,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
  Smartphone,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { Logo } from "@/components/common/logo";
import { useCategories } from "@/hooks/use-categories";
import { CONTACT, CONTACT_FA, CONTACT_LINKS } from "@/lib/contact";
import { formatNumber } from "@/lib/format";

/**
 * The same four promises the home page spells out with descriptions, reduced
 * to a single line here: a footer should be a colophon, not a second landing
 * page. Full text lives in `#services` on the home page.
 */
const PROMISES = [
  { icon: Truck, label: "ارسال سریع" },
  { icon: Undo2, label: "۷ روز مهلت بازگشت" },
  { icon: ShieldCheck, label: "ضمانت اصالت کالا" },
  { icon: Smartphone, label: "پشتیبانی پاسخگو" },
];

/**
 * Telegram, Instagram and email appear once — as this icon row. Repeating them
 * as labelled rows further down only made the footer long, never clearer.
 */
const SOCIALS: { icon: LucideIcon; href: string; label: string }[] = [
  { icon: Instagram, href: CONTACT_LINKS.instagram, label: "اینستاگرام شلوارسرا" },
  { icon: Send, href: CONTACT_LINKS.telegram, label: "تلگرام شلوارسرا" },
  { icon: Mail, href: CONTACT_LINKS.email, label: "رایانامهٔ شلوارسرا" },
];

const HELP_LINKS = [
  { to: "/products", label: "همه محصولات" },
  { to: "/products?sort=discount", label: "محصولات تخفیف‌دار" },
  { to: "/account/orders", label: "پیگیری سفارش" },
  { to: "/cart", label: "سبد خرید" },
];

const GUIDE_LINKS = [
  { to: "/#size-guide", label: "راهنمای انتخاب سایز" },
  { to: "/#faq", label: "پرسش‌های پرتکرار" },
  { to: "/#services", label: "شرایط ارسال و بازگشت" },
];

const CONTACT_ROWS = [
  { icon: Phone, label: "تلفن", value: CONTACT_FA.phone, href: CONTACT_LINKS.phone },
  { icon: Smartphone, label: "موبایل", value: CONTACT_FA.mobile, href: CONTACT_LINKS.mobile },
];

export function Footer() {
  const { data: categories } = useCategories();
  const year = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date());

  return (
    <footer className="mt-16 border-t bg-muted/30">
      <div className="container py-10">
        {/* ---------- link columns ---------- */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              شلوارسرا فروشگاه تخصصی شلوار است؛ تنها شلوار می‌فروشیم و همین تخصص باعث می‌شود
              انتخاب سایز، جنس و مدل ساده‌تر و مطمئن‌تر باشد.
            </p>
            <div className="flex items-center gap-2">
              {SOCIALS.map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="grid size-10 place-items-center rounded-lg bg-card text-muted-foreground shadow-[var(--shadow-border)] transition-[color,box-shadow] duration-150 hover:text-foreground hover:shadow-[var(--shadow-border-hover)]"
                >
                  <Icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          <nav className="space-y-3" aria-label="دسته‌بندی‌ها">
            <h3 className="text-sm font-semibold">دسته‌بندی‌ها</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {(categories ?? []).map((category) => (
                <li key={category.id}>
                  <Link
                    to={`/products?category=${category.slug}`}
                    className="inline-flex items-center gap-1.5 transition-colors duration-150 hover:text-primary"
                  >
                    {category.name}
                    <span className="text-xs">({formatNumber(category.productCount)})</span>
                  </Link>
                </li>
              ))}
              {(categories ?? []).length === 0 && <li>در حال بارگذاری…</li>}
            </ul>
          </nav>

          <nav className="space-y-3" aria-label="دسترسی سریع">
            <h3 className="text-sm font-semibold">دسترسی سریع</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {HELP_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors duration-150 hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">راهنمای خرید</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {GUIDE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="transition-colors duration-150 hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>

            <ul className="space-y-2 pt-1 text-sm">
              {CONTACT_ROWS.map(({ icon: Icon, label, value, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="group flex items-center gap-2 text-muted-foreground transition-colors duration-150 hover:text-primary"
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="shrink-0 text-xs">{label}:</span>
                    <span dir="ltr" className="truncate font-medium">
                      {value}
                    </span>
                  </a>
                </li>
              ))}
              <li className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="text-xs">{CONTACT.hours}</span>
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="text-xs">تهران، پاساژ پوشاک — طبقهٔ اول</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ---------- promises ---------- */}
        <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
          {PROMISES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5">
              <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
              {label}
            </li>
          ))}
        </ul>

        {/* ---------- colophon ---------- */}
        <div className="mt-5 flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} شلوارسرا — تمام حقوق محفوظ است.</p>

          <p className="flex items-center gap-1.5">
            ساخته‌شده با
            {/* Filled heart: the active-state variant of an outline icon. */}
            <Heart className="size-3.5 fill-rose-500 text-rose-500" aria-hidden="true" />
            <span className="font-semibold text-foreground">حسین جعفری</span>
            <span className="sr-only">— ساخته‌شده با علاقه توسط حسین جعفری</span>
          </p>

          <p className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-success" strokeWidth={1.75} />
            پرداخت امن از طریق درگاه زرین‌پال
          </p>
        </div>
      </div>
    </footer>
  );
}
