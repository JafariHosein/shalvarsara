import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-extrabold sm:text-2xl">
          {Icon && <Icon className="size-5 text-primary" />}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
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

/**
 * Landing page. The hero is deliberately asymmetric: a bold Persian headline
 * paired with a live product collage, rather than a centred banner.
 */
export function HomePage() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const featured = useProducts({ featured: true, limit: 8, sort: "newest" });
  const discounted = useProducts({ sort: "discount", limit: 4 });

  const heroProduct = featured.data?.items[0];

  return (
    <div className="pb-4">
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
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

            <h1 className="text-3xl font-black leading-[1.35] sm:text-4xl md:text-5xl md:leading-[1.3]">
              سایزی که اندازه است،
              <br />
              جنسی که <span className="text-primary">دوام</span> دارد.
            </h1>

            <p className="max-w-lg text-base leading-8 text-muted-foreground">
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

            <dl className="grid max-w-md grid-cols-3 gap-4 pt-4">
              {[
                { label: "مدل شلوار", value: "۵۰+" },
                { label: "رضایت مشتری", value: "۹۶٪" },
                { label: "ارسال یک‌روزه", value: "تهران" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border bg-card/60 p-3 text-center">
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
                {heroProduct ? (
                  <Link
                    to={`/products/${heroProduct.slug}`}
                    className="block overflow-hidden rounded-xl border bg-card shadow-lg transition-transform hover:-translate-y-1"
                  >
                    <SmartImage
                      src={heroProduct.images[0]?.url}
                      alt={heroProduct.title}
                      wrapperClassName="aspect-[4/5] w-full"
                    />
                  </Link>
                ) : (
                  <Skeleton className="aspect-[4/5] w-full rounded-xl" />
                )}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-xs text-muted-foreground">جدول سایز دقیق</p>
                  <p className="mt-1 text-sm font-semibold">دور کمر، دم پا و قد را مقایسه کنید</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border bg-primary p-4 text-primary-foreground shadow-lg">
                  <p className="text-xs opacity-80">تخفیف هفتگی</p>
                  <p className="mt-1 text-3xl font-black">۳۰٪</p>
                  <p className="mt-1 text-xs opacity-90">روی مدل‌های منتخب جین</p>
                </div>
                {featured.data?.items[1] && (
                  <Link
                    to={`/products/${featured.data.items[1].slug}`}
                    className="block overflow-hidden rounded-xl border bg-card shadow-sm transition-transform hover:-translate-y-1"
                  >
                    <SmartImage
                      src={featured.data.items[1].images[0]?.url}
                      alt={featured.data.items[1].title}
                      wrapperClassName="aspect-[4/5] w-full"
                    />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- categories ---------- */}
      <section className="container py-12">
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
                className="group relative overflow-hidden rounded-lg border bg-card p-6 transition-colors hover:border-primary"
              >
                <p className="text-lg font-bold group-hover:text-primary">{category.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatNumber(category.productCount)} محصول موجود
                </p>
                <ArrowLeft className="absolute end-6 top-6 size-5 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------- featured ---------- */}
      <section className="container py-6">
        <SectionHeading
          title="پیشنهاد ویژه شلوارسرا"
          description="منتخب کارشناسان ما از میان محبوب‌ترین مدل‌ها"
          to="/products?featured=true"
          icon={Sparkles}
        />
        <ProductGrid products={featured.data?.items} isLoading={featured.isLoading} skeletonCount={4} />
      </section>

      {/* ---------- discounted ---------- */}
      <section className="container py-12">
        <SectionHeading
          title="تخفیف‌های امروز"
          description="بیشترین تخفیف‌ها روی موجودی محدود"
          to="/products?sort=discount"
          icon={TrendingUp}
        />
        <ProductGrid products={discounted.data?.items} isLoading={discounted.isLoading} skeletonCount={4} />
      </section>
    </div>
  );
}
