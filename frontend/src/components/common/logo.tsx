import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/**
 * Wordmark for the store. Uses a doubled-line glyph that reads as a trouser leg
 * rather than a generic shopping-bag icon.
 */
export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2", className)} aria-label="شلوارسرا">
      <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:-translate-y-0.5">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M7 3h10l1.4 17h-4.1L12 10.5 9.7 20H5.6z" />
          <path d="M7 3v2.5h10V3" />
        </svg>
      </span>
      {withText && (
        <span className="flex flex-col leading-none">
          <span className="text-base font-extrabold tracking-tight">شلوارسرا</span>
          <span className="text-[10px] font-medium text-muted-foreground">پا به پای استایل‌ت</span>
        </span>
      )}
    </Link>
  );
}
