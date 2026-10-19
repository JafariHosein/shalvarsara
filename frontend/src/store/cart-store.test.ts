import { lineKey, useCartStore } from "@/store/cart-store";
import type { Product, ProductVariant } from "@/types/api";

/** A product shaped like the API's, with only the fields the store reads. */
function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    title: "شلوار جین مردانه",
    slug: "jeans-men",
    shortDesc: "",
    description: "",
    categoryId: 1,
    brand: "شلوارسرا",
    gender: "men",
    pantType: "jeans",
    fabric: "دنیم",
    price: 500_000,
    discountPrice: null,
    stock: 20,
    sku: "P-1",
    ratingAvg: 4.5,
    ratingCount: 2,
    soldCount: 10,
    isActive: true,
    isFeatured: false,
    images: [{ id: 1, productId: 1, url: "/products/a.webp", alt: "", isPrimary: true, sortOrder: 0 }],
    variants: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeVariant(overrides: Partial<ProductVariant> = {}): ProductVariant {
  return {
    id: 11,
    productId: 1,
    size: "32",
    color: "آبی",
    colorHex: "#2563EB",
    stock: 5,
    sku: "P-1-32",
    extraPrice: 0,
    ...overrides,
  };
}

beforeEach(() => {
  useCartStore.setState({ lines: [] });
  localStorage.clear();
});

describe("lineKey", () => {
  it("separates a product with a variant from one without", () => {
    expect(lineKey(1, null)).toBe("1:0");
    expect(lineKey(1, 11)).toBe("1:11");
    expect(lineKey(1, null)).not.toBe(lineKey(1, 11));
  });

  it("is stable for the same input", () => {
    expect(lineKey(7, 3)).toBe(lineKey(7, 3));
  });

  it("does not collide across products or variants", () => {
    const keys = new Set([lineKey(1, null), lineKey(1, 2), lineKey(2, null), lineKey(2, 2), lineKey(12, null)]);
    expect(keys.size).toBe(5);
  });
});

describe("guest cart: add", () => {
  it("adds a new line", () => {
    useCartStore.getState().add(makeProduct(), null);

    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      key: "1:0",
      productId: 1,
      variantId: null,
      quantity: 1,
      maxQuantity: 20,
      unitPrice: 500_000,
      isAvailable: true,
    });
  });

  it("uses the discounted price as the unit price", () => {
    useCartStore.getState().add(makeProduct({ discountPrice: 400_000 }), null);
    expect(useCartStore.getState().lines[0].unitPrice).toBe(400_000);
  });

  it("adds the variant surcharge and records its size and colour", () => {
    useCartStore.getState().add(makeProduct(), makeVariant({ extraPrice: 50_000 }));

    const line = useCartStore.getState().lines[0];
    expect(line.unitPrice).toBe(550_000);
    expect(line.size).toBe("32");
    expect(line.color).toBe("آبی");
    expect(line.variantId).toBe(11);
    expect(line.key).toBe("1:11");
  });

  it("keeps two variants of the same product as separate lines", () => {
    const product = makeProduct();
    useCartStore.getState().add(product, makeVariant({ id: 11, size: "32" }));
    useCartStore.getState().add(product, makeVariant({ id: 12, size: "34" }));

    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.key)).toEqual(["1:11", "1:12"]);
  });

  it("honours the requested quantity", () => {
    useCartStore.getState().add(makeProduct(), null, 3);
    expect(useCartStore.getState().lines[0].quantity).toBe(3);
  });

  it("clamps the initial quantity to the available stock", () => {
    useCartStore.getState().add(makeProduct({ stock: 2 }), null, 9);
    expect(useCartStore.getState().lines[0].quantity).toBe(2);
    expect(useCartStore.getState().lines[0].maxQuantity).toBe(2);
  });

  it("falls back to a max of 1 when the product is out of stock", () => {
    useCartStore.getState().add(makeProduct({ stock: 0 }), null, 5);
    expect(useCartStore.getState().lines[0].maxQuantity).toBe(1);
    expect(useCartStore.getState().lines[0].quantity).toBe(1);
  });
});

