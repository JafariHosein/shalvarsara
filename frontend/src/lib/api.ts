import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "./token";

/** Resolves the build-time API base URL.
 *
 *  Accepts a full URL (`https://api.example.com/api/v1`), a bare host
 *  (`api.example.com`, handy when a host only exposes a hostname) or a
 *  relative path (`/api/v1`, meaning same origin). A missing `/api/v1`
 *  suffix is appended.
 */
function resolveBase(raw: string | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "/api/v1";
  if (value.startsWith("/")) return value.replace(/\/+$/, "") || "/api/v1";
  const qualified = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const trimmed = qualified.replace(/\/+$/, "");
  return /\/api(\/|$)/.test(trimmed) ? trimmed : `${trimmed}/api/v1`;
}

const RAW_BASE = resolveBase(import.meta.env.VITE_API_BASE_URL);

/** Absolute base URL, resolved against the current origin when relative. */
const BASE = RAW_BASE.startsWith("http") ? RAW_BASE : new URL(RAW_BASE, window.location.origin).toString().replace(/\/+$/, "");

/** ApiError carries the backend's error envelope: { code, message, details }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string>;

  constructor(status: number, code: string, message: string, details?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the server rejected the payload (422). */
  get isValidation(): boolean {
    return this.status === 422;
  }
}

export type QueryValue = string | number | boolean | undefined | null;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Attach the access token and transparently refresh it on 401. */
  auth?: boolean;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

interface RefreshResponse {
  tokens: { accessToken: string; refreshToken: string };
}

// A single in-flight refresh is shared, so ten parallel 401s trigger one call.
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = performRefresh();
  return refreshInFlight.finally(() => {
    refreshInFlight = null;
  });
}

async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const response = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as RefreshResponse;
    setTokens(data.tokens);
    return data.tokens.accessToken;
  } catch {
    return null;
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Core request helper. Throws ApiError for any non-2xx response. */
export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, query, signal } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token = getAccessToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "network_error", "ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.");
  }

  // Expired access token: refresh once, then replay the original request.
  if (response.status === 401 && auth) {
    const fresh = await refreshAccessToken();
    if (fresh) return api<T>(path, { ...options, auth: true });
    clearTokens();
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? parseJson(text) : null;

  if (!response.ok) {
    const envelope = (data as { error?: { code?: string; message?: string; details?: Record<string, string> } } | null)?.error;
    throw new ApiError(
      response.status,
      envelope?.code ?? "unknown_error",
      envelope?.message ?? "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
      envelope?.details,
    );
  }

  return data as T;
}

export const http = {
  get: <T>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    api<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    api<T>(path, { ...options, method: "POST", body }),

  patch: <T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    api<T>(path, { ...options, method: "PATCH", body }),

  put: <T>(path: string, body?: unknown, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    api<T>(path, { ...options, method: "PUT", body }),

  delete: <T>(path: string, options: Omit<RequestOptions, "method" | "body"> = {}) =>
    api<T>(path, { ...options, method: "DELETE" }),
};

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "خطایی رخ داد. لطفاً دوباره تلاش کنید.";
}
