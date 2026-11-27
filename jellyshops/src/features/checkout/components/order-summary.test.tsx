import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DiscountPreview } from "@/features/commerce/api/types";
import { OrderSummary } from "./order-summary";

vi.mock("@/lib/product-media", () => ({ cartProductImage: () => "" }));

const line = { item: { variantId: "v", quantity: 2 }, product: { id: "p", name: "Shirt", options: [] }, variant: { id: "v", name: "Default", priceMinor: 2500 }, lineMinor: 5000 } as never;
const preview: DiscountPreview = {
  code: "TENOFF", label: "£10.00 off the whole order", subtotalMinor: 5000, discountMinor: 1500, shippingMinor: 0, totalMinor: 3500, currency: "GBP",
  discounts: [
    { title: "Summer sale", code: null, type: "product_amount", label: "10% off all products", amountMinor: 500, shippingMinor: 0 },
    { title: "TENOFF", code: "TENOFF", type: "order_amount", label: "£10.00 off the whole order", amountMinor: 1000, shippingMinor: 0 },
    { title: "Free delivery", code: null, type: "free_shipping", label: "Free shipping", amountMinor: 0, shippingMinor: 495 },
  ],
};

function show(applied: DiscountPreview | null) {
  render(<OrderSummary lines={[line]} currency="GBP" estimatedSubtotal={5000} estimatedShipping={495} delivery discount={{ applied, pending: false, error: "", editable: true, onApply: async () => true, onRemove: () => undefined }} />);
  return within(screen.getByRole("complementary"));
}

describe("order summary discounts", () => {
  it("lists each discount, the free delivery and what the shopper saves", () => {
    const summary = show(preview);
    expect(summary.getByText("Summer sale", { selector: "dt" }).nextSibling).toHaveTextContent("−£5.00");
    expect(summary.getByText(/· TENOFF/, { selector: "dt span" })).toBeInTheDocument();
    expect(summary.getByText("Delivery").nextSibling).toHaveTextContent("£4.95 Free");
    expect(summary.getByText("You save").nextSibling).toHaveTextContent("£19.95");
    // Total = 50.00 - 15.00 + free delivery.
    expect(summary.getByText("Total").nextSibling).toHaveTextContent("£35.00");
  });

  it("shows the typed code as a removable tag and automatic discounts as plain tags", () => {
    const summary = show(preview);
    expect(summary.getByRole("button", { name: "Remove discount code TENOFF" })).toBeInTheDocument();
    expect(summary.getByText("Summer sale", { selector: "b" })).toBeInTheDocument();
    expect(summary.queryByRole("button", { name: /Remove discount code Summer/ })).not.toBeInTheDocument();
  });

  it("shows plain totals without discounts", () => {
    const summary = show(null);
    expect(summary.queryByText("You save")).not.toBeInTheDocument();
    expect(summary.getByText("Total").nextSibling).toHaveTextContent("£54.95");
  });
});
