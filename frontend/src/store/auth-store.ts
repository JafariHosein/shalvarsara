import { create } from "zustand";

import { CART_QUERY_KEY, syncGuestCart } from "@/lib/cart-cache";
import { queryClient } from "@/lib/query-client";
import { clearTokens, getAccessToken, setTokens } from "@/lib/token";
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  setUser: (user) => set({ user, status: "authenticated" }),

  login: async (payload) => {
    const { user, tokens } = await authService.login(payload);
    setTokens(tokens);
    set({ user, status: "authenticated" });
    // Whatever the visitor collected before signing in belongs to their account.
    await syncGuestCart();
    return user;
  },

  register: async (payload) => {
    const { user, tokens } = await authService.register(payload);
    setTokens(tokens);
    set({ user, status: "authenticated" });
    await syncGuestCart();
    return user;
  },

  logout: async () => {
    try {
      // Best effort: the server has nothing to revoke for stateless JWTs, but
      // calling it keeps the client honest if that ever changes.
      await authService.logout();
    } catch {
      /* ignore network errors on logout */
    }
    clearTokens();
    // The server cart stays with the account; the next visitor on this browser
    // starts from an empty guest cart.
    queryClient.removeQueries({ queryKey: CART_QUERY_KEY });
    set({ user: null, status: "anonymous" });
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
      await syncGuestCart();
    } catch {
      // Token missing, expired beyond refresh, or the account was deactivated.
      clearTokens();
      set({ user: null, status: "anonymous" });
    }
  },
}));

/** Convenience selectors used across the UI. */
export const useCurrentUser = () => useAuthStore((state) => state.user);
export const useAuthStatus = () => useAuthStore((state) => state.status);
export const useIsAuthenticated = () => useAuthStore((state) => state.status === "authenticated");
export const useIsAdmin = () => useAuthStore((state) => state.user?.role === "admin");
