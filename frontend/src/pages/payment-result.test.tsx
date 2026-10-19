import { screen, waitFor } from "@testing-library/react";

import { PaymentResultPage } from "@/pages/payment-result";
import { orderService } from "@/services/orders";
import { renderWithProviders } from "@/test/utils";
import type { Order } from "@/types/api";

vi.mock("@/services/orders", () => ({
  orderService: {
    get: vi.fn(),
    list: vi.fn(),
    preview: vi.fn(),
    create: vi.fn(),
  },
}));

const getMock = vi.mocked(orderService.get);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 42,
    code: "SS-1042",
    shippingAddress: {
      receiverName: "حسین جعفری",
      phone: "09123456789",
      province: "تهران",
      city: "تهران",
      postalCode: "1234567890",
      line1: "خیابان ولیعصر، پلاک ۱",
    },
    status: "paid",
    subtotal: 2_500_000,
    discount: 0,
    shippingCost: 0,
    total: 2_500_000,
    note: "",
    items: [
      {
        id: 10,
        slug: "jeans-men",
        title: "شلوار جین مردانه",
        variantLabel: "۳۲ / آبی",
        imageUrl: "/products/jeans.webp",
        unitPrice: 2_500_000,
        quantity: 1,
        lineTotal: 2_500_000,
      },
    ],
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  getMock.mockReset();
  getMock.mockResolvedValue(makeOrder());
  sessionStorage.clear();
});

describe("PaymentResultPage: the success path", () => {
  it("reports success for an order the warehouse has already moved to processing", async () => {
    // The regression: `status === "paid"` alone showed the failure screen for a
    // customer whose payment had in fact gone through.
    getMock.mockResolvedValue(makeOrder({ status: "processing" }));

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    expect(await screen.findByText("پرداخت با موفقیت انجام شد")).toBeInTheDocument();
    expect(screen.queryByText("پرداخت انجام نشد")).not.toBeInTheDocument();
  });

  it.each(["paid", "processing", "shipped", "delivered"] as const)(
    "reports success for the captured status %s",
    async (status) => {
      getMock.mockResolvedValue(makeOrder({ status }));

      renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

      expect(await screen.findByText("پرداخت با موفقیت انجام شد")).toBeInTheDocument();
    },
  );

  it("shows the receipt for a successful payment", async () => {
    getMock.mockResolvedValue(makeOrder({ status: "shipped" }));

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    expect(await screen.findByText("پرداخت با موفقیت انجام شد")).toBeInTheDocument();
    expect(screen.getByText("SS-1042")).toBeInTheDocument();
    expect(screen.getByText("مبلغ پرداخت‌شده")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "پیگیری سفارش" })).toHaveAttribute("href", "/account/orders");
  });
});

describe("PaymentResultPage: the failure paths", () => {
  it("reports failure for a canceled order and mentions the cancellation", async () => {
    getMock.mockResolvedValue(makeOrder({ status: "canceled" }));

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    expect(await screen.findByText("پرداخت انجام نشد")).toBeInTheDocument();
    expect(screen.queryByText("پرداخت با موفقیت انجام شد")).not.toBeInTheDocument();

    // The cancellation wording, so the customer knows a refund is automatic.
    const description = screen.getByText(/این سفارش لغو شده است/);
    expect(description).toHaveTextContent("لغو");
    expect(description).toHaveTextContent("بازگردانده");
  });

  it("reports failure for an order still awaiting payment", async () => {
    getMock.mockResolvedValue(makeOrder({ status: "pending" }));

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    expect(await screen.findByText("پرداخت انجام نشد")).toBeInTheDocument();
    expect(screen.getByText(/پرداخت این سفارش تکمیل نشده است/)).toBeInTheDocument();
  });

  it("says there is no order to show when the return URL carries no order id", async () => {
    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?status=ok" });

    expect(await screen.findByText("سفارشی برای نمایش نیست")).toBeInTheDocument();
    expect(screen.queryByText("پرداخت انجام نشد")).not.toBeInTheDocument();
    // No id means no request: the query is disabled.
    expect(getMock).not.toHaveBeenCalled();
  });

  it("treats a non-numeric order id as no id at all", async () => {
    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=abc&status=ok" });

    expect(await screen.findByText("سفارشی برای نمایش نیست")).toBeInTheDocument();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("shows the gateway-error screen when the status is error", async () => {
    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=error" });

    expect(await screen.findByText("تراکنش پیدا نشد")).toBeInTheDocument();
    // The error screen replaces the whole result body, whatever the order says.
    expect(screen.queryByText("پرداخت با موفقیت انجام شد")).not.toBeInTheDocument();
    expect(screen.queryByText("پرداخت انجام نشد")).not.toBeInTheDocument();
  });

  it("still renders the gateway-error screen when the order request fails", async () => {
    getMock.mockRejectedValue(new Error("boom"));

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=error" });

    expect(await screen.findByText("تراکنش پیدا نشد")).toBeInTheDocument();
  });

  it("reports an unreadable order without claiming the payment failed outright", async () => {
    getMock.mockRejectedValue(new Error("ارتباط با سرور برقرار نشد."));

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    expect(await screen.findByText("پرداخت انجام نشد")).toBeInTheDocument();
    expect(screen.getByText(/وضعیت این سفارش قابل خواندن نبود/)).toBeInTheDocument();
  });
});

describe("PaymentResultPage: reading the order", () => {
  it("requests the order named in the return URL", async () => {
    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    await screen.findByText("پرداخت با موفقیت انجام شد");
    expect(getMock).toHaveBeenCalledWith(42, expect.anything());
  });

  it("shows a loading state before the order arrives", () => {
    // Never settles, so the page stays in its loading branch.
    getMock.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    expect(screen.getByText("در حال دریافت وضعیت سفارش…")).toBeInTheDocument();
    expect(screen.queryByText("پرداخت انجام نشد")).not.toBeInTheDocument();
  });

  it("renders the sandbox badge from the remembered payment session", async () => {
    sessionStorage.setItem(
      "shalvarsara.lastPayment",
      JSON.stringify({ paymentId: 7, orderId: 42, orderCode: "SS-1042", authority: "A", amountRial: 1, sandbox: true }),
    );

    renderWithProviders(<PaymentResultPage />, { route: "/payment/result?order=42&status=ok" });

    await waitFor(() => expect(screen.getByText("پرداخت آزمایشی (سندباکس زرین‌پال)")).toBeInTheDocument());
  });
});
