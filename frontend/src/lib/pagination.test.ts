import { groupDigits, pageWindow } from "@/lib/pagination";

describe("pageWindow", () => {
  it("lists every page when there are few of them", () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("handles a single page", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
  });

  it("handles zero pages", () => {
    expect(pageWindow(1, 0)).toEqual([]);
  });

  it("shows no gaps on the first page of a long list", () => {
    // current - 1 is 0 and is dropped; first / current / current+1 / last remain.
    expect(pageWindow(1, 20)).toEqual([1, 2, "gap", 20]);
  });

  it("collapses the middle of a long list", () => {
    expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
  });

  it("collapses the end of a long list", () => {
    expect(pageWindow(20, 20)).toEqual([1, "gap", 19, 20]);
  });

  it("never emits a gap adjacent to another gap or next to a consecutive page", () => {
    for (let current = 1; current <= 30; current += 1) {
      const window = pageWindow(current, 30);
      for (let index = 1; index < window.length; index += 1) {
        if (window[index] === "gap") {
          expect(window[index - 1]).not.toBe("gap");
          expect(index).toBeLessThan(window.length - 1);
          expect(window[index + 1]).not.toBe("gap");
        }
      }
    }
  });

  it("keeps the window small no matter how long the list is", () => {
    const window = pageWindow(500, 1_000);
    expect(window.filter((entry) => entry !== "gap").length).toBeLessThanOrEqual(5);
  });

  it("clamps a current page outside the range to the real pages", () => {
    // Out-of-range neighbours are filtered out; only 1 and total survive.
    expect(pageWindow(0, 20)).toEqual([1, "gap", 20]);
    expect(pageWindow(25, 20)).toEqual([1, "gap", 20]);
  });

  it("returns ascending pages", () => {
    const numbers = pageWindow(7, 20).filter((entry): entry is number => entry !== "gap");
    expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
  });
});

describe("groupDigits", () => {
  it("inserts a separator every three digits", () => {
    expect(groupDigits("890000")).toBe("890,000");
    expect(groupDigits("1234567")).toBe("1,234,567");
  });

  it("leaves short values alone", () => {
    expect(groupDigits("1")).toBe("1");
    expect(groupDigits("999")).toBe("999");
  });

  it("accepts Persian digits and normalises them to Latin", () => {
    expect(groupDigits("۸۹۰۰۰۰")).toBe("890,000");
    expect(groupDigits("۱۲۳۴")).toBe("1,234");
  });

  it("drops existing separators and other non-digit characters", () => {
    expect(groupDigits("1,234,567")).toBe("1,234,567");
    expect(groupDigits("abc123def456")).toBe("123,456");
  });

  it("returns an empty string when there is nothing numeric", () => {
    expect(groupDigits("")).toBe("");
    expect(groupDigits("abc")).toBe("");
  });

  it("drops a leading zero so it cannot become a group of its own", () => {
    expect(groupDigits("007")).toBe("7");
    expect(groupDigits("000")).toBe("0");
  });

  it("is idempotent", () => {
    const once = groupDigits("1234567");
    expect(groupDigits(once)).toBe(once);
  });
});
