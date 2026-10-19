import { render, screen } from "@testing-library/react";

import { EmptyState, EmptyStateLink } from "@/components/common/empty-state";
import { renderWithProviders } from "@/test/utils";

describe("EmptyState", () => {
  it("renders its title", () => {
    renderWithProviders(<EmptyState title="چیزی پیدا نشد" />);

    expect(screen.getByRole("heading", { name: "چیزی پیدا نشد" })).toBeInTheDocument();
  });

  it("renders the description when given", () => {
    renderWithProviders(
      <EmptyState title="سبد خرید خالی است" description="محصولی به سبد اضافه نکرده‌اید." />,
    );

    expect(screen.getByText("محصولی به سبد اضافه نکرده‌اید.")).toBeInTheDocument();
  });

  it("omits the paragraph when there is no description", () => {
    const { container } = renderWithProviders(<EmptyState title="خالی" />);

    expect(container.querySelector("p")).toBeNull();
  });

  it("renders an action passed as a child", () => {
    renderWithProviders(
      <EmptyState title="هنوز سفارشی ثبت نکرده‌اید" description="پس از ثبت سفارش اینجا نمایش داده می‌شود.">
        <EmptyStateLink to="/products">مشاهده محصولات</EmptyStateLink>
      </EmptyState>,
    );

    const link = screen.getByRole("link", { name: "مشاهده محصولات" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/products");
  });

  it("merges a custom className onto the container", () => {
    const { container } = renderWithProviders(<EmptyState title="خالی" className="py-4" />);

    expect(container.firstElementChild).toHaveClass("py-4");
    // The base classes must survive the merge.
    expect(container.firstElementChild).toHaveClass("text-center");
  });

  it("renders without a router only when the caller supplies no links", () => {
    // EmptyState itself has no router dependency; only the link helper does.
    expect(() => render(<EmptyState title="بدون مسیریاب" />)).not.toThrow();
    expect(screen.getByText("بدون مسیریاب")).toBeInTheDocument();
  });
});
