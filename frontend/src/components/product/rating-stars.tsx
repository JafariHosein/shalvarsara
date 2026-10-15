import { Star } from "lucide-react";

import { formatNumber, formatRating } from "@/lib/format";
import { cn } from "@/lib/utils";

interface RatingStarsProps {
  /** Average rating between 0 and 5. */
  value: number;
  /** Number of ratings, shown in parentheses when provided. */
  count?: number;
  className?: string;
}

const STAR_COUNT = 5;

/**
 * Five-star rating, filled from the inline start (right in RTL) so a 3.5 shows
 * three and a half stars. The filled row is absolutely positioned inside a
 * clipping box whose width is the rating percentage, which renders partial
 * stars accurately without a charting dependency.
 *
 * The filled row keeps its natural width (`w-max` + `shrink-0`): without it the
 * five icons are flex items inside a narrow box and get squashed into each
 * other instead of being clipped.
 */
export function RatingStars({ value, count, className }: RatingStarsProps) {
  const clamped = Math.max(0, Math.min(STAR_COUNT, Number.isFinite(value) ? value : 0));
  const percent = (clamped / STAR_COUNT) * 100;

  const stars = Array.from({ length: STAR_COUNT }, (_, index) => (
    <Star key={index} className="size-3.5 shrink-0 fill-current" />
  ));

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={
        count != null && count > 0
          ? `امتیاز ${formatRating(clamped)} از ۵ بر پایه ${formatNumber(count)} نظر`
          : `امتیاز ${formatRating(clamped)} از ۵`
      }
    >
      <div className="relative inline-flex shrink-0" aria-hidden="true">
        <div className="flex gap-0.5 text-muted-foreground/30">{stars}</div>
        <div className="absolute inset-y-0 start-0 overflow-hidden" style={{ width: `${percent}%` }}>
          <div className="flex w-max gap-0.5 text-amber-400">{stars}</div>
        </div>
      </div>
      <span className="text-xs text-muted-foreground" aria-hidden="true">
        {formatRating(clamped)}
        {count != null && count > 0 && <span className="ms-1">({formatNumber(count)})</span>}
      </span>
    </div>
  );
}
