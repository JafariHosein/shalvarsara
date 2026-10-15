import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api";
import { adminService } from "@/services/admin";
import type {
  AdminCategoryInput,
  AdminImageInput,
  AdminOrderQuery,
  AdminPaymentQuery,
  AdminProductInput,
  AdminProductQuery,
  AdminReviewQuery,
  AdminUserQuery,
  AdminVariantInput,
  OrderStatus,
  ReviewStatus,
} from "@/types/api";

const {
  stats,
  products,
  product,
  createProduct,
  updateProduct,
  deleteProduct,
  createVariant,
  updateVariant,
  deleteVariant,
  createImage,
  updateImage,
  deleteImage,
  categories,
  createCategory,
  updateCategory,
  deleteCategory,
  orders,
  order,
  setOrderStatus,
  saveShipment,
  payments,
  users,
  updateUser,
  reviews,
  setReviewStatus,
  coupons,
  createCoupon,
  updateCoupon,
} = adminService;

// ---- queries ----

/** Dashboard numbers. */
export function useAdminStats() {
  return useQuery({
    queryKey: ["admin", "stats"],
    queryFn: ({ signal }) => stats(signal),
    staleTime: 30_000,
  });
}

/** A page of the catalogue, deactivated products included. */
export function useAdminProducts(query: AdminProductQuery) {
  return useQuery({
    queryKey: ["admin", "products", query],
    queryFn: ({ signal }) => products(query, signal),
  });
}

/** One product with its variants and gallery. */
export function useAdminProduct(id: number | undefined) {
  return useQuery({
    queryKey: ["admin", "product", id],
    queryFn: ({ signal }) => product(id as number, signal),
    enabled: typeof id === "number" && id > 0,
  });
}

/** A page of orders. */
export function useAdminOrders(query: AdminOrderQuery) {
  return useQuery({
    queryKey: ["admin", "orders", query],
    queryFn: ({ signal }) => orders(query, signal),
  });
}

/** One order with its lines, payment and shipment. */
export function useAdminOrder(id: number | undefined) {
  return useQuery({
    queryKey: ["admin", "order", id],
    queryFn: ({ signal }) => order(id as number, signal),
    enabled: typeof id === "number" && id > 0,
  });
}

/**
 * A page of gateway attempts for the transactions screen.
 *
 * Refetches whenever the poll tick fires: a payment can be confirmed at the
 * gateway seconds after the customer is sent back, so a cached "در انتظار
 * پرداخت" row would otherwise look stale to the admin.
 */
export function useAdminPayments(query: AdminPaymentQuery) {
  return useQuery({
    queryKey: ["admin", "payments", query],
    queryFn: ({ signal }) => payments(query, signal),
    refetchInterval: 30_000,
  });
}

/** The category list (public endpoint) with product counts. */
export function useAdminCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => categories(signal),
    staleTime: 60_000,
  });
}

/** A page of users with their totals. */
export function useAdminUsers(query: AdminUserQuery) {
  return useQuery({
    queryKey: ["admin", "users", query],
    queryFn: ({ signal }) => users(query, signal),
  });
}

/** A page of coupons. */
export function useAdminCoupons(query: { q?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["admin", "coupons", query],
    queryFn: ({ signal }) => coupons(query, signal),
  });
}

/** A page of the review-moderation queue. */
export function useAdminReviews(query: AdminReviewQuery) {
  return useQuery({
    queryKey: ["admin", "reviews", query],
    queryFn: ({ signal }) => reviews(query, signal),
  });
}

// ---- mutations ----
//
// Mutations that touch a product return the whole product, so the form can
// re-render without a refetch; the catalogue lists are invalidated anyway.

function useInvalidate(keys: string[]) {
  const client = useQueryClient();
  return () => {
    for (const key of keys) void client.invalidateQueries({ queryKey: [key] });
  };
}

/** Every product mutation refreshes the admin list and the storefront lists. */
function useProductMutations() {
  const invalidate = useInvalidate(["admin", "products", "admin", "product", "products", "categories"]);
  return { invalidate };
}

