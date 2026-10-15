/**
 * Token storage.
 *
 * Kept separate from the API client and the auth store so neither has to import
 * the other (which would create a cycle).
 *
 * Note: localStorage is readable by any script on the page, so it is vulnerable
 * to XSS. Moving refresh tokens into an httpOnly cookie is the next hardening
 * step; the access token can stay in memory.
 */

const ACCESS_KEY = "shalvarsara.access_token";
const REFRESH_KEY = "shalvarsara.refresh_token";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: StoredTokens): void {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

/** Let other modules (e.g. the auth store) react to a forced sign-out. */
export function subscribeToTokenChanges(handler: () => void): () => void {
  const listener = (event: StorageEvent) => {
    if (event.key === ACCESS_KEY || event.key === REFRESH_KEY) handler();
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
