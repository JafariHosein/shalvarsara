import { lazy } from "react";
import { Route, Routes } from "react-router-dom";

import { SiteLayout } from "@/components/layout/site-layout";
import { ProtectedRoute } from "@/components/common/protected-route";
import { HomePage } from "@/pages/home";

// The entry point stays in the main bundle; every other screen is fetched on
// demand, so first paint is not blocked by the account or admin code.
const ProductsPage = lazy(() => import("@/pages/products").then((m) => ({ default: m.ProductsPage })));
const ProductDetailPage = lazy(() =>
  import("@/pages/product-detail").then((m) => ({ default: m.ProductDetailPage })),
);
const CartPage = lazy(() => import("@/pages/cart").then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import("@/pages/checkout").then((m) => ({ default: m.CheckoutPage })));
const PaymentResultPage = lazy(() =>
  import("@/pages/payment-result").then((m) => ({ default: m.PaymentResultPage })),
);
const LoginPage = lazy(() => import("@/pages/login").then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import("@/pages/register").then((m) => ({ default: m.RegisterPage })));
const AccountPage = lazy(() => import("@/pages/account").then((m) => ({ default: m.AccountPage })));
const AdminLayout = lazy(() => import("@/pages/admin/layout").then((m) => ({ default: m.AdminLayout })));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard").then((m) => ({ default: m.AdminDashboard })));
const AdminProducts = lazy(() => import("@/pages/admin/products").then((m) => ({ default: m.AdminProducts })));
const AdminProductForm = lazy(() =>
  import("@/pages/admin/product-form").then((m) => ({ default: m.AdminProductForm })),
);
const AdminCategories = lazy(() => import("@/pages/admin/categories").then((m) => ({ default: m.AdminCategories })));
const AdminOrders = lazy(() => import("@/pages/admin/orders").then((m) => ({ default: m.AdminOrders })));
const AdminOrderDetail = lazy(() =>
  import("@/pages/admin/order-detail").then((m) => ({ default: m.AdminOrderDetail })),
);
const AdminUsers = lazy(() => import("@/pages/admin/users").then((m) => ({ default: m.AdminUsers })));
const AdminCoupons = lazy(() => import("@/pages/admin/coupons").then((m) => ({ default: m.AdminCoupons })));
const NotFoundPage = lazy(() => import("@/pages/not-found").then((m) => ({ default: m.NotFoundPage })));

/** Application routes. `SiteLayout` owns the Suspense boundary for lazy pages. */
export function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:slug" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* Checkout and the gateway result both need the customer's session:
            the order they read back is scoped to the signed-in account. */}
        <Route
          path="checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="payment/result"
          element={
            <ProtectedRoute>
              <PaymentResultPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />

        {/* Deep links used by the footer and the user menu: both tab routes
            render the same dashboard with the matching tab selected. */}
        <Route
          path="account/orders"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="account/addresses"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />

        {/* The management panel: one guard, a shared shell, and a screen per
            section. Every child is fetched on demand. */}
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/new" element={<AdminProductForm />} />
          <Route path="products/:id" element={<AdminProductForm />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="coupons" element={<AdminCoupons />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
