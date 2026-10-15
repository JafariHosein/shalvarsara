import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { CART_QUERY_KEY } from "@/lib/cart-cache";
import { cartService } from "@/services/cart";
import { useIsAuthenticated } from "@/store/auth-store";
import { useCartStore, type CartLine } from "@/store/cart-store";
import type { CartItem, Product, ProductVariant, ServerCart } from "@/types/api";

/** Server line -> the shape the storefront renders. */
function toCartLine(item: CartItem): CartLine {
  return {
    key: `server:${item.id}`,
    serverId: item.id,
    productId: item.productId,
    variantId: item.variantId,
    slug: item.slug,
    title: item.title,
    image: item.image,
    unitPrice: item.unitPrice,
    size: item.size || undefined,
    color: item.color || undefined,
    quantity: item.quantity,
    maxQuantity: item.maxQuantity,
    isAvailable: item.isAvailable,
  };
}

/** Recompute a cart after one line's quantity changed optimistically. */
function withQuantity(cart: ServerCart, id: number, quantity: number): ServerCart {
  const items = cart.items.map((item) =>
    item.id === id ? { ...item, quantity, lineTotal: item.unitPrice * quantity } : item,
  );
  return {
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce((sum, item) => sum + item.lineTotal, 0),
  };
}

export interface UseCart {
  lines: CartLine[];
  /** Total number of pieces, not the number of lines. */
  count: number;
  subtotal: number;
  /** True while the signed-in cart is being fetched for the first time. */
  isLoading: boolean;
  add: (product: Product, variant: ProductVariant | null, quantity?: number) => void;
  remove: (line: CartLine) => void;
  setQuantity: (line: CartLine, quantity: number) => void;
  clear: () => void;
}

/**
 * The cart, whichever side owns it.
 *
 * Guests get a store persisted in the browser; signed-in users get the server
 * cart, which is handed over at sign-in by `syncGuestCart`. Components never
 * need to know which one is active.
 */
export function useCart(): UseCart {
  const queryClient = useQueryClient();
  const isAuthenticated = useIsAuthenticated();

  const guestLines = useCartStore((state) => state.lines);
  const guestAdd = useCartStore((state) => state.add);
  const guestRemove = useCartStore((state) => state.remove);
  const guestSetQuantity = useCartStore((state) => state.setQuantity);
  const guestClear = useCartStore((state) => state.clear);

  const serverCart = useQuery({
    queryKey: CART_QUERY_KEY,
    queryFn: ({ signal }) => cartService.get(signal),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });

  // Every endpoint returns the whole cart, so the cache is replaced rather than
  // invalidated: no follow-up request and no flash of empty cart.
  const storeCart = (cart: ServerCart) => queryClient.setQueryData(CART_QUERY_KEY, cart);

  const onError = (error: unknown) => toast.error(errorMessage(error));

  const addMutation = useMutation({
    mutationFn: (payload: { productId: number; variantId: number | null; quantity: number }) =>
      cartService.addItem(payload),
    onSuccess: storeCart,
    onError,
  });

  // Optimistic: the stepper must react on the first click, and a second rapid
  // click has to build on the value the user already sees.
  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; quantity: number }) =>
      cartService.updateItem(payload.id, payload.quantity),
    onMutate: async ({ id, quantity }) => {
      await queryClient.cancelQueries({ queryKey: CART_QUERY_KEY });
      const previous = queryClient.getQueryData<ServerCart>(CART_QUERY_KEY);
      if (previous) queryClient.setQueryData(CART_QUERY_KEY, withQuantity(previous, id, quantity));
      return { previous };
    },
    onError: (error, _payload, context) => {
      if (context?.previous) queryClient.setQueryData(CART_QUERY_KEY, context.previous);
      onError(error);
    },
    onSuccess: storeCart,
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) => cartService.removeItem(id),
    onSuccess: storeCart,
    onError,
  });

  const clearMutation = useMutation({
    mutationFn: () => cartService.clear(),
    onSuccess: storeCart,
    onError,
  });

  // Until the merge response lands the guest lines are still what the visitor
  // sees, which keeps the badge from blinking to zero during sign-in.
  const lines = isAuthenticated && serverCart.data ? serverCart.data.items.map(toCartLine) : guestLines;

  return {
    lines,
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    isLoading: isAuthenticated && serverCart.isLoading,

    add: (product, variant, quantity = 1) => {
      if (isAuthenticated) {
        addMutation.mutate({ productId: product.id, variantId: variant?.id ?? null, quantity });
        return;
      }
      guestAdd(product, variant, quantity);
    },

    remove: (line) => {
      if (line.serverId != null) removeMutation.mutate(line.serverId);
      else guestRemove(line.key);
    },

    setQuantity: (line, quantity) => {
      const next = Math.max(1, quantity);
      if (line.serverId != null) updateMutation.mutate({ id: line.serverId, quantity: next });
      else guestSetQuantity(line.key, next);
    },

    clear: () => {
      if (isAuthenticated) clearMutation.mutate();
      else guestClear();
    },
  };
}
