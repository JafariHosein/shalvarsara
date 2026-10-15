import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SupportWidget } from "@/components/layout/support-widget";
import { FullPageLoader } from "@/components/common/protected-route";

/**
 * Reset scroll position when the path changes (not on query-only changes) and
 * honour `#anchor` links, so footer links such as «پرسش‌های پرتکرار» land on
 * the right section instead of the top of the page.
 */
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  React.useEffect(() => {
    if (hash) {
      // The target may render a tick later (lazy route), so retry once.
      let attempts = 0;
      const scrollToTarget = () => {
        const target = document.getElementById(hash.slice(1));
        if (target) {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (attempts++ < 6) {
          window.setTimeout(scrollToTarget, 80);
        }
      };
      scrollToTarget();
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);

  return null;
}

/**
 * Public shell: header, routed page, footer and the floating support widget.
 *
 * The Suspense boundary wraps only the outlet, so lazy-loaded pages show a
 * loader inside the layout instead of blanking the header and footer.
 */
export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <Header />
      <main className="flex-1">
        <React.Suspense fallback={<FullPageLoader />}>
          <Outlet />
        </React.Suspense>
      </main>
      <Footer />
      <SupportWidget />
    </div>
  );
}
