import { PAID_ORDER_STATUSES, isPaidOrderStatus } from "@/types/api";
import type { OrderStatus } from "@/types/api";

/**
 * Regression guard for the payment-result page.
 *
 * It used to ask `status === "paid"`, so a customer who came back after the
 * warehouse had already moved their order on to `processing` or `shipped` was
 * shown the failure screen for an order that had in fact been paid for.
 */
describe("isPaidOrderStatus", () => {
  it.each<[OrderStatus, boolean]>([
    ["paid", true],
    ["processing", true],
    ["shipped", true],
    ["delivered", true],
    ["pending", false],
    ["canceled", false],
  ])("returns %s -> %s", (status, expected) => {
    expect(isPaidOrderStatus(status)).toBe(expected);
  });

  it("returns false for undefined, i.e. before the order has loaded", () => {
    expect(isPaidOrderStatus(undefined)).toBe(false);
  });

  it("agrees with the exported status list for every status", () => {
    const all: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "canceled"];
    for (const status of all) {
      expect(isPaidOrderStatus(status)).toBe(PAID_ORDER_STATUSES.includes(status));
    }
  });

  it("keeps the paid list in the order the lifecycle moves through it", () => {
    expect([...PAID_ORDER_STATUSES]).toEqual(["paid", "processing", "shipped", "delivered"]);
  });

  it("never reports a pending or canceled order as paid", () => {
    expect(PAID_ORDER_STATUSES).not.toContain("pending");
    expect(PAID_ORDER_STATUSES).not.toContain("canceled");
  });
});
