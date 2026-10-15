import { http } from "@/lib/api";
import type {
  AdminCategoryInput,
  AdminImageInput,
  AdminOrderQuery,
  AdminOrderSummary,
  AdminPaymentQuery,
  AdminPaymentRow,
  AdminProductInput,
  AdminProductQuery,
  AdminStats,
  AdminUserQuery,
  AdminUserRow,
  AdminVariantInput,
  Category,
  CategoryWithCount,
  Coupon,
  Order,
  OrderStatus,
  Page,
  Product,
  User,
} from "@/types/api";

/**
 * Every call here goes to /admin and needs an admin token; the backend checks
 * the role on each request, so a revoked admin loses access immediately.
 */
export const adminService = {
  /** GET /admin/stats — dashboard counters, best sellers, recent orders. */
  stats: (signal?: AbortSignal) => http.get<AdminStats>("/admin/stats", { auth: true, signal }),

  // ---- catalogue ----
  /** GET /admin/products — includes deactivated products. */
  products: (query: AdminProductQuery, signal?: AbortSignal) =>
    http.get<Page<Product>>("/admin/products", {
      auth: true,
      signal,
      query: {
        q: query.q,
        categoryId: query.categoryId,
        active: query.active,
        sort: query.sort,
        page: query.page,
        limit: query.limit,
      },
    }),

  /** GET /admin/products/:id — with variants and gallery. */
  product: (id: number, signal?: AbortSignal) =>
    http.get<Product>(`/admin/products/${id}`, { auth: true, signal }),

  /** POST /admin/products */
  createProduct: (body: AdminProductInput) => http.post<Product>("/admin/products", body, { auth: true }),

  /** PATCH /admin/products/:id */
  updateProduct: (id: number, body: AdminProductInput) =>
    http.patch<Product>(`/admin/products/${id}`, body, { auth: true }),

  /** DELETE /admin/products/:id — soft delete. */
  deleteProduct: (id: number) => http.delete<void>(`/admin/products/${id}`, { auth: true }),

  /** POST /admin/products/:id/variants — returns the whole product. */
  createVariant: (productId: number, body: AdminVariantInput) =>
    http.post<Product>(`/admin/products/${productId}/variants`, body, { auth: true }),

  /** PATCH /admin/variants/:id — returns the whole product. */
  updateVariant: (id: number, body: AdminVariantInput) =>
    http.patch<Product>(`/admin/variants/${id}`, body, { auth: true }),

  /** DELETE /admin/variants/:id */
  deleteVariant: (id: number) => http.delete<void>(`/admin/variants/${id}`, { auth: true }),

  /** POST /admin/products/:id/images — returns the whole product. */
  createImage: (productId: number, body: AdminImageInput) =>
    http.post<Product>(`/admin/products/${productId}/images`, body, { auth: true }),

  /** PATCH /admin/images/:id — returns the whole product. */
  updateImage: (id: number, body: AdminImageInput) =>
    http.patch<Product>(`/admin/images/${id}`, body, { auth: true }),

  /** DELETE /admin/images/:id */
  deleteImage: (id: number) => http.delete<void>(`/admin/images/${id}`, { auth: true }),

  // ---- categories ----
  /** GET /categories is public; the admin table reuses it. */
  categories: (signal?: AbortSignal) =>
    http.get<CategoryWithCount[]>("/categories", { signal }),

  /** POST /admin/categories */
  createCategory: (body: AdminCategoryInput) => http.post<Category>("/admin/categories", body, { auth: true }),

  /** PATCH /admin/categories/:id */
  updateCategory: (id: number, body: AdminCategoryInput) =>
    http.patch<Category>(`/admin/categories/${id}`, body, { auth: true }),

  /** DELETE /admin/categories/:id — refused while products still use it. */
  deleteCategory: (id: number) => http.delete<void>(`/admin/categories/${id}`, { auth: true }),

  // ---- orders ----
  /** GET /admin/orders */
  orders: (query: AdminOrderQuery, signal?: AbortSignal) =>
    http.get<Page<AdminOrderSummary>>("/admin/orders", {
      auth: true,
      signal,
      query: { q: query.q, status: query.status, page: query.page, limit: query.limit },
    }),

  /** GET /admin/orders/:id */
  order: (id: number, signal?: AbortSignal) => http.get<Order>(`/admin/orders/${id}`, { auth: true, signal }),

  /** PATCH /admin/orders/:id/status */
  setOrderStatus: (id: number, status: OrderStatus) =>
    http.patch<Order>(`/admin/orders/${id}/status`, { status }, { auth: true }),

  /** POST /admin/orders/:id/shipment */
  saveShipment: (id: number, body: { carrier: string; trackingCode: string }) =>
    http.post<Order>(`/admin/orders/${id}/shipment`, body, { auth: true }),

  // ---- users ----
  /** GET /admin/users */
  users: (query: AdminUserQuery, signal?: AbortSignal) =>
    http.get<Page<AdminUserRow>>("/admin/users", {
      auth: true,
      signal,
      query: { q: query.q, role: query.role, page: query.page, limit: query.limit },
    }),

  /** PATCH /admin/users/:id */
  updateUser: (id: number, body: { isActive?: boolean; role?: "customer" | "admin"; name?: string; phone?: string }) =>
    http.patch<User>(`/admin/users/${id}`, body, { auth: true }),

  // ---- transactions ----
  /**
   * GET /admin/payments — one row per gateway attempt, newest first.
   *
   * `q` matches the order code, the authority or the bank reference id, so a
   * customer calling about a payment can be found by any of the three.
   */
  payments: (query: AdminPaymentQuery, signal?: AbortSignal) =>
    http.get<Page<AdminPaymentRow>>("/admin/payments", {
      auth: true,
      signal,
      query: { q: query.q, status: query.status, page: query.page, limit: query.limit },
    }),

  // ---- coupons ----
  /** GET /admin/coupons */
  coupons: (query: { q?: string; page?: number; limit?: number }, signal?: AbortSignal) =>
    http.get<Page<Coupon>>("/admin/coupons", {
      auth: true,
      signal,
      query: { q: query.q, page: query.page, limit: query.limit },
    }),

  /** POST /admin/coupons */
  createCoupon: (body: {
    code: string;
    type: "percent" | "fixed";
    amount: number;
    minOrder: number;
    maxUses: number;
    isActive: boolean;
    expiresAt?: string | null;
  }) => http.post<Coupon>("/admin/coupons", body, { auth: true }),

  /** PATCH /admin/coupons/:id */
  updateCoupon: (
    id: number,
    body: {
      code?: string;
      type?: "percent" | "fixed";
      amount?: number;
      minOrder?: number;
      maxUses?: number;
      isActive?: boolean;
      expiresAt?: string | null;
      /** Set to remove the expiry date; a null `expiresAt` means "unchanged". */
      clearExpiry?: boolean;
    },
  ) => http.patch<Coupon>(`/admin/coupons/${id}`, body, { auth: true }),
};
