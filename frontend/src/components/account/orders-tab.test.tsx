import { fireEvent, screen, waitFor } from "@testing-library/react";

import { OrdersTab } from "@/components/account/orders-tab";
import { orderService } from "@/services/orders";
import { renderWithProviders } from "@/test/utils";
import type { Order, Page } from "@/types/api";

/**
 * A component that fetches its own data: the account page's order list.
 *
 * The service module is mocked rather than `fetch` so the test is about the
 * component's three states (loading skeleton, error, rendered rows) and not
 * about the HTTP client, which has its own contract.
 */
vi.mock("@/services/orders", () => ({
  orderService: {
    list: vi.fn(),
    get: vi.fn(),
    preview: vi.fn(),
    create: vi.fn(),
  },
}));

const listMock = vi.mocked(orderService.list);

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 1,
    code: "SS-1001",
    shippingAddress: {
      receiverName: "حسین جعفری",
      phone: "09123456789",
      province: "تهران",
      city: "تهران",
      postalCode: "1234567890",
      line1: "خیابان ولیعصر، پلاک ۱",
    },
    status: "paid",
    subtotal: 500_000,
    discount: 0,
    shippingCost: 0,
    total: 500_000,
    note: "",
    items: [
      {
        id: 10,
        slug: "jeans-men",
        title: "شلوار جین مردانه",
        variantLabel: "۳۲ / آبی",
        imageUrl: "/products/jeans.webp",
        unitPrice: 500_000,
        quantity: 1,
        lineTotal: 500_000,
      },
    ],
    createdAt: "2026-10-01T10:00:00Z",
    updatedAt: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

function page(items: Order[]): Page<Order> {
  return { items, page: 1, limit: 10, total: items.length, totalPages: 1 };
}

beforeEach(() => {
  listMock.mockReset();
});

describe("OrdersTab", () => {
  it("shows a skeleton row per placeholder while the list loads", async () => {
    // A promise that never settles keeps the component in its loading state.
    listMock.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithProviders(<OrdersTab />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3);
    expect(screen.queryByText("هنوز سفارشی ثبت نکرده‌اید")).not.toBeInTheDocument();
  });

  it("renders the orders once they arrive", async () => {
    listMock.mockResolvedValue(page([makeOrder({ code: "SS-1001" }), makeOrder({ id: 2, code: "SS-1002" })]));

    const { container } = renderWithProviders(<OrdersTab />);

    expect(await screen.findByText("SS-1001")).toBeInTheDocument();
    expect(screen.getByText("SS-1002")).toBeInTheDocument();
    // The loading skeleton is gone.
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(0);
  });

  it("renders the order total and status in Persian", async () => {
    listMock.mockResolvedValue(page([makeOrder()]));

    renderWithProviders(<OrdersTab />);

    expect(await screen.findByText("۵۰۰٬۰۰۰ تومان")).toBeInTheDocument();
    expect(screen.getByText("پرداخت‌شده")).toBeInTheDocument();
  });

  it("shows the empty state when the customer has no orders", async () => {
    listMock.mockResolvedValue(page([]));

    renderWithProviders(<OrdersTab />);

    expect(await screen.findByText("هنوز سفارشی ثبت نکرده‌اید")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "مشاهده محصولات" })).toHaveAttribute("href", "/products");
  });

  it("shows the error message and a retry button when the request fails", async () => {
    listMock.mockRejectedValue(new Error("ارتباط با سرور برقرار نشد."));

    renderWithProviders(<OrdersTab />);

    expect(await screen.findByText("ارتباط با سرور برقرار نشد.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تلاش دوباره" })).toBeInTheDocument();
    // A failed fetch must not be mistaken for an empty order history.
    expect(screen.queryByText("هنوز سفارشی ثبت نکرده‌اید")).not.toBeInTheDocument();
  });

  it("retries the request when the retry button is pressed", async () => {
    listMock.mockRejectedValueOnce(new Error("خطای موقت"));
    listMock.mockResolvedValueOnce(page([makeOrder({ code: "SS-2002" })]));

    const { queryClient } = renderWithProviders(<OrdersTab />);

    const retry = await screen.findByRole("button", { name: "تلاش دوباره" });
    fireEvent.click(retry);

    expect(await screen.findByText("SS-2002")).toBeInTheDocument();
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
    queryClient.clear();
  });
});
