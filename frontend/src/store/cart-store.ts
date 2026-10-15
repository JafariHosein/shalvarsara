import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Product, ProductVariant } from "@/types/api";
import { finalPrice, primaryImage } from "@/types/api";

/** One line in the cart. `key` identifies a product+variant combination. */
export interface CartLine {
  key: string;
  /** Set only for lines that live on the server; absent in the guest cart. */
  serverId?: number;
  productId: number;
  variantId: number | null;
  slug: string;
  title: string;
  image: string;
  unitPrice: number;
  size?: string;
  color?: string;
  quantity: number;
  /** Stock available for this line, used to clamp the quantity stepper. */
  maxQuantity: number;
  /** False once the product is delisted or out of stock. */
  isAvailable: boolean;
}

interface CartState {
  lines: CartLine[];
  add: (product: Product, variant: ProductVariant | null, quantity?: number) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
}

export function lineKey(productId: number, variantId: number | null): string {
  return `${productId}:${variantId ?? 0}`;
}

/**
 * Guest cart, persisted to localStorage.
 *
 * This is only the pre-login cart. Once the visitor signs in, `syncGuestCart`
 * hands these lines to the server and clears them; from then on the server cart
 * is authoritative and the UI reads it through `useCart`.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],

      add: (product, variant, quantity = 1) =>
        set((state) => {
          const key = lineKey(product.id, variant?.id ?? null);
          const maxQuantity = Math.max(
            1,
            variant ? variant.stock : product.stock,
          );
          const existing = state.lines.find((line) => line.key === key);

          if (existing) {
            return {
              lines: state.lines.map((line) =>
                line.key === key
                  ? { ...line, quantity: Math.min(line.quantity + quantity, line.maxQuantity) }
                  : line,
              ),
            };
          }

          const line: CartLine = {
            key,
            productId: product.id,
            variantId: variant?.id ?? null,
            slug: product.slug,
            title: product.title,
            image: primaryImage(product),
            unitPrice: finalPrice(product) + (variant?.extraPrice ?? 0),
            size: variant?.size,
            color: variant?.color,
            quantity: Math.min(quantity, maxQuantity),
            maxQuantity,
            isAvailable: true,
          };
          return { lines: [...state.lines, line] };
        }),

      remove: (key) => set((state) => ({ lines: state.lines.filter((line) => line.key !== key) })),

      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines.flatMap((line) => {
            if (line.key !== key) return [line];
            const clamped = Math.min(Math.max(1, quantity), line.maxQuantity);
            return [{ ...line, quantity: clamped }];
          }),
        })),

      clear: () => set({ lines: [] }),
    }),
    {
      name: "shalvarsara.cart",
      version: 2,
      // v1 stored lines before the availability flag existed; treat those as
      // available rather than dropping the visitor's cart.
      migrate: (persisted, version) => {
        const state = persisted as { lines?: CartLine[] } | undefined;
        if (version < 2 && state?.lines) {
          return { ...state, lines: state.lines.map((line) => ({ ...line, isAvailable: true })) };
        }
        return persisted as CartState;
      },
    },
  ),
);
