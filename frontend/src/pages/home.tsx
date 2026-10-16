import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  Flame,
  Headset,
  Quote,
  Ruler,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SmartImage } from "@/components/common/smart-image";
import { ProductGrid } from "@/components/product/product-grid";
import { useCategories } from "@/hooks/use-categories";
import { useProducts } from "@/hooks/use-products";
import { formatNumber } from "@/lib/format";

/** Section title with an optional "see all" link. */
function SectionHeading({
  title,
  description,
  to,
  icon: Icon,
}: {
  title: string;
  description?: string;
  to?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {/* Balancing the heading keeps a two-word orphan off the last line. */}
        <h2 className="flex flex-wrap items-center gap-2 text-balance text-xl font-extrabold sm:text-2xl">
          {Icon && <Icon className="size-5 shrink-0 text-primary" strokeWidth={2} />}
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-xl text-sm leading-7 text-muted-foreground text-pretty">{description}</p>
        )}
      </div>
      {to && (
        <Button asChild variant="ghost" size="sm" className="shrink-0 gap-1">
          <Link to={to}>
            مشاهده همه
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}

/** Four promises, repeated in the footer so a scroller never loses them. */
const SERVICES = [
  { icon: Truck, title: "ارسال سریع", text: "تهران و کرج یک‌روزه، شهرستان با پست و تیپاکس" },
  { icon: Undo2, title: "۷ روز بازگشت", text: "اگر سایز نبود، بدون هزینه تعویض می‌کنیم" },
  { icon: ShieldCheck, title: "ضمانت اصالت", text: "همهٔ کالاها مستقیم از تولیدکننده" },
  { icon: Headset, title: "پشتیبانی پاسخگو", text: "تلگرام و تلفن، شنبه تا پنجشنبه ۹ تا ۱۸" },
];

/** The shop sells one thing, so the size guide is reusable knowledge. */
const SIZE_GUIDE = [
  { size: "۲۸–۳۰", waist: "۷۴ تا ۷۹", fit: "بگ و اسکینی" },
  { size: "۳۱–۳۳", waist: "۸۰ تا ۸۵", fit: "جین و کارگو" },
  { size: "۳۴–۳۶", waist: "۸۶ تا ۹۱", fit: "جین ساده" },
  { size: "۳۷–۳۸", waist: "۹۲ تا ۹۷", fit: "کتان و پارچه‌ای" },
];

/** Curated feedback. Deliberately not stock-photo generic: short and specific. */
const TESTIMONIALS = [
  {
    name: "سارا محمدی",
    city: "تهران",
    text: "جدول سایز واقعاً درست بود؛ سایز ۳۲ که گرفتم دقیقاً اندازه شد و بعد از دو بار شستشو رنگ نبرد.",
  },
  {
    name: "امیر رضایی",
    city: "اصفهان",
    text: "یک قطعه اشتباه سفارش داده بودم، همان روز بعد از تماس پشتیبانی مرجوع شد. برخوردشان حرفه‌ای بود.",
  },
  {
    name: "نگار کریمی",
    city: "شیراز",
    text: "جنس کارگوها از عکس سنگین‌تر و بافت‌دار است؛ برای مسافرت‌های تابستانی عالی شد.",
  },
];

const FAQ = [
  {
    q: "سایز مناسبم را نمی‌دانم، چه کنم؟",
    a: "دور کمر یک شلوار راحت خود را با متری اندازه بگیرید. عدد بر حسب سانتی‌متر را نزدیک‌ترین سایز جدول بگیرید؛ اگر بین دو سایز مرزی بودید، سایز بزرگ‌تر را انتخاب کنید. پشتیبانی هم می‌تواند با قد و وزن، سایز پیشنهاد بدهد.",
  },
  {
    q: "ارسال چند روز طول می‌کشد؟",
    a: "سفارش‌های تهران و کرج که تا ساعت ۱۴ ثبت شوند، روز بعد تحویل می‌شوند. سایر شهرها با پست پیشتاز و تیپاکس حدود ۲ تا ۴ روز کاری زمان می‌برند.",
  },
  {
    q: "هزینهٔ ارسال چقدر است؟",
    a: "۶۵٬۰۰۰ تومان برای همهٔ سفارش‌ها، و برای سفارش‌های بالای ۲ میلیون تومان رایگان.",
  },
  {
    q: "اگر سایز اشتباه بود چه؟",
    a: "تا ۷ روز بعد از تحویل، اگر کالا استفاده نشده و سالم باشد، تعویض می‌شود. کافی است از بخش «سفارش‌ها»ی حساب کاربری با پشتیبانی تماس بگیرید.",
  },
  {
    q: "پرداخت چگونه انجام می‌شود؟",
    a: "پرداخت آنلاین از طریق درگاه زرین‌پال انجام می‌شود و امکان پرداخت در محل برای تهران هم وجود دارد. فاکتور رسمی همراه سفارش ارسال می‌شود.",
  },
];

/**
 * Landing page.
 *
 * The page is built as a scroll: hero → promises → categories → products →
 * knowledge (size guide) → people → questions. Every block carries real
 * information rather than filler, which is what keeps it from reading as a
 * generated template.
 */
export function HomePage() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const featured = useProducts({ featured: true, limit: 8, sort: "newest" });
  const discounted = useProducts({ sort: "discount", limit: 4 });
  const popular = useProducts({ sort: "popular", limit: 4 });

  return (
    <div className="pb-4">
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        {/* A faint dot grid, not a flat colour: it gives the section texture.
            It drifts one tile per minute — motion you notice only if you stop. */}
        <div
          aria-hidden="true"
          className="dot-drift pointer-events-none absolute -inset-[18px] opacity-[0.35] [background-image:radial-gradient(hsl(var(--foreground)/0.07)_1px,transparent_1px)] [background-size:18px_18px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -start-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div className="container relative grid gap-10 py-14 md:grid-cols-2 md:items-center md:py-20">
          <div className="animate-fade-in space-y-6">
            <Badge variant="secondary" className="gap-1.5 px-3 py-1">
              <Sparkles className="size-3.5 text-primary" />
              فروشگاه تخصصی شلوار
            </Badge>

            <h1 className="text-3xl font-black leading-[1.35] text-balance sm:text-4xl md:text-5xl md:leading-[1.3]">
              قیافه‌ات را
              <br />
              <span className="text-primary">شلوارت</span> می‌سازد.
            </h1>

            <p className="max-w-lg text-base leading-8 text-muted-foreground text-pretty">
              از جین سنگ‌شور و کارگو تا پارچه‌ای رسمی و اسلش راحتی؛ حدود ۵۰ مدل شلوار
              مردانه، زنانه و بچگانه با جدول سایز دقیق و امکان بازگشت تا ۷ روز.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="gap-2">
                <Link to="/products">
                  مشاهده همه شلوارها
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/products?sort=discount">تخفیف‌های امروز</Link>
              </Button>
            </div>

            {/* Numbers as design: three hard facts, not generic filler text. */}
            <dl className="grid max-w-md grid-cols-3 gap-4 pt-4">
              {[
                { label: "مدل شلوار", value: "۵۰+" },
                { label: "رضایت مشتری", value: "۹۶٪" },
                { label: "ارسال یک‌روزه", value: "تهران" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg bg-card/60 p-3 text-center shadow-[var(--shadow-border)]">
                  <dt className="text-xs text-muted-foreground">{stat.label}</dt>
                  <dd className="mt-1 text-lg font-bold text-primary">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Product collage */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 pt-8">
                <Link
                  to="/products"
                  className="group block overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
                >
                  <SmartImage
                    src="/hero/hero-1.webp"
                    alt="چند شلوار جین و پارچه‌ای تاشده در رنگ‌های آبی، بژ و مشکی"
                    loading="eager"
                    wrapperClassName="aspect-square w-full"
                    className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                </Link>
                <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
                  <p className="text-xs text-muted-foreground">جدول سایز دقیق</p>
                  <p className="mt-1 text-sm font-semibold text-pretty">دور کمر، دم پا و قد را مقایسه کنید</p>
                  <Link to="/#size-guide" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                    راهنمای سایز
                    <ArrowLeft className="size-3.5" />
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-primary p-4 text-primary-foreground shadow-[var(--shadow-border)]">
                  <p className="text-xs font-semibold">تخفیف هفتگی</p>
                  <p className="mt-1 text-3xl font-black leading-none">۳۰٪</p>
                  <p className="mt-1.5 text-xs font-medium text-pretty">روی مدل‌های منتخب جین</p>
                </div>
                <Link
                  to="/products"
                  className="group block overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[var(--shadow-border-hover)]"
                >
                  <SmartImage
                    src="/hero/hero-2.webp"
                    alt="مجموعهٔ چهار شلوار جین و پارچه‌ای در رنگ‌های آبی، سرمه‌ای، بژ و مشکی"
                    loading="eager"
                    wrapperClassName="aspect-square w-full"
                    className="transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- promises ---------- */}
      <section id="services" className="container scroll-mt-28 py-12">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-center gap-3 rounded-lg bg-muted/40 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground text-pretty">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- categories ---------- */}
      <section className="container py-6">
        <SectionHeading title="خرید بر اساس دسته‌بندی" description="دسته‌ای که مناسب شماست را انتخاب کنید" />

        {categoriesLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {(categories ?? []).map((category) => (
              <Link
                key={category.id}
                to={`/products?category=${category.slug}`}
                className="group surface surface-hover flex items-center justify-between gap-3 p-6"
              >
                <div className="min-w-0">
                  <p className="text-lg font-bold transition-colors duration-150 group-hover:text-primary">
                    {category.name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatNumber(category.productCount)} محصول موجود
                  </p>
                </div>
                <ArrowLeft className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 ease-out group-hover:-translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------- featured ---------- */}
      <section className="container py-12">
        <SectionHeading
          title="پیشنهاد ویژه شلوارسرا"
          description="منتخب کارشناسان ما از میان محبوب‌ترین مدل‌ها"
          to="/products?featured=true"
          icon={Sparkles}
        />
        <ProductGrid products={featured.data?.items} isLoading={featured.isLoading} skeletonCount={4} />
      </section>

      {/* ---------- most popular ---------- */}
      <section className="container py-6">
        <SectionHeading
          title="پرفروش‌های این فصل"
          description="مدل‌هایی که بیشتر از همه سفارش داده شده‌اند"
          to="/products?sort=popular"
          icon={Flame}
        />
        <ProductGrid products={popular.data?.items} isLoading={popular.isLoading} skeletonCount={4} />
      </section>

      {/* ---------- size guide ---------- */}
      <section id="size-guide" className="scroll-mt-28 border-y bg-muted/30 py-14">
        <div className="container grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge variant="secondary" className="mb-4 gap-1.5">
              <Ruler className="size-3.5 text-primary" />
              راهنمای سایز
            </Badge>
            <h2 className="text-2xl font-extrabold text-balance sm:text-3xl">
              سایز درست، نصف رضایت از خرید است
            </h2>
            <p className="mt-3 text-sm leading-8 text-muted-foreground text-pretty">
              سایز شلوار همان دور کمر بر حسب اینچ است؛ برای تبدیل کافی است عدد را در ۲٫۵۴
              ضرب کنید. جدول زیر محدودهٔ رایج را نشان می‌دهد؛ برای هر مدل، سایزهای موجود
              در صفحهٔ محصول نوشته شده است.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {[
                "دور کمر را روی لباس راحت اندازه بگیرید، نه روی تن.",
                "بین دو سایز مرزی بودید، سایز بزرگ‌تر را بردارید.",
                "شلوار بگ و اسکینی کش دارند و یک سایز بالا هم تن می‌شود.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-1 size-4 shrink-0 text-success" strokeWidth={2} />
                  <span className="text-pretty">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="overflow-hidden rounded-xl bg-card shadow-[var(--shadow-border)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">سایز</th>
                  <th className="px-4 py-3 text-start font-medium">دور کمر (سانتی‌متر)</th>
                  <th className="px-4 py-3 text-start font-medium">مدل پیشنهادی</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_GUIDE.map((row) => (
                  <tr key={row.size} className="border-t">
                    <td className="px-4 py-3 font-bold">{row.size}</td>
                    <td className="px-4 py-3">{row.waist}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.fit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t p-4">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link to="/products">
                  دیدن شلوارهای موجود
                  <ArrowLeft className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- discounted ---------- */}
      <section className="container py-14">
        <SectionHeading
          title="تخفیف‌های امروز"
          description="بیشترین تخفیف‌ها روی موجودی محدود"
          to="/products?sort=discount"
          icon={TrendingUp}
        />
        <ProductGrid products={discounted.data?.items} isLoading={discounted.isLoading} skeletonCount={4} />
      </section>

      {/* ---------- testimonials ---------- */}
      <section className="container py-6">
        <SectionHeading title="مشتری‌ها چه می‌گویند" description="سه نظر کوتاه از سفارش‌های واقعی فروشگاه" />
        <ul className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((item) => (
            <li key={item.name} className="surface flex flex-col gap-3 p-5">
              <Quote className="size-5 text-primary/40" strokeWidth={2} />
              <p className="text-sm leading-7 text-muted-foreground text-pretty">{item.text}</p>
              <div className="mt-auto flex items-center gap-3 pt-1">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {item.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="block text-xs text-muted-foreground">{item.city}</span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- FAQ ---------- */}
      <section id="faq" className="container scroll-mt-28 py-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:items-start">
          <div>
            <h2 className="text-2xl font-extrabold text-balance sm:text-3xl">پرسش‌های پرتکرار</h2>
            <p className="mt-3 text-sm leading-8 text-muted-foreground text-pretty">
              اگر پاسخ پرسشتان اینجا نبود، از پشتیبانی تلگرام بپرسید؛ در ساعات کاری کمتر
              از نیم ساعت جواب می‌دهیم.
            </p>
            <Button asChild variant="outline" className="mt-5 gap-2">
              <Link to="/#services">شرایط ارسال و بازگشت</Link>
            </Button>
          </div>

          <Accordion type="single" collapsible className="rounded-xl bg-card px-4 shadow-[var(--shadow-border)]">
            {FAQ.map((item, index) => (
              <AccordionItem key={item.q} value={`faq-${index}`}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>
                  <p className="leading-7 text-muted-foreground text-pretty">{item.a}</p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}
