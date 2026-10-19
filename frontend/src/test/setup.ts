import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

/**
 * Global test setup.
 *
 * jsdom lacks a few browser APIs the app touches on mount (storage, matchMedia,
 * the scroll helpers, the observers). They are provided once here so individual
 * tests only have to care about the behaviour they assert.
 */

/**
 * A spec-shaped `Storage` backed by a Map.
 *
 * Needed because Node 22+ defines a global `localStorage` getter that returns
 * `undefined` unless the process was started with `--localstorage-file`. Vitest's
 * jsdom environment copies jsdom's globals onto `globalThis` but leaves existing
 * ones alone, so without this shim `localStorage` is `undefined` in every test.
 * The shim is installed only when the runtime one is unusable, so a real
 * implementation (e.g. a newer jsdom) always wins.
 */
class MemoryStorage implements Storage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    const value = this.map.get(String(key));
    return value === undefined ? null : value;
  }

  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.map.set(String(key), String(value));
  }
}

function ensureStorage(name: "localStorage" | "sessionStorage"): void {
  const existing = globalThis[name] as Storage | undefined;
  if (existing && typeof existing.getItem === "function") return;
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
}

ensureStorage("localStorage");
ensureStorage("sessionStorage");

// `ThemeProvider` calls `matchMedia` for the "system" preference.
if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList,
  });
}

// jsdom implements neither of these, and several pages call them on mount.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

// Radix measures its floating elements with these; a no-op keeps portalled
// menus from throwing without changing anything the tests assert on.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!globalThis.IntersectionObserver) {
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof IntersectionObserver;
}

beforeEach(() => {
  // `restoreMocks` restores spies after each test; clearing here also drops the
  // call history of the stand-in globals defined above.
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  // Each test starts from a clean slate: the auth token, the persisted guest
  // cart and the payment hand-off all live in web storage.
  localStorage.clear();
  sessionStorage.clear();
});