export function useCreateProduct() {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: (body: AdminProductInput) => createProduct(body),
    onSuccess: () => {
      invalidate();
      toast.success("محصول ایجاد شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUpdateProduct(id: number) {
  const invalidate = useInvalidate([
    "admin",
    "products",
    "admin",
    "product",
    "products",
    "categories",
    "admin",
    "stats",
  ]);
  return useMutation({
    mutationFn: (body: AdminProductInput) => updateProduct(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("تغییرات ذخیره شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/**
 * Quick edits from a list row (the active/featured switches). The list refetch
 * is the feedback, so this one stays silent on success.
 */
export function useUpdateProductFlags() {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminProductInput }) => updateProduct(id, body),
    onSuccess: () => invalidate(),
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteProduct() {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      invalidate();
      toast.success("محصول از فهرست فروشگاه برداشته شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useCreateVariant(productId: number) {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: (body: AdminVariantInput) => createVariant(productId, body),
    onSuccess: () => {
      invalidate();
      toast.success("گونه اضافه شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUpdateVariant() {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminVariantInput }) => updateVariant(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("گونه ذخیره شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteVariant() {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: (id: number) => deleteVariant(id),
    onSuccess: () => {
      invalidate();
      toast.success("گونه حذف شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useCreateImage(productId: number) {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: (body: AdminImageInput) => createImage(productId, body),
    onSuccess: () => {
      invalidate();
      toast.success("تصویر اضافه شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUpdateImage() {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminImageInput }) => updateImage(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("تصویر ذخیره شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteImage() {
  const { invalidate } = useProductMutations();
  return useMutation({
    mutationFn: (id: number) => deleteImage(id),
    onSuccess: () => {
      invalidate();
      toast.success("تصویر حذف شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useCreateCategory() {
  const invalidate = useInvalidate(["categories", "admin", "products"]);
  return useMutation({
    mutationFn: (body: AdminCategoryInput) => createCategory(body),
    onSuccess: () => {
      invalidate();
      toast.success("دسته‌بندی ایجاد شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUpdateCategory() {
  const invalidate = useInvalidate(["categories", "admin", "products"]);
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AdminCategoryInput }) => updateCategory(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("دسته‌بندی ذخیره شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useDeleteCategory() {
  const invalidate = useInvalidate(["categories", "admin", "products"]);
  return useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      invalidate();
      toast.success("دسته‌بندی حذف شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useSetOrderStatus() {
  const invalidate = useInvalidate(["admin", "orders", "admin", "order", "admin", "stats"]);
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) => setOrderStatus(id, status),
    onSuccess: (updated) => {
      invalidate();
      toast.success("وضعیت سفارش به‌روز شد.");
      return updated;
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useSaveShipment() {
  const invalidate = useInvalidate(["admin", "orders", "admin", "order", "admin", "stats"]);
  return useMutation({
    mutationFn: ({ id, carrier, trackingCode }: { id: number; carrier: string; trackingCode: string }) =>
      saveShipment(id, { carrier, trackingCode }),
    onSuccess: () => {
      invalidate();
      toast.success("اطلاعات مرسوله ثبت شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUpdateUser() {
  const invalidate = useInvalidate(["admin", "users"]);
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: number;
      body: { isActive?: boolean; role?: "customer" | "admin"; name?: string; phone?: string };
    }) => updateUser(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("کاربر به‌روز شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useCreateCoupon() {
  const invalidate = useInvalidate(["admin", "coupons"]);
  return useMutation({
    mutationFn: (body: Parameters<typeof createCoupon>[0]) => createCoupon(body),
    onSuccess: () => {
      invalidate();
      toast.success("کد تخفیف ساخته شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

export function useUpdateCoupon() {
  const invalidate = useInvalidate(["admin", "coupons"]);
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof updateCoupon>[1] }) => updateCoupon(id, body),
    onSuccess: () => {
      invalidate();
      toast.success("کد تخفیف ذخیره شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/**
 * Approve or reject one review. The response is the review itself, so the toast
 * can name the outcome; moderating also moves the product's public rating, so
 * the storefront caches are refreshed too.
 */
export function useUpdateReviewStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ReviewStatus }) => setReviewStatus(id, status),
    onSuccess: (review) => {
      void client.invalidateQueries({ queryKey: ["admin", "reviews"] });
      void client.invalidateQueries({ queryKey: ["reviews"] });
      void client.invalidateQueries({ queryKey: ["product"] });
      toast.success(review.status === "approved" ? "نظر تأیید و منتشر شد." : "نظر رد شد.");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
