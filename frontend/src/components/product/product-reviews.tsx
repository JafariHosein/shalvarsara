import * as React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Loader2, MessageSquareText, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/empty-state";
import { PaginationBar } from "@/components/common/pagination-bar";
import { RatingStars } from "@/components/product/rating-stars";
import { useCreateReview, useMyReview, useProductReviews } from "@/hooks/use-reviews";
import { formatDate, formatNumber, formatRating } from "@/lib/format";
import { useIsAuthenticated } from "@/store/auth-store";
import { REVIEW_STATUS_LABELS, type MyReview, type ProductReview, type ReviewSummary } from "@/types/api";
import { cn } from "@/lib/utils";

/** Longest comment the API accepts (model.ReviewInput). */
const COMMENT_MAX = 1500;

interface ProductReviewsProps {
  slug: string;
}

/**
 * The review block of the product page: the rating breakdown, the published
 * reviews, and the signed-in buyer's own review and form.
 *
 * Every published review comes from a delivered order — the server enforces it —
 * so the list can carry a "خریدار" badge on every row.
 */
export function ProductReviews({ slug }: ProductReviewsProps) {
  const [page, setPage] = React.useState(1);

  // Another product means another list; start it at page one.
  React.useEffect(() => setPage(1), [slug]);

  const query = useProductReviews(slug, page);
  const summary = query.data?.summary;
  const list = query.data?.reviews;

  return (
    <section id="reviews" className="mt-16 scroll-mt-32">
      <h2 className="mb-6 flex items-center gap-2 text-xl font-extrabold">
        <MessageSquareText className="size-5 shrink-0 text-primary" />
        نظرات خریداران
      </h2>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          {summary ? <RatingSummaryCard summary={summary} /> : <SummarySkeleton />}
        </div>

        <div className="min-w-0 space-y-4">
          <MyReviewBlock slug={slug} />

          {query.isLoading ? (
            <ReviewListSkeleton />
          ) : list && list.items.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-3">
                {list.items.map((review) => (
                  <ReviewItem key={review.id} review={review} />
                ))}
              </div>
              <PaginationBar
                page={list.page}
                totalPages={list.totalPages}
                total={list.total}
                pageSize={list.limit}
                itemLabel="نظر"
                onChange={(next) => {
                  setPage(next);
                  document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>
          ) : (
            <EmptyState
              title="هنوز نظری برای این محصول ثبت نشده است."
              description="تنها خریداران این محصول می‌توانند نظر بدهند؛ اگر آن را خریده‌اید، اولین نفر باشید."
              className="py-12"
            />
          )}
        </div>
      </div>
    </section>
  );
}

/** Average, stars and the one-per-star breakdown. */
function RatingSummaryCard({ summary }: { summary: ReviewSummary }) {
  const hasRatings = summary.count > 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <span className="text-4xl font-extrabold tabular-nums">
          {hasRatings ? formatRating(summary.average) : "—"}
        </span>
        <div className="min-w-0">
          <RatingStars value={summary.average} />
          <p className="mt-1 text-xs text-muted-foreground">
            {hasRatings
              ? `بر پایهٔ ${formatNumber(summary.count)} نظر خریداران`
              : "هنوز امتیازی ثبت نشده است."}
          </p>
        </div>
      </div>

      {hasRatings && (
        <div className="mt-5 space-y-2 border-t pt-4">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.stars[star - 1] ?? 0;
            const percent = summary.count > 0 ? (count / summary.count) * 100 : 0;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="flex w-10 shrink-0 items-center gap-1 text-muted-foreground">
                  {formatNumber(star)}
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${percent}%` }} />
                </div>
                <span className="w-8 shrink-0 text-end tabular-nums text-muted-foreground">
                  {formatNumber(count)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** One published review. */
function ReviewItem({ review }: { review: ProductReview }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RatingStars value={review.rating} />
        <Badge variant="success" className="gap-1 text-[10px]">
          <BadgeCheck className="size-3" />
          خریدار
        </Badge>
        <span className="ms-auto text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
      </div>

      <p className="mt-1.5 text-sm font-semibold">{review.author}</p>

      {review.comment ? (
        <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">{review.comment}</p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">این خریدار فقط امتیاز داده است.</p>
      )}
    </article>
  );
}

/**
 * The signed-in customer's side of the form: the form itself when they are a
 * buyer with nothing written yet, a status card plus an edit form when they
 * already reviewed, and a short note when they are not allowed to review.
 */
function MyReviewBlock({ slug }: { slug: string }) {
  const isAuthenticated = useIsAuthenticated();
  const mine = useMyReview(slug);

  if (!isAuthenticated) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
        تنها خریداران این محصول می‌توانند نظر ثبت کنند.
        <Link to="/login" className="font-medium text-primary hover:underline">
          ورود به حساب کاربری
        </Link>
      </div>
    );
  }

  if (mine.isLoading) return <ReviewFormSkeleton />;

  if (!mine.data?.canReview) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm leading-7 text-muted-foreground">
        فقط پس از خرید و تحویل این محصول می‌توانید نظر ثبت کنید. پس از تحویل سفارش، فرم ثبت نظر
        همین‌جا فعال می‌شود.
      </div>
    );
  }

  return <ReviewForm slug={slug} existing={mine.data.review} />;
}

interface ReviewFormProps {
  slug: string;
  existing?: MyReview["review"];
}

function ReviewForm({ slug, existing }: ReviewFormProps) {
  const createReview = useCreateReview(slug);

  const [editing, setEditing] = React.useState(!existing);
  const [rating, setRating] = React.useState(existing?.rating ?? 0);
  const [comment, setComment] = React.useState(existing?.comment ?? "");
  const [error, setError] = React.useState<string | null>(null);

  // An edit starts from what the customer already wrote.
  React.useEffect(() => {
    setEditing(!existing);
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? "");
    setError(null);
  }, [existing]);

  const status = existing?.status;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setError("امتیاز خود را انتخاب کنید.");
      return;
    }
    setError(null);
    try {
      await createReview.mutateAsync({ rating, comment: comment.trim() });
      setEditing(false);
    } catch {
      // The hook already surfaced the API message.
    }
  }

  return (
    <div className="rounded-xl border bg-card p-4">
      {existing && !editing ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">نظر شما</span>
            <Badge variant={status === "approved" ? "success" : status === "rejected" ? "destructive" : "warning"}>
              {status ? REVIEW_STATUS_LABELS[status] : ""}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <RatingStars value={existing.rating} />
            <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {existing.comment || "فقط امتیاز داده‌اید."}
            </p>
          </div>

          {status === "pending" && (
            <p className="text-xs leading-6 text-muted-foreground">
              نظر شما در صف بررسی است و پس از تأیید در همین صفحه منتشر می‌شود.
            </p>
          )}

          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            ویرایش نظر
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">{existing ? "ویرایش نظر" : "ثبت نظر"}</span>
            <span className="text-xs text-muted-foreground">از ۵ ستاره</span>
          </div>

          <StarPicker value={rating} onChange={setRating} />

          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={COMMENT_MAX}
            rows={4}
            placeholder="از کیفیت پارچه، دوخت و اندازهٔ محصول بنویسید…"
            aria-label="متن نظر"
          />

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          {existing && (
            <p className="text-xs leading-6 text-muted-foreground">
              با ثبت ویرایش، نظر شما دوباره برای تأیید به صف بررسی می‌رود.
            </p>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="gap-2" disabled={createReview.isPending}>
              {createReview.isPending && <Loader2 className="size-4 animate-spin" />}
              {existing ? "ذخیرهٔ ویرایش" : "ثبت نظر"}
            </Button>
            {existing && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setRating(existing.rating);
                  setComment(existing.comment);
                  setError(null);
                }}
              >
                انصراف
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/** Interactive five-star picker (the read-only twin is `RatingStars`). */
function StarPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="امتیاز">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ستاره`}
          onClick={() => onChange(star)}
          className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              "size-7",
              star <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
            )}
          />
        </button>
      ))}
      {value > 0 && <span className="ms-1 text-xs text-muted-foreground">{formatNumber(value)} ستاره</span>}
    </div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-center gap-4">
        <div className="size-12 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2 border-t pt-4">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-3 animate-pulse rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

function ReviewListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }, (_, index) => (
        <div key={index} className="space-y-2 rounded-xl border bg-card p-4">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-full animate-pulse rounded bg-muted" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}

function ReviewFormSkeleton() {
  return <div className="h-24 animate-pulse rounded-xl bg-muted/60" />;
}
