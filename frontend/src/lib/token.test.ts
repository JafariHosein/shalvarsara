import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_CLEARED_EVENT,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/token";

const ACCESS_KEY = "shalvarsara.access_token";
const REFRESH_KEY = "shalvarsara.refresh_token";

const tokens = { accessToken: "access-1", refreshToken: "refresh-1" };

afterEach(() => {
  clearTokens();
  localStorage.clear();
});

describe("token storage round-trip", () => {
  it("starts empty", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("stores and reads both tokens", () => {
    setTokens(tokens);
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
  });

  it("writes under the documented storage keys", () => {
    setTokens(tokens);
    expect(localStorage.getItem(ACCESS_KEY)).toBe("access-1");
    expect(localStorage.getItem(REFRESH_KEY)).toBe("refresh-1");
  });

  it("overwrites an existing pair", () => {
    setTokens(tokens);
    setTokens({ accessToken: "access-2", refreshToken: "refresh-2" });
    expect(getAccessToken()).toBe("access-2");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("clears both tokens", () => {
    setTokens(tokens);
    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem(ACCESS_KEY)).toBeNull();
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull();
  });

  it("is a no-op when clearing an empty store", () => {
    expect(() => clearTokens()).not.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});

describe("token storage when localStorage throws", () => {
  /**
   * Replace one localStorage method with a throwing stub.
   *
   * The spy goes on the live instance rather than `Storage.prototype` because
   * the test setup installs a spec-shaped `Storage` stand-in (Node 22+ shadows
   * jsdom's with an unusable global), and the instance is what the module reads.
   */
  function breakStorage(method: "getItem" | "setItem" | "removeItem") {
    return vi.spyOn(localStorage, method).mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
  }

  it("does not throw when reading, and reports no token", () => {
    const spy = breakStorage("getItem");
    expect(() => getAccessToken()).not.toThrow();
    expect(getAccessToken()).toBeNull();
    expect(() => getRefreshToken()).not.toThrow();
    spy.mockRestore();
  });

  it("does not throw when writing", () => {
    const spy = breakStorage("setItem");
    expect(() => setTokens(tokens)).not.toThrow();
    spy.mockRestore();
  });

  it("does not throw when clearing", () => {
    const spy = breakStorage("removeItem");
    expect(() => clearTokens()).not.toThrow();
    spy.mockRestore();
  });

  it("keeps the session alive in memory when writes fail", () => {
    // This is the behaviour that keeps the app usable in a browser that blocks
    // storage (private mode, a sandboxed iframe, a full quota): the token is
    // still readable for the lifetime of the tab.
    const spy = breakStorage("setItem");
    setTokens(tokens);
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
    spy.mockRestore();
  });

  it("falls back to memory when reads throw after a successful write", () => {
    setTokens(tokens);
    const spy = breakStorage("getItem");
    expect(getAccessToken()).toBe("access-1");
    expect(getRefreshToken()).toBe("refresh-1");
    spy.mockRestore();
  });

  it("clears the in-memory copy too", () => {
    const spy = breakStorage("setItem");
    setTokens(tokens);
    expect(getAccessToken()).toBe("access-1");
    clearTokens();
    spy.mockRestore();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});

describe("clearTokens signalling", () => {
  it("announces a forced sign-out on the window", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_CLEARED_EVENT, listener);

    clearTokens();

    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_CLEARED_EVENT, listener);
  });

  it("does not announce anything on a plain write", () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_CLEARED_EVENT, listener);

    setTokens(tokens);

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_CLEARED_EVENT, listener);
  });
});

describe("subscribeToTokenChanges", () => {
  it("is no longer part of the module's API", async () => {
    // Cross-tab sign-out used to rely on a `storage` listener. It was replaced
    // by the same-tab AUTH_CLEARED_EVENT above, which also covers the tab that
    // performed the sign-out (a `storage` event never fires there).
    const tokenModule = await import("@/lib/token");
    expect("subscribeToTokenChanges" in tokenModule).toBe(false);
    expect(typeof tokenModule.AUTH_CLEARED_EVENT).toBe("string");
  });
});
