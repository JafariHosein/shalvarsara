/**
 * Token storage.
 *
 * Kept separate from the API client and the auth store so neither has to import
 * the other (which would create a cycle).
 *
 * Note: localStorage is readable by any script on the page, so it is vulnerable
 * to XSS. Moving refresh tokens into an httpOnly cookie is the next hardening
 * step; the access token can stay in memory.
 *
 * Every access is guarded. `localStorage` throws — not just returns null — when
 * storage is disabled, when the page runs in an opaque/sandboxed origin, and
 * when a write exceeds the quota. Unguarded access meant that in those browsers
 * *every* API call failed (the read happens on each request) and the app stayed
 * stuck on its loading screen forever. Falling back to an in-memory map keeps
 * the session working for the tab's lifetime.
 */

const ACCESS_KEY = "shalvarsara.access_token";
const REFRESH_KEY = "shalvarsara.refresh_token";

/** Used when localStorage is unavailable; cleared on reload, which is fine. */
const memory = new Map<string, string>();

function readKey(key: string): string | null {
  try {
    const value = window.localStorage.getItem(key);
    if (value !== null) return value;
  } catch {
    /* storage unavailable — fall through to the in-memory copy */
  }
  return memory.get(key) ?? null;
}

function writeKey(key: string, value: string): void {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* quota or blocked storage: the in-memory copy still serves this tab */
  }
}

function removeKey(key: string): void {
  memory.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  return readKey(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return readKey(REFRESH_KEY);
}

export function setTokens(tokens: StoredTokens): void {
  writeKey(ACCESS_KEY, tokens.accessToken);
  writeKey(REFRESH_KEY, tokens.refreshToken);
}

/** Event name the auth store listens to, so a forced sign-out resets it. */
export const AUTH_CLEARED_EVENT = "shalvarsara:auth-cleared";

export function clearTokens(): void {
  removeKey(ACCESS_KEY);
  removeKey(REFRESH_KEY);
  // The `storage` event does not fire in the tab that made the change, so a
  // same-tab forced sign-out (a 401 the refresh could not fix) has to announce
  // itself explicitly. Without this the store kept reporting "authenticated"
  // while every request went out without a token.
  try {
    window.dispatchEvent(new Event(AUTH_CLEARED_EVENT));
  } catch {
    /* dispatching is best effort */
  }
}
