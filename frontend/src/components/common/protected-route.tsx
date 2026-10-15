import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuthStatus, useIsAdmin } from "@/store/auth-store";

/** Full-page spinner shown while the session is being restored. */
export function FullPageLoader({ label = "در حال بارگذاری…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin text-primary" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Require the admin role in addition to being signed in. */
  adminOnly?: boolean;
}

/**
 * Guards routes that need a session. Unauthenticated visitors are sent to the
 * sign-in page with their destination remembered, so they land back here.
 */
export function ProtectedRoute({ children, adminOnly = false }: ProtectedRouteProps) {
  const status = useAuthStatus();
  const isAdmin = useIsAdmin();
  const location = useLocation();

  if (status === "loading") return <FullPageLoader label="در حال بررسی ورود…" />;

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
