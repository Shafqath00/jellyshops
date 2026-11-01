import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { draftToPayload, emptyDraft, productToDraft, validateSimpleDraft, type ProductDraft } from "../draft";
import { PricingSection } from "./pricing-section";

function Harness({ initial }: { initial: ProductDraft }) {
  const [draft, setDraft] = useState(initial);
  return <PricingSection draft={draft} errors={validateSimpleDraft(draft)} currency="GBP" hasCombinations={false} onChange={(field, value) => setDraft((current) => ({ ...current, [field]: value }))} />;
}

describe("cost, profit and unit pricing", () => {
  it("updates profit and margin as price and cost change", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, price: "10" }} />);
    expect(screen.getByLabelText("Profit")).toHaveTextContent("—");
    await user.click(screen.getByText("Cost, profit and unit pricing (optional)"));
    await user.type(screen.getByLabelText(/Cost per item/), "4");
    expect(screen.getByLabelText("Profit")).toHaveTextContent("£6.00");
    expect(screen.getByLabelText("Margin")).toHaveTextContent("60%");
    await user.clear(screen.getByLabelText(/Cost per item/));
    await user.type(screen.getByLabelText(/Cost per item/), "12");
    expect(screen.getByLabelText("Profit")).toHaveTextContent("-£2.00");
    expect(screen.getByLabelText("Margin")).toHaveTextContent("-20%");
  });

  it("previews the shopper's price per unit", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, price: "10" }} />);
    await user.click(screen.getByText("Cost, profit and unit pricing (optional)"));
    await user.type(screen.getByLabelText("Total amount in the product"), "500");
    expect(screen.getByText(/£2\.00 \/ 100 g/)).toBeVisible();
  });

  it("opens the section when saved values exist", () => {
    render(<Harness initial={{ ...emptyDraft, price: "10", cost: "4" }} />);
    expect(screen.getByText("Cost, profit and unit pricing (optional)").closest("details")).toHaveAttribute("open");
  });
});

describe("draft round trip", () => {
  const unitPricing = { totalAmount: "500", totalUnit: "g", baseAmount: "100", baseUnit: "g" };

  it("sends cost in minor units and unit pricing, and null when cleared", () => {
    const payload = draftToPayload({ ...emptyDraft, title: "Tea", price: "10", cost: "4.50", unitPricing }, undefined);
    expect(payload.variants[0]).toMatchObject({ costMinor: 450, unitPricing: { totalAmount: 500, totalUnit: "g", baseAmount: 100, baseUnit: "g" } });
    const cleared = draftToPayload({ ...emptyDraft, title: "Tea", price: "10" }, undefined);
    expect(cleared.variants[0]).toMatchObject({ costMinor: null, unitPricing: null });
  });

  it("restores saved cost and unit pricing when editing", () => {
    const { draft } = productToDraft({ id: "p", slug: "tea", name: "Tea", description: "", imageUrl: "", category: "", published: true, featured: false, variants: [{ id: "v", name: "Standard", sku: "", priceMinor: 1000, costMinor: 450, unitPricing: { totalAmount: 500, totalUnit: "g", baseAmount: 100, baseUnit: "g" }, stock: 3 }] } as never);
    expect(draft.cost).toBe("4.50");
    expect(draft.unitPricing).toEqual(unitPricing);
  });

  it("validates cost and half-filled unit pricing", () => {
    expect(validateSimpleDraft({ ...emptyDraft, title: "T", price: "10", cost: "abc" }).cost).toBeTruthy();
    expect(validateSimpleDraft({ ...emptyDraft, title: "T", price: "10", unitPricing: { ...unitPricing, totalAmount: "" , baseAmount: "50" } }).unitPricing).toBeTruthy();
    expect(validateSimpleDraft({ ...emptyDraft, title: "T", price: "10", cost: "4", unitPricing })).toEqual({});
  });
});

describe("barcode and low stock warning", () => {
  it("shows the stock status and follows the warning level", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, price: "10", stock: "5" }} />);
    expect(screen.getByText("In stock")).toBeVisible();
    await user.type(screen.getByLabelText("Low stock warning at"), "8");
    expect(screen.getByText("Low stock")).toBeVisible();
    await user.clear(screen.getByLabelText("Low stock warning at"));
    await user.type(screen.getByLabelText("Low stock warning at"), "x");
    expect(screen.getByRole("alert")).toHaveTextContent("Use a whole number");
  });

  it("shows out of stock at zero and hides the warning when stock is not tracked", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ ...emptyDraft, price: "10", stock: "0" }} />);
    expect(screen.getByText("Out of stock")).toBeVisible();
    await user.click(screen.getByLabelText("Track stock"));
    expect(screen.queryByLabelText("Low stock warning at")).not.toBeInTheDocument();
    expect(screen.queryByText("Out of stock")).not.toBeInTheDocument();
  });

  it("keeps the barcode with the optional details and opens them when one is saved", () => {
    render(<Harness initial={{ ...emptyDraft, price: "10", barcode: "5012345678900" }} />);
    expect(screen.getByText("Add original price, SKU or barcode (optional)").closest("details")).toHaveAttribute("open");
    expect(screen.getByLabelText(/^Barcode/)).toHaveValue("5012345678900");
  });

  it("sends barcode and threshold, and null when they are cleared", () => {
    const sent = draftToPayload({ ...emptyDraft, title: "Tea", price: "10", barcode: " 5012345678900 ", lowStockThreshold: "6" }, undefined);
    expect(sent.variants[0]).toMatchObject({ barcode: "5012345678900", lowStockThreshold: 6 });
    expect(draftToPayload({ ...emptyDraft, title: "Tea", price: "10" }, undefined).variants[0]).toMatchObject({ barcode: null, lowStockThreshold: null });
  });

  it("restores saved barcode and threshold, and validates them", () => {
    const { draft } = productToDraft({ id: "p", slug: "tea", name: "Tea", description: "", imageUrl: "", category: "", published: true, featured: false, variants: [{ id: "v", name: "Standard", sku: "", priceMinor: 1000, barcode: "123", lowStockThreshold: 0, stock: 3 }] } as never);
    expect(draft).toMatchObject({ barcode: "123", lowStockThreshold: "0" });
    expect(validateSimpleDraft({ ...emptyDraft, title: "T", price: "10", barcode: "x".repeat(65) }).barcode).toBeTruthy();
    expect(validateSimpleDraft({ ...emptyDraft, title: "T", price: "10", lowStockThreshold: "-1" }).lowStockThreshold).toBeTruthy();
    expect(validateSimpleDraft({ ...emptyDraft, title: "T", price: "10", barcode: "123", lowStockThreshold: "0" })).toEqual({});
  });
});
