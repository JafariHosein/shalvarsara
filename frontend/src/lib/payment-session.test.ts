import { LAST_PAYMENT_KEY, readLastPayment, writeLastPayment } from "@/lib/payment-session";
import type { PaymentStart } from "@/types/api";

const start: PaymentStart = {
  paymentId: 7,
  orderId: 42,
  orderCode: "SS-1042",
  authority: "AUTH-123",
  gatewayUrl: "https://sandbox.zarinpal.com/pg/StartPay/AUTH-123",
  amountRial: 2_500_000,
  sandbox: true,
};

beforeEach(() => {
  sessionStorage.clear();
});

describe("writeLastPayment", () => {
  it("stores the session under the documented key", () => {
    writeLastPayment(start);

    expect(sessionStorage.getItem(LAST_PAYMENT_KEY)).not.toBeNull();
  });

  it("keeps everything except the gateway URL", () => {
    writeLastPayment(start);

    const stored = JSON.parse(sessionStorage.getItem(LAST_PAYMENT_KEY) as string);
    expect(stored).toEqual({
      paymentId: 7,
      orderId: 42,
      orderCode: "SS-1042",
      authority: "AUTH-123",
      amountRial: 2_500_000,
      sandbox: true,
    });
  });

  it("does not write the gatewayUrl key at all", () => {
    writeLastPayment(start);

    const stored = JSON.parse(sessionStorage.getItem(LAST_PAYMENT_KEY) as string);
    expect(stored).not.toHaveProperty("gatewayUrl");
    expect(Object.keys(stored)).not.toContain("gatewayUrl");
  });

  it("never lets the gateway URL leak into storage, even inside a value", () => {
    writeLastPayment(start);

    // The whole point is that the one-shot payment link is not retained; a
    // substring match catches an accidental re-introduction under another name.
    expect(sessionStorage.getItem(LAST_PAYMENT_KEY)).not.toContain("StartPay");
  });

  it("round-trips through readLastPayment", () => {
    writeLastPayment(start);

    expect(readLastPayment()).toEqual({
      paymentId: 7,
      orderId: 42,
      orderCode: "SS-1042",
      authority: "AUTH-123",
      amountRial: 2_500_000,
      sandbox: true,
    });
  });

  it("overwrites a previous session", () => {
    writeLastPayment(start);
    writeLastPayment({ ...start, paymentId: 8, orderId: 43, orderCode: "SS-1043" });

    expect(readLastPayment()).toMatchObject({ paymentId: 8, orderId: 43 });
  });

  it("does not throw when sessionStorage.setItem throws", () => {
    // Callers write this immediately before `window.location.assign(gatewayUrl)`.
    // A throw here (quota full, storage disabled) would abort the redirect and
    // strand a customer whose order and gateway session already exist.
    //
    // The spy goes on the live instance, not `Storage.prototype`: the test setup
    // installs a spec-shaped `Storage` stand-in because Node 22+ shadows jsdom's
    // global with an unusable one, and the module reads that instance.
    const spy = vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => writeLastPayment(start)).not.toThrow();

    spy.mockRestore();
  });

  it("does not throw when the storage object itself is unavailable", () => {
    const spy = vi.spyOn(sessionStorage, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(() => writeLastPayment(start)).not.toThrow();

    spy.mockRestore();
  });
});

describe("readLastPayment", () => {
  it("returns null when nothing was stored", () => {
    expect(readLastPayment()).toBeNull();
  });

  it("returns null for unparseable JSON", () => {
    sessionStorage.setItem(LAST_PAYMENT_KEY, "{not json");

    expect(readLastPayment()).toBeNull();
  });

  it("returns null for a truncated payload", () => {
    sessionStorage.setItem(LAST_PAYMENT_KEY, '{"orderId":42,');

    expect(readLastPayment()).toBeNull();
  });

  it("returns null when orderId is not a number", () => {
    sessionStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify({ ...start, orderId: "42" }));

    expect(readLastPayment()).toBeNull();
  });

  it("returns null when orderId is missing", () => {
    const { orderId: _orderId, ...withoutId } = start;
    sessionStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(withoutId));

    expect(readLastPayment()).toBeNull();
  });

  it("returns null for JSON that is not an object", () => {
    sessionStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify("just a string"));
    expect(readLastPayment()).toBeNull();

    sessionStorage.setItem(LAST_PAYMENT_KEY, JSON.stringify(null));
    expect(readLastPayment()).toBeNull();
  });

  it("returns null when getItem throws", () => {
    const spy = vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => readLastPayment()).not.toThrow();
    expect(readLastPayment()).toBeNull();

    spy.mockRestore();
  });
});
