import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { productReadiness } from "./readiness";
import { ReadinessCard } from "./readiness-card";

const draft = (overrides: Record<string, unknown> = {}) => ({
  title: "Oak bed", description: "A solid oak bed frame with a slatted base.", imageUrl: "", media: [{ id: "m1" }], price: "499", stock: "4", trackInventory: true, options: [], published: false, archived: false, seoTitle: "", seoDescription: "", ...overrides,
}) as unknown as Parameters<typeof productReadiness>[0];
const state = (overrides: Record<string, unknown> = {}) => { const result = productReadiness(draft(overrides)); return { ...result, missing: result.items.filter((item) => !item.done).map((item) => item.id) }; };

describe("productReadiness", () => {
  it("is complete when name, price, photo, description and stock are there", () => {
    expect(state()).toMatchObject({ ready: true, done: 6, total: 6, missing: [], summary: "Ready to publish." });
    expect(state({ published: true }).summary).toBe("Live and complete.");
  });

  it("needs a name and a price before publishing, and says so", () => {
    expect(state({ title: "  ", price: "0" })).toMatchObject({ ready: false, missing: ["title", "price"], summary: "Add name and price before you publish." });
    expect(state({ price: "abc" }).missing).toEqual(["price"]);
  });

  it("recommends a photo, a description and stock without blocking", () => {
    expect(state({ media: [], imageUrl: "", description: "Nice.", stock: "0" })).toMatchObject({ ready: true, missing: ["photo", "description", "stock"], summary: "Ready to publish. A few things could make it sell better." });
    expect(state({ stock: "", trackInventory: false }).missing).toEqual([]);
    expect(state({ media: undefined, imageUrl: "https://x/y.jpg" }).missing).toEqual([]);
  });

  it("looks at every combination when the product has options", () => {
    const options = [{ id: "size", name: "Size", type: "variant", values: [] }];
    expect(state({ options, price: "", stock: "", variants: [{ priceMinor: 100, stock: 0 }, { priceMinor: 0, stock: 0 }] }).missing).toEqual(["price", "stock"]);
    expect(state({ options, price: "", stock: "", variants: [{ priceMinor: 100, stock: 0 }, { priceMinor: 200, stock: 3 }] }).missing).toEqual([]);
  });

  it("flags a search title or description that is too long, and archived products", () => {
    const long = state({ seoTitle: "x".repeat(71) });
    expect(long.missing).toEqual(["search"]);
    expect(long.items.find((item) => item.id === "search")!.hint).toBe("The search title is 71 characters. Keep it to 70.");
    expect(state({ seoDescription: "x".repeat(161) }).items.find((item) => item.id === "search")!.hint).toMatch(/161 characters/);
    expect(state({ archived: true }).summary).toBe("Archived. Restore it to sell it again.");
  });
});

describe("ReadinessCard", () => {
  it("lists what is done and what is missing, and takes the keyboard to the missing part", async () => {
    const user = userEvent.setup();
    const { container } = render(<><ReadinessCard readiness={productReadiness(draft({ title: "", media: [] }))} /><input id="pb-title" aria-label="Product name" /></>);
    expect(screen.getByText("4 of 6")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Add name before you publish.");
    expect(screen.getByRole("progressbar", { name: "Product checklist progress" })).toHaveAttribute("value", "4");
    expect(screen.getByText("Products with a photo sell far better. Add at least one.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Go to Name" }));
    expect(screen.getByLabelText("Product name")).toHaveFocus();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
