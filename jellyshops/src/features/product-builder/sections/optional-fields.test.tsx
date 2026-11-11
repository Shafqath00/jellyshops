import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyDraft } from "../draft";
import { BasicsSection } from "./basics-section";
import { CategorySection } from "./category-section";
import { PricingSection } from "./pricing-section";

describe("optional product details", () => {
  it("keeps optional product details tucked away until requested", () => {
    render(
      <>
        <BasicsSection draft={emptyDraft} errors={{}} hidePhoto onChange={() => {}} />
        <PricingSection draft={emptyDraft} errors={{}} currency="GBP" hasCombinations={false} onChange={() => {}} />
      </>,
    );

    const description = screen.getByLabelText("Description");
    const advancedPricing = screen.getByText("Original price (optional)").closest("details");
    expect(description).toBeVisible();
    expect(advancedPricing).not.toHaveAttribute("open");
  });

  it("opens optional details that already contain saved values", async () => {
    render(
      <>
        <BasicsSection draft={{ ...emptyDraft, description: "Soft cotton, made for everyday." }} errors={{}} hidePhoto onChange={() => {}} />
        <PricingSection draft={{ ...emptyDraft, compareAtPrice: "40", sku: "TEE-01" }} errors={{}} currency="GBP" hasCombinations={false} onChange={() => {}} />
      </>,
    );

    expect(await screen.findByRole("textbox", { name: "Description" })).toHaveTextContent("Soft cotton, made for everyday.");
    expect(screen.getByText("Original price (optional)").closest("details")).toHaveAttribute("open");
  });

  it("explains that category is optional when categories cannot load", () => {
    render(<CategorySection taxonomy={null} loading={false} error="The requested resource was not found" selectedId="" onSelect={() => {}} />);

    expect(screen.getByRole("alert")).toHaveTextContent("You can still save this product without a category.");
  });
});
