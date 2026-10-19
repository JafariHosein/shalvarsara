import { CART_QUERY_KEY, MAX_MERGE_QUANTITY, getCachedCart, setCachedCart, syncGuestCart } from "@/lib/cart-cache";
import { queryClient } from "@/lib/query-client";
import { useCartStore } from "@/store/cart-store";
import { cartService } from "@/services/cart";
import type { MergeCartResult, Product, ServerCart } from "@/types/api";

vi.mock("@/services/cart", () => ({
  cartService: {
    get: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    merge: vi.fn(),
  },
}));

const mergeMock = vi.mocked(cartService.merge);

function makeProduct(id: number, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title: `محصول ${id}`,
    slug: `product-${id}`,
    shortDesc: "",
    description: "",
    categoryId: 1,
    brand: "",
    gender: "",
    pantType: "",
    fabric: "",
    price: 100_000,
    discountPrice: null,
    stock: 500,
    sku: `P-${id}`,
    ratingAvg: 0,
    ratingCount: 0,
    soldCount: 0,
    isActive: true,
    isFeatured: false,
    images: [],
    variants: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function emptyCart(): ServerCart {
  return { items: [], itemCount: 0, subtotal: 0 };
}

function mergeResult(overrides: Partial<MergeCartResult> = {}): MergeCartResult {
  return { cart: emptyCart(), skipped: 0, ...overrides };
}

beforeEach(async () => {
  // `syncGuestCart` keeps a module-level in-flight promise; letting any previous
  // merge settle first means each test starts from a free slot.
  await syncGuestCart();
  useCartStore.setState({ lines: [] });
  queryClient.clear();
  mergeMock.mockReset();
  mergeMock.mockResolvedValue(mergeResult());
  localStorage.clear();
});

describe("cart query cache", () => {
  it("stores and reads the cart", () => {
    const cart: ServerCart = {
      items: [],
      itemCount: 2,
      subtotal: 200_000,
    };

    setCachedCart(cart);

    expect(getCachedCart()).toEqual(cart);
    expect(queryClient.getQueryData(CART_QUERY_KEY)).toEqual(cart);
  });

  it("returns undefined when nothing is cached", () => {
    expect(getCachedCart()).toBeUndefined();
  });
});

describe("syncGuestCart", () => {
  it("does nothing when the guest cart is empty", async () => {
    await expect(syncGuestCart()).resolves.toBe(0);
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it("sends one payload line per guest line", async () => {
    useCartStore.getState().add(makeProduct(1), null, 2);
    useCartStore.getState().add(makeProduct(2), null, 1);

    await syncGuestCart();

    expect(mergeMock).toHaveBeenCalledTimes(1);
    expect(mergeMock.mock.calls[0][0]).toEqual([
      { productId: 1, variantId: null, quantity: 2 },
      { productId: 2, variantId: null, quantity: 1 },
    ]);
  });

  it("clamps a line quantity above 99 before sending it to the merge endpoint", async () => {
    // The guest cart is only clamped by stock, so a product with 500 in stock
    // produces a line of 500 — which the endpoint rejects outright.
    useCartStore.getState().add(makeProduct(1, { stock: 500 }), null, 500);
    expect(useCartStore.getState().lines[0].quantity).toBe(500);

    await syncGuestCart();

    const sent = mergeMock.mock.calls[0][0];
    expect(sent[0].quantity).toBe(MAX_MERGE_QUANTITY);
    expect(sent[0].quantity).toBe(99);
  });

  it("never sends a quantity below 1 either", async () => {
    useCartStore.getState().add(makeProduct(1), null, 1);
    // Force an invalid line past the store's own clamping.
    useCartStore.setState((state) => ({
      lines: state.lines.map((line) => ({ ...line, quantity: 0 })),
    }));

    await syncGuestCart();

    expect(mergeMock.mock.calls[0][0][0].quantity).toBe(1);
  });

  it("clamps every line independently, leaving valid quantities untouched", async () => {
    useCartStore.getState().add(makeProduct(1, { stock: 500 }), null, 500);
    useCartStore.getState().add(makeProduct(2, { stock: 500 }), null, 3);
    useCartStore.getState().add(makeProduct(3, { stock: 500 }), null, 99);

    await syncGuestCart();

    const sent = mergeMock.mock.calls[0][0];
    expect(sent.map((line) => line.quantity)).toEqual([99, 3, 99]);
  });

  it("clears the guest cart once the server accepts it", async () => {
    useCartStore.getState().add(makeProduct(1), null, 1);

    await syncGuestCart();

    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("caches the server's cart and reports the skipped count", async () => {
    const cart: ServerCart = { items: [], itemCount: 4, subtotal: 400_000 };
    mergeMock.mockResolvedValue(mergeResult({ cart, skipped: 2 }));
    useCartStore.getState().add(makeProduct(1), null, 1);

    await expect(syncGuestCart()).resolves.toBe(2);

    expect(getCachedCart()).toEqual(cart);
  });

  it("keeps the guest cart for a retry when the request fails", async () => {
    mergeMock.mockRejectedValue(new Error("network down"));
    useCartStore.getState().add(makeProduct(1), null, 1);

    await expect(syncGuestCart()).resolves.toBe(-1);

    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(getCachedCart()).toBeUndefined();
  });

  it("signals a failed merge with -1, not 0", async () => {
    // 0 means "nothing needed dropping" and -1 means "nothing was merged". The
    // caller toasts a warning on -1, so collapsing the two would either hide a
    // lost basket or cry wolf on every sign-in.
    mergeMock.mockRejectedValue(new Error("network down"));
    useCartStore.getState().add(makeProduct(1), null, 1);

    const failed = await syncGuestCart();
    expect(failed).toBe(-1);
    expect(failed).not.toBe(0);
  });

  it("resolves to 0, not -1, when the server accepted the merge", async () => {
    mergeMock.mockResolvedValue(mergeResult({ skipped: 0 }));
    useCartStore.getState().add(makeProduct(1), null, 1);

    await expect(syncGuestCart()).resolves.toBe(0);
  });

  it("resolves to 0, not -1, when there was nothing to merge", async () => {
    await expect(syncGuestCart()).resolves.toBe(0);
    expect(mergeMock).not.toHaveBeenCalled();
  });

  it("keeps the whole guest cart, not just the failed line, for the retry", async () => {
    mergeMock.mockRejectedValue(new Error("network down"));
    useCartStore.getState().add(makeProduct(1, { stock: 500 }), null, 500);
    useCartStore.getState().add(makeProduct(2), null, 2);

    await syncGuestCart();

    expect(useCartStore.getState().lines.map((line) => line.key)).toEqual(["1:0", "2:0"]);
  });

  it("runs only one merge at a time", async () => {
    useCartStore.getState().add(makeProduct(1), null, 1);

    await Promise.all([syncGuestCart(), syncGuestCart()]);

    // StrictMode mounts effects twice; two merges would double every line.
    expect(mergeMock).toHaveBeenCalledTimes(1);
  });

  it("allows a later merge after the first one settles", async () => {
    useCartStore.getState().add(makeProduct(1), null, 1);
    await syncGuestCart();

    useCartStore.getState().add(makeProduct(2), null, 1);
    await syncGuestCart();

    expect(mergeMock).toHaveBeenCalledTimes(2);
  });

  it("does not run a second merge when the guest cart was already emptied", async () => {
    useCartStore.getState().add(makeProduct(1), null, 1);
    await syncGuestCart();

    await expect(syncGuestCart()).resolves.toBe(0);
    expect(mergeMock).toHaveBeenCalledTimes(1);
  });
});
