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
} from "lucide-react";

import { Logo } from "@/components/common/logo";
import { Separator } from "@/components/ui/separator";
import { useCategories } from "@/hooks/use-categories";
import { CONTACT, CONTACT_FA, CONTACT_LINKS } from "@/lib/contact";
import { formatNumber } from "@/lib/format";

const TRUST_ITEMS = [
  { icon: Truck, title: "ارسال سریع", description: "تهران و کرج: تحویل یک‌روزه" },
  { icon: Undo2, title: "۷ روز مهلت بازگشت", description: "در صورت عدم رضایت" },
  { icon: ShieldCheck, title: "ضمانت اصالت کالا", description: "مستقیم از تولیدکننده" },
  { icon: Smartphone, title: "پشتیبانی پاسخگو", description: "تلگرام و تلفن، ۹ تا ۱۸" },
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
  { icon: Send, label: "تلگرام", value: CONTACT_FA.telegramId, href: CONTACT_LINKS.telegram, external: true },
  { icon: Phone, label: "تلفن", value: CONTACT_FA.phone, href: CONTACT_LINKS.phone },
  { icon: Smartphone, label: "موبایل", value: CONTACT_FA.mobile, href: CONTACT_LINKS.mobile },
  { icon: Mail, label: "ایمیل", value: CONTACT.email, href: CONTACT_LINKS.email, ltr: true },
];

export function Footer() {
  const { data: categories } = useCategories();
  const year = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date());

  return (
    <footer className="mt-20 border-t bg-muted/30">
      <div className="container py-12">
        {/* ---------- trust row ---------- */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="surface surface-hover flex items-start gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                {/* 2px stroke to match the semibold label it sits beside. */}
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs leading-6 text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        {/* ---------- link columns ---------- */}
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-sm text-sm leading-7 text-muted-foreground">
              شلوارسرا فروشگاه تخصصی شلوار است؛ تنها شلوار می‌فروشیم و همین تخصص باعث می‌شود
              انتخاب سایز، جنس و مدل ساده‌تر و مطمئن‌تر باشد.
            </p>
            <div className="flex items-center gap-2">
              <a
                href={CONTACT_LINKS.instagram}
                target="_blank"
                rel="noreferrer"
                className="grid size-10 place-items-center rounded-lg bg-card text-muted-foreground shadow-[var(--shadow-border)] transition-[color,box-shadow] duration-150 hover:text-foreground hover:shadow-[var(--shadow-border-hover)]"
                aria-label="اینستاگرام شلوارسرا"
              >
                <Instagram className="size-4" />
              </a>
              <a
                href={CONTACT_LINKS.telegram}
                target="_blank"
                rel="noreferrer"
                className="grid size-10 place-items-center rounded-lg bg-card text-muted-foreground shadow-[var(--shadow-border)] transition-[color,box-shadow] duration-150 hover:text-foreground hover:shadow-[var(--shadow-border-hover)]"
                aria-label="تلگرام شلوارسرا"
              >
                <Send className="size-4" />
              </a>
              <a
                href={CONTACT_LINKS.email}
                className="grid size-10 place-items-center rounded-lg bg-card text-muted-foreground shadow-[var(--shadow-border)] transition-[color,box-shadow] duration-150 hover:text-foreground hover:shadow-[var(--shadow-border-hover)]"
                aria-label="رایانامهٔ شلوارسرا"
              >
                <Mail className="size-4" />
              </a>
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
                    <span className="text-xs tnum">
                      ({formatNumber(category.productCount)})
                    </span>
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
            <h3 className="text-sm font-semibold">راهنمای خرید و تماس</h3>
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
              {CONTACT_ROWS.map(({ icon: Icon, label, value, href, external, ltr }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
                    className="group flex items-center gap-2 text-muted-foreground transition-colors duration-150 hover:text-primary"
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.75} />
                    <span className="shrink-0 text-xs">{label}:</span>
                    <span dir={ltr ? "ltr" : undefined} className="truncate font-medium tnum">
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

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <p className="tnum">© {year} شلوارسرا — تمام حقوق محفوظ است.</p>

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
