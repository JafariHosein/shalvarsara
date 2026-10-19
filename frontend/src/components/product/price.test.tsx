import { render, screen } from "@testing-library/react";

import { DiscountChip, Price } from "@/components/product/price";
import { formatToman } from "@/lib/format";

describe("Price", () => {
  it("renders the Toman amount with Persian digits", () => {
    render(<Price price={250_000} />);

    expect(screen.getByText("۲۵۰٬۰۰۰ تومان")).toBeInTheDocument();
  });

  it("shows only the final price when there is no discount", () => {
    render(<Price price={250_000} discountPrice={null} />);

    expect(screen.getByText(formatToman(250_000))).toBeInTheDocument();
    expect(document.querySelector(".line-through")).toBeNull();
  });

  it("ignores a discount that is not actually lower", () => {
    const { container } = render(<Price price={250_000} discountPrice={250_000} />);

    expect(container.querySelectorAll(".line-through")).toHaveLength(0);
    expect(screen.getByText("۲۵۰٬۰۰۰ تومان")).toBeInTheDocument();
  });

  it("ignores a zero discount", () => {
    const { container } = render(<Price price={250_000} discountPrice={0} />);

    expect(container.querySelectorAll(".line-through")).toHaveLength(0);
  });

  it("strikes through the original price and shows the discounted amount", () => {
    const { container } = render(<Price price={250_000} discountPrice={200_000} />);

    const struck = container.querySelector(".line-through");
    expect(struck).not.toBeNull();
    expect(struck).toHaveTextContent("۲۵۰٬۰۰۰ تومان");

    // The payable amount is the visible, non-struck value.
    expect(screen.getByText("۲۰۰٬۰۰۰ تومان")).toBeInTheDocument();
  });

  it("hides the struck-through price from screen readers but exposes it in text", () => {
    const { container } = render(<Price price={250_000} discountPrice={200_000} />);

    expect(container.querySelector(".line-through")).toHaveAttribute("aria-hidden", "true");

    // The accessible alternative carries the same information in Persian.
    const srOnly = container.querySelector(".sr-only");
    expect(srOnly).toHaveTextContent("قیمت پیش از تخفیف");
    expect(srOnly).toHaveTextContent("۲۵۰٬۰۰۰ تومان");
  });

  it.each([
    ["sm", "text-sm"],
    ["md", "text-base"],
    ["lg", "text-2xl"],
  ] as const)("applies the %s size to the final price", (size, expectedClass) => {
    render(<Price price={1_000} size={size} />);
    expect(screen.getByText("۱٬۰۰۰ تومان")).toHaveClass(expectedClass);
  });

  it("merges a custom className", () => {
    const { container } = render(<Price price={1_000} className="custom-price" />);
    expect(container.firstElementChild).toHaveClass("custom-price");
  });
});

describe("DiscountChip", () => {
  it("renders a Persian percentage", () => {
    render(<DiscountChip percent={30} />);
    expect(screen.getByText("۳۰٪")).toBeInTheDocument();
  });

  it("renders nothing when there is no discount", () => {
    const { container } = render(<DiscountChip percent={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a negative percentage", () => {
    const { container } = render(<DiscountChip percent={-5} />);
    expect(container).toBeEmptyDOMElement();
  });
});
