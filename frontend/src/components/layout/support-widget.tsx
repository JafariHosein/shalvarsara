import * as React from "react";
import { Headset, Phone, Send, X } from "lucide-react";

import { CONTACT, CONTACT_FA, CONTACT_LINKS } from "@/lib/contact";
import { cn } from "@/lib/utils";

/**
 * Floating support contact, pinned to the bottom-left of every storefront page.
 *
 * Collapsed it is a single round button; expanded it is a small card with the
 * Telegram handle and both phone numbers. Both states stay mounted and cross
 * over with a CSS transition, so the toggle is interruptible mid-animation and
 * never replays a keyframe on every click.
 */
export function SupportWidget() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 print:hidden sm:bottom-5 sm:left-5">
      <div className="flex flex-col items-start">
        {/* ---------- the card ----------
            Absolutely positioned above the toggle so the collapsed widget is
            exactly the size of the button: the wrapper is pinned to the
            physical left edge, and the card floats up from the same edge. */}
        <section
          id="support-panel"
          aria-hidden={!open}
          className={cn(
            "pointer-events-auto absolute bottom-[calc(100%+0.75rem)] left-0 w-[min(20rem,calc(100vw-2rem))] origin-bottom-left rounded-2xl bg-card p-4",
            "shadow-[var(--shadow-border),0_10px_30px_-12px_hsl(0_0%_0%/0.25)]",
            "transition-[opacity,transform] duration-200 ease-out",
            open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-95 opacity-0",
          )}
        >
          <header className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Headset className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-bold">پشتیبانی شلوارسرا</p>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
                  آمادهٔ پاسخگویی
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="-me-1 -mt-1 grid size-8 place-items-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
              aria-label="بستن پنجرهٔ پشتیبانی"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="mt-4 space-y-2">
            <a
              href={CONTACT_LINKS.telegram}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 transition-colors duration-150 hover:bg-accent"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Send className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">پشتیبانی تلگرام</span>
                <span dir="ltr" className="block truncate font-semibold">
                  {CONTACT_FA.telegramId}
                </span>
              </span>
            </a>

            <a
              href={CONTACT_LINKS.phone}
              className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 transition-colors duration-150 hover:bg-accent"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Phone className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">تماس با دفتر</span>
                <span dir="ltr" className="block truncate font-semibold">
                  {CONTACT_FA.phone}
                </span>
              </span>
            </a>

            <a
              href={CONTACT_LINKS.mobile}
              className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 transition-colors duration-150 hover:bg-accent"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Phone className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">موبایل و واتساپ</span>
                <span dir="ltr" className="block truncate font-semibold">
                  {CONTACT_FA.mobile}
                </span>
              </span>
            </a>
          </div>

          <p className="mt-3 text-center text-xs leading-6 text-muted-foreground">
            {CONTACT.responseTime}
            <br />
            {CONTACT.hours}
          </p>
        </section>

        {/* ---------- the toggle ---------- */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="support-panel"
          className={cn(
            "pointer-events-auto group flex h-14 items-center gap-2 rounded-full bg-primary text-primary-foreground",
            "ps-4 pe-5 shadow-lg transition-[background-color,transform,scale] duration-150 ease-out",
            "hover:bg-primary/90 active:scale-[0.96]",
          )}
        >
          <Headset className="size-5 shrink-0 transition-transform duration-200 ease-out group-hover:-rotate-6" />
          <span className="text-sm font-bold">{open ? "بستن" : "پشتیبانی"}</span>
        </button>
      </div>
    </div>
  );
}
