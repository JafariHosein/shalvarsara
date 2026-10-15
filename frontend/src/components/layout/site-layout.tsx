import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { FullPageLoader } from "@/components/common/protected-route";

/** Reset scroll position when the path changes (not on query-only changes). */
function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

/**
 * Public shell: header, routed page, footer.
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
    </div>
  );
}