describe("guest cart: merging the same product+variant", () => {
  it("merges the quantity into one line", () => {
    const product = makeProduct();
    useCartStore.getState().add(product, null, 1);
    useCartStore.getState().add(product, null, 2);

    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it("clamps the merged quantity to maxQuantity", () => {
    const product = makeProduct({ stock: 4 });
    useCartStore.getState().add(product, null, 3);
    useCartStore.getState().add(product, null, 5);

    expect(useCartStore.getState().lines[0].quantity).toBe(4);
  });

  it("does not merge across different variants", () => {
    const product = makeProduct();
    useCartStore.getState().add(product, null, 2);
    useCartStore.getState().add(product, makeVariant(), 2);

    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.quantity)).toEqual([2, 2]);
  });
});

describe("guest cart: setQuantity", () => {
  it("sets an absolute quantity", () => {
    useCartStore.getState().add(makeProduct(), null, 1);
    useCartStore.getState().setQuantity("1:0", 4);

    expect(useCartStore.getState().lines[0].quantity).toBe(4);
  });

  it("clamps to the line's maxQuantity", () => {
    useCartStore.getState().add(makeProduct({ stock: 3 }), null, 1);
    useCartStore.getState().setQuantity("1:0", 50);

    expect(useCartStore.getState().lines[0].quantity).toBe(3);
  });

  it("clamps to [1, maxQuantity] across the whole range of inputs", () => {
    // The stepper can be driven past either end, and a line restored from
    // localStorage can carry anything at all.
    useCartStore.getState().add(makeProduct({ stock: 5 }), null, 1);

    for (const requested of [-100, -1, 0, 1, 2, 5, 6, 99, 1_000]) {
      useCartStore.getState().setQuantity("1:0", requested);
      const { quantity, maxQuantity } = useCartStore.getState().lines[0];
      expect(quantity).toBeGreaterThanOrEqual(1);
      expect(quantity).toBeLessThanOrEqual(maxQuantity);
      expect(quantity).toBe(Math.min(Math.max(1, requested), maxQuantity));
    }
  });

  it("never goes below one", () => {
    useCartStore.getState().add(makeProduct(), null, 2);

    useCartStore.getState().setQuantity("1:0", 0);
    expect(useCartStore.getState().lines[0].quantity).toBe(1);

    useCartStore.getState().setQuantity("1:0", -5);
    expect(useCartStore.getState().lines[0].quantity).toBe(1);
  });

  it("leaves other lines untouched", () => {
    const product = makeProduct();
    useCartStore.getState().add(product, makeVariant({ id: 11 }), 1);
    useCartStore.getState().add(product, makeVariant({ id: 12 }), 1);

    useCartStore.getState().setQuantity("1:11", 3);

    const lines = useCartStore.getState().lines;
    expect(lines.find((line) => line.key === "1:11")?.quantity).toBe(3);
    expect(lines.find((line) => line.key === "1:12")?.quantity).toBe(1);
  });

  it("ignores an unknown key", () => {
    useCartStore.getState().add(makeProduct(), null, 2);
    useCartStore.getState().setQuantity("does-not-exist", 5);

    expect(useCartStore.getState().lines).toHaveLength(1);
    expect(useCartStore.getState().lines[0].quantity).toBe(2);
  });
});

describe("guest cart: remove and clear", () => {
  it("removes one line by key", () => {
    const product = makeProduct();
    useCartStore.getState().add(product, makeVariant({ id: 11 }));
    useCartStore.getState().add(product, makeVariant({ id: 12 }));

    useCartStore.getState().remove("1:11");

    const { lines } = useCartStore.getState();
    expect(lines).toHaveLength(1);
    expect(lines[0].key).toBe("1:12");
  });

  it("ignores an unknown key", () => {
    useCartStore.getState().add(makeProduct(), null);
    useCartStore.getState().remove("nope");

    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  it("clears every line", () => {
    const product = makeProduct();
    useCartStore.getState().add(product, null);
    useCartStore.getState().add(product, makeVariant());

    useCartStore.getState().clear();

    expect(useCartStore.getState().lines).toEqual([]);
  });
});

describe("guest cart persistence", () => {
  it("writes the cart to localStorage under the documented key", () => {
    useCartStore.getState().add(makeProduct(), null, 2);

    const raw = localStorage.getItem("shalvarsara.cart");
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw as string) as { state: { lines: { key: string; quantity: number }[] } };
    expect(persisted.state.lines[0]).toMatchObject({ key: "1:0", quantity: 2 });
  });
});
