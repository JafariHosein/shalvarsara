/** Shared API types, mirroring the Go models. */

export type Role = "customer" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  user: User;
  tokens: TokenPair;
}

/**
 * The answer to a sign-up code request. `code` is only present while the API
 * runs without an SMS panel (`SMS_TEST_MODE`), which is why the sign-up page
 * shows it on screen.
 */
export interface RegisterCodeResponse {
  phone: string;
  expiresInSeconds: number;
  testMode: boolean;
  code?: string;
  message: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  parentId?: number;
  sortOrder: number;
}

export interface CategoryWithCount extends Category {
  productCount: number;
}

export interface ProductImage {
  id: number;
  productId: number;
  url: string;
  alt: string;
  isPrimary: boolean;
  sortOrder: number;
}

export interface ProductVariant {
  id: number;
  productId: number;
  size: string;
  color: string;
  colorHex: string;
  stock: number;
  sku: string;
  extraPrice: number;
}

export interface Product {
  id: number;
  title: string;
  slug: string;
  shortDesc: string;
  description: string;
  categoryId: number;
  category?: Category;
  brand: string;
  gender: string;
  pantType: string;
  fabric: string;
  price: number;
  discountPrice?: number | null;
  stock: number;
  sku: string;
  ratingAvg: number;
  ratingCount: number;
  soldCount: number;
  isActive: boolean;
  isFeatured: boolean;
  images: ProductImage[];
  variants: ProductVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Address {
  id: number;
  userId: number;
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line1: string;
  line2: string;
  /** Map pin, when the customer picked one. Both are set or both are absent. */
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

/** One line of the server-side cart. */
export interface CartItem {
  id: number;
  productId: number;
  variantId: number | null;
  slug: string;
  title: string;
  image: string;
  /** Discounted price plus the variant surcharge, in Toman. */
  unitPrice: number;
  /** Struck-through original price, in Toman. */
  listPrice: number;
  size: string;
  color: string;
  quantity: number;
  /** Live stock for this line; 0 when the product is no longer on sale. */
  maxQuantity: number;
  lineTotal: number;
  isAvailable: boolean;
}

/** The authoritative cart of a signed-in user. */
export interface ServerCart {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}

/** Result of handing a guest cart over to an account at sign-in. */
export interface MergeCartResult {
  cart: ServerCart;
  /** Guest lines that were delisted or out of stock and could not be kept. */
  skipped: number;
}

// --------------------------------------------------------------- orders ----

export type OrderStatus = "pending" | "paid" | "processing" | "shipped" | "delivered" | "canceled";

/** Customer-facing label for every order status. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "در انتظار پرداخت",
  paid: "پرداخت‌شده",
  processing: "در حال آماده‌سازی",
  shipped: "ارسال‌شده",
  delivered: "تحویل‌شده",
  canceled: "لغو‌شده",
};

/**
 * Statuses that mean the money was captured: the order is at `paid` or beyond.
 *
 * Anything that asks "did this order go through?" must use this list rather
 * than comparing against `paid`, otherwise a customer who returns to the result
 * page after the warehouse moved their order to `processing` is told the
 * payment failed.
 */
export const PAID_ORDER_STATUSES: readonly OrderStatus[] = ["paid", "processing", "shipped", "delivered"];

/** True when `status` means the order has been paid for. */
export function isPaidOrderStatus(status: OrderStatus | undefined): boolean {
  return status !== undefined && PAID_ORDER_STATUSES.includes(status);
}

/** The shipping details copied onto an order when it is placed. */
export interface ShippingAddress {
  receiverName: string;
  phone: string;
  province: string;
  city: string;
  postalCode: string;
  line1: string;
}

/** One line of a placed order. Prices are snapshots, not live product data. */
export interface OrderItem {
  id: number;
  productId?: number;
  variantId?: number | null;
  slug: string;
  title: string;
  variantLabel: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export type PaymentStatus = "initiated" | "verified" | "failed";

/** How an order left the warehouse: one per order, written by the admin. */
export interface Shipment {
  carrier: string;
  trackingCode: string;
  status: string;
  shippedAt?: string;
  deliveredAt?: string;
}

/** One gateway attempt for an order. */
export interface Payment {
  id: number;
  orderId: number;
  gateway: string;
  authority?: string;
  refId?: string;
  /** Rial, exactly as sent to the gateway. */
  amount: number;
  status: PaymentStatus;
  cardPan?: string;
  message?: string;
  createdAt: string;
}

/** A placed order with its lines and, once started, its latest payment. */
export interface Order {
  id: number;
  code: string;
  userId?: number;
  shippingAddress: ShippingAddress;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  couponCode?: string;
  note: string;
  items: OrderItem[];
  payment?: Payment;
  shipment?: Shipment;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** One line of a checkout preview: what the order would store, plus live stock. */
export interface OrderPreviewItem {
  productId: number;
  variantId: number | null;
  slug: string;
  title: string;
  variantLabel: string;
  imageUrl: string;
  unitPrice: number;
  quantity: number;
  maxQuantity: number;
  lineTotal: number;
  isAvailable: boolean;
}

/** The server's priced view of the current cart. */
export interface OrderPreview {
  items: OrderPreviewItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  couponCode?: string;
  /** Subtotal at or above which delivery is free, in Toman. */
  freeFrom: number;
  hasUnavailable: boolean;
}

/** What the storefront needs to hand a customer to the gateway. */
export interface PaymentStart {
  paymentId: number;
  orderId: number;
  orderCode: string;
  authority: string;
  gatewayUrl: string;
  amountRial: number;
  sandbox: boolean;
}

/** Product list query parameters accepted by GET /products. */
export interface ProductQuery {
  q?: string;
  category?: string;
  categoryId?: number;
  size?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  featured?: boolean;
  gender?: string;
  pantType?: string;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export type ProductSort = "newest" | "cheapest" | "expensive" | "popular" | "discount" | "rating";

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: "جدیدترین",
  cheapest: "ارزان‌ترین",
  expensive: "گران‌ترین",
  popular: "پرفروش‌ترین",
  discount: "بیشترین تخفیف",
  rating: "بهترین امتیاز",
};

/** Resolve the price a customer actually pays. */
export function finalPrice(product: Pick<Product, "price" | "discountPrice">): number {
  return product.discountPrice != null && product.discountPrice < product.price
    ? product.discountPrice
    : product.price;
}

/** Percentage off, or 0 when there is no discount. */
export function discountPercent(product: Pick<Product, "price" | "discountPrice">): number {
  if (product.discountPrice == null || product.discountPrice >= product.price || product.price === 0) return 0;
  return Math.round(((product.price - product.discountPrice) * 100) / product.price);
}

/** Primary image URL, with a fallback for products that have none. */
export function primaryImage(product: Pick<Product, "images">): string {
  return product.images.find((image) => image.isPrimary)?.url ?? product.images[0]?.url ?? "";
}

/** Distinct sizes across a product's variants, in the order they are stored. */
export function variantSizes(product: Pick<Product, "variants">): string[] {
  return Array.from(new Set(product.variants.map((variant) => variant.size)));
}

/** Distinct colours across a product's variants. */
export function variantColors(
  product: Pick<Product, "variants">,
): { color: string; colorHex: string; stock: number }[] {
  const map = new Map<string, { color: string; colorHex: string; stock: number }>();
  for (const variant of product.variants) {
    const existing = map.get(variant.color);
    if (existing) existing.stock += variant.stock;
    else map.set(variant.color, { color: variant.color, colorHex: variant.colorHex, stock: variant.stock });
  }
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Reviews and wishlist
// ---------------------------------------------------------------------------

export type ReviewStatus = "pending" | "approved" | "rejected";

/** A review as its author sees it (the storefront view hides the id/status). */
export interface Review {
  id: number;
  productId: number;
  userId: number;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

/** A published review, exactly as the product page renders it. */
export interface ProductReview {
  id: number;
  rating: number;
  comment: string;
  /** Shortened display name ("حسین ج."). */
  author: string;
  createdAt: string;
}

/** The rating breakdown drawn above the review list. `stars[i]` counts (i+1)-star reviews. */
export interface ReviewSummary {
  average: number;
  count: number;
  stars: number[];
}

/** `GET /products/:slug/reviews` */
export interface ProductReviews {
  summary: ReviewSummary;
  reviews: Page<ProductReview>;
}

/** `GET /products/:slug/reviews/mine` — may I review it, and did I already? */
export interface MyReview {
  canReview: boolean;
  review?: Review;
}

/** One saved product, complete enough for the ordinary product card. */
export interface WishlistEntry {
  product: Product;
  addedAt: string;
}

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
};

// ---------------------------------------------------------------------------
// Admin panel
// ---------------------------------------------------------------------------

/** A discount code. `amount` is a percentage for `percent` and Toman for `fixed`. */
export interface Coupon {
  id: number;
  code: string;
  type: "percent" | "fixed";
  amount: number;
  minOrder: number;
  maxUses: number;
  usedCount: number;
  expiresAt?: string | null;
  isActive: boolean;
}

/** The writable surface of a product; every field is optional (PATCH). */
export interface AdminProductInput {
  title?: string;
  slug?: string;
  shortDesc?: string;
  description?: string;
  categoryId?: number;
  brand?: string;
  gender?: string;
  pantType?: string;
  fabric?: string;
  price?: number;
  /** 0 clears the discount. */
  discountPrice?: number;
  stock?: number;
  sku?: string;
  isActive?: boolean;
  isFeatured?: boolean;
}

/**
 * A size/colour combination as sent to the admin API.
 *
 * Every field is optional on the wire: PATCH only writes what it is given, so
 * a partial update (the image manager's "make primary" button, for instance)
 * cannot zero the columns it did not mention. Create sends them all.
 */
export interface AdminVariantInput {
  size?: string;
  color?: string;
  colorHex?: string;
  stock?: number;
  sku?: string;
  extraPrice?: number;
}

/** One gallery image. Optional for the same reason as {@link AdminVariantInput}. */
export interface AdminImageInput {
  url?: string;
  alt?: string;
  isPrimary?: boolean;
  sortOrder?: number;
}

export interface AdminCategoryInput {
  name: string;
  slug?: string;
  parentId?: number | null;
  sortOrder: number;
}

/** One row of the admin order table: the order plus who placed it. */
export interface AdminOrderSummary {
  order: Order;
  userId?: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemsCount: number;
  carrier?: string;
  trackingCode?: string;
}

/** A user row with the totals the admin table shows. */
export interface AdminUserRow {
  user: User;
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
}

/** One row of the admin transactions table: a gateway attempt plus its order. */
export interface AdminPaymentRow {
  payment: Payment;
  orderCode: string;
  userId?: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  /** Persian label for `payment.status`, already resolved by the backend. */
  statusFa: string;
}

export interface BestSeller {
  productId?: number;
  title: string;
  slug: string;
  quantity: number;
  revenue: number;
}

export interface SalesPoint {
  /** Gregorian `YYYY-MM-DD`; the UI localizes it. */
  date: string;
  orders: number;
  revenue: number;
}

export interface AdminStats {
  revenue: number;
  orderCount: number;
  pending: number;
  toFulfill: number;
  shipped: number;
  delivered: number;
  canceled: number;
  products: number;
  activeProducts: number;
  variants: number;
  lowStock: number;
  users: number;
  activeCoupons: number;
  avgOrder: number;
  topSellers: BestSeller[];
  recentOrders: AdminOrderSummary[];
  sales: SalesPoint[];
}

/** Admin query parameters. */
export interface AdminProductQuery {
  q?: string;
  categoryId?: number;
  active?: "true" | "false" | "all";
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

export interface AdminOrderQuery {
  q?: string;
  status?: OrderStatus | "all";
  page?: number;
  limit?: number;
}

export interface AdminUserQuery {
  q?: string;
  role?: Role | "all";
  page?: number;
  limit?: number;
}

export interface AdminPaymentQuery {
  q?: string;
  status?: PaymentStatus | "all";
  page?: number;
  limit?: number;
}

/** One row of the review-moderation table: the review plus its product and author. */
export interface AdminReviewRow {
  review: Review;
  productTitle: string;
  productSlug: string;
  author: string;
  email: string;
}

export interface AdminReviewQuery {
  q?: string;
  status?: ReviewStatus | "all";
  page?: number;
  limit?: number;
}

/** The order statuses an admin may move an order to, and the actions' labels. */
export const ORDER_NEXT_STEPS: Record<OrderStatus, { status: OrderStatus; label: string }[]> = {
  pending: [
    { status: "paid", label: "ثبت پرداخت دستی" },
    { status: "canceled", label: "لغو سفارش" },
  ],
  paid: [
    { status: "processing", label: "شروع آماده‌سازی" },
    { status: "canceled", label: "لغو سفارش" },
  ],
  processing: [
    { status: "shipped", label: "ثبت ارسال" },
    { status: "canceled", label: "لغو سفارش" },
  ],
  shipped: [{ status: "delivered", label: "ثبت تحویل" }],
  delivered: [],
  canceled: [],
};

