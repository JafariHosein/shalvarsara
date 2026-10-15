import { Link } from "react-router-dom";
import { Instagram, Phone, Send, ShieldCheck, Truck, Undo2 } from "lucide-react";

import { Logo } from "@/components/common/logo";
import { Separator } from "@/components/ui/separator";
import { useCategories } from "@/hooks/use-categories";

const TRUST_ITEMS = [
  { icon: Truck, title: "ارسال سریع", description: "تهران و کرج: تحویل یک‌روزه" },
  { icon: Undo2, title: "۷ روز مهلت بازگشت", description: "در صورت عدم رضایت" },
  { icon: ShieldCheck, title: "پرداخت امن", description: "از طریق درگاه زرین‌پال" },
];

const HELP_LINKS = [
  { to: "/products", label: "همه محصولات" },
  { to: "/products?sort=discount", label: "محصولات تخفیف‌دار" },
  { to: "/account/orders", label: "پیگیری سفارش" },
  { to: "/cart", label: "سبد خرید" },
];

export function Footer() {
  const { data: categories } = useCategories();
  const year = new Intl.DateTimeFormat("fa-IR", { year: "numeric" }).format(new Date());

  return (
    <footer className="mt-16 border-t bg-muted/30">
      <div className="container py-10">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_ITEMS.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3 rounded-lg border bg-card p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator className="my-10" />

        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <Logo />
            <p className="max-w-md text-sm leading-7 text-muted-foreground">
              شلوارسرا فروشگاه تخصصی شلوار است؛ تنها شلوار می‌فروشیم و همین تخصص باعث می‌شود
              انتخاب سایز، جنس و مدل ساده‌تر و مطمئن‌تر باشد.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href="tel:+982100000000"
                className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Phone className="size-4" />
                ۰۲۱-۰۰۰۰۰۰۰۰
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="grid size-9 place-items-center rounded-md border bg-card hover:bg-accent"
                aria-label="اینستاگرام"
              >
                <Instagram className="size-4" />
              </a>
              <a
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                className="grid size-9 place-items-center rounded-md border bg-card hover:bg-accent"
                aria-label="تلگرام"
              >
                <Send className="size-4" />
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">دسته‌بندی‌ها</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {(categories ?? []).map((category) => (
                <li key={category.id}>
                  <Link to={`/products?category=${category.slug}`} className="hover:text-primary">
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">دسترسی سریع</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {HELP_LINKS.map((link) => (
                <li key={link.to}>
                  <Link to={link.to} className="hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <p>© {year} شلوارسرا — تمام حقوق محفوظ است.</p>
          <p>پرداخت امن از طریق درگاه زرین‌پال</p>
        </div>
      </div>
    </footer>
  );
}
