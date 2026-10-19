import { create } from "zustand";
import { toast } from "sonner";

import { syncGuestCart } from "@/lib/cart-cache";
import { queryClient } from "@/lib/query-client";
import { AUTH_CLEARED_EVENT, clearTokens, getAccessToken, setTokens } from "@/lib/token";
import { authService, type LoginPayload, type RegisterPayload } from "@/services/auth";
import type { User } from "@/types/api";

type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthState {
  user: User | null;
  /** "loading" only while the initial session is being restored. */
  status: AuthStatus;
  login: (payload: LoginPayload) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  logout: () => Promise<void>;
  /** Restore the session from a stored token on app start. */
  bootstrap: () => Promise<void>;
  setUser: (user: User) => void;
}

/**
 * Drop every cached response and forget the signed-in user.
 *
 * Clearing the whole query cache — not just the cart — is what stops the next
 * person on a shared browser from seeing the previous account's wishlist, order
 * history and saved addresses: those queries are keyed only by their own name,
 * so their cached pages would otherwise be served straight back.
 */
function resetSession(): void {
  queryClient.clear();
  useAuthStore.setState({ user: null, status: "anonymous" });
}

/**
 * Carry the browser cart over to the account that just signed in.
 *
 * The guest cart is cleared by the merge itself once the server accepts it, so
 * a failure here leaves it intact and the next sign-in retries. The outcome is
 * reported: silently dropping lines the server refused (delisted or out of
 * stock) would look like the basket vanished.
 */
async function transferGuestCart(): Promise<void> {
  const skipped = await syncGuestCart();
  if (skipped < 0) {
    toast.warning("سبد خرید مهمان به حساب شما منتقل نشد. پس از ورود دوباره تلاش کنید.");
    return;
  }
  if (skipped > 0) {
    toast.warning(`${skipped.toLocaleString("fa-IR")} کالا از سبد مهمان منتقل نشد (ناموجود یا حذف‌شده).`);
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  setUser: (user) => set({ user, status: "authenticated" }),

  login: async (payload) => {
    const { user, tokens } = await authService.login(payload);
    setTokens(tokens);
    set({ user, status: "authenticated" });
    // Whatever the visitor collected before signing in belongs to their account.
    await transferGuestCart();
    return user;
  },

  register: async (payload) => {
    const { user, tokens } = await authService.register(payload);
    setTokens(tokens);
    set({ user, status: "authenticated" });
    await transferGuestCart();
    return user;
  },

  logout: async () => {
    try {
      // The server bumps the account's token version, so every access and
      // refresh token issued before this call stops working — including any
      // copy a thief may hold.
      await authService.logout();
    } catch {
      /* ignore network errors on logout; the local session goes anyway */
    }
    clearTokens();
    // The server cart stays with the account; the next visitor on this browser
    // starts from an empty guest cart.
    resetSession();
  },

  bootstrap: async () => {
    if (!getAccessToken()) {
      set({ user: null, status: "anonymous" });
      return;
    }
    try {
      const user = await authService.me();
      set({ user, status: "authenticated" });
      // A guest cart can survive from another tab's sign-in.
      await transferGuestCart();
    } catch {
      // Token missing, expired beyond refresh, or the account was deactivated.
      clearTokens();
      set({ user: null, status: "anonymous" });
    }
  },
}));

// A 401 the refresh could not fix clears the tokens from the API client. That
// happens outside this store, so listen for it and reset — otherwise the UI
// would keep rendering protected pages while every request quietly failed.
window.addEventListener(AUTH_CLEARED_EVENT, () => {
  queryClient.clear();
  useAuthStore.setState({ user: null, status: "anonymous" });
});

/** Convenience selectors used across the UI. */
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useAuthStatus = () => useAuthStore((state) => state.status);
export const useIsAuthenticated = () => useAuthStore((state) => state.status === "authenticated");
export const useIsAdmin = () => useAuthStore((state) => state.user?.role === "admin");
