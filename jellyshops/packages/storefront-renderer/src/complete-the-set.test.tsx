import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { getBlockDefinition, getSectionDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { CommerceDataProvider, PublicProduct, StorefrontCartAccess } from "./types";

afterEach(cleanup);

const gbp = (minor: number) => `£${(minor / 100).toFixed(2)}`;
const sizes = (prefix: string, prices: number[], soldOut: string[] = [], was?: number[]) => ({
  optionName: "Size",
  values: ["Single", "Double", "King", "Super King"].map((label, index) => ({
    variantId: `${prefix}-${label}`, label, price: gbp(prices[index] * 100), priceMinor: prices[index] * 100, max: soldOut.includes(label) ? 0 : 5,
    ...(was ? { compareAtPriceMinor: was[index] * 100 } : {}),
  })),
});
const mattress: PublicProduct = { id: "m1", name: "Hollis mattress", href: "/demo/products/hollis", imageUrl: "https://example.com/m.jpg", price: "£249.00", setChoices: sizes("m1", [249, 324, 374, 436], ["Super King"], [299, 389, 449, 523]) };
const headboard: PublicProduct = { id: "h1", name: "Arlo headboard", href: "/demo/products/arlo", imageUrl: "https://example.com/h.jpg", price: "£129.00", setChoices: sizes("h1", [129, 168, 194, 226]) };
const engraved: PublicProduct = { id: "e1", name: "Engraved sign", href: "/demo/products/sign", imageUrl: "", price: "£20.00" };
const otherBed: PublicProduct = { id: "b2", name: "Wren bed", href: "/demo/products/wren", imageUrl: "", price: "£399.00" };

function presentation(chosen?: string, addToCart = vi.fn(async () => ({ ok: true }))) {
  return {
    product: { id: "b1", title: "Calder bed", description: "", imageUrl: "", media: [], options: [{ id: "size", name: "Size", required: true, values: ["Single", "Double", "King", "Super King"].map((label) => ({ id: label, label, selected: label === chosen, available: true })) }] },
    pricing: { price: chosen ? "£673.99" : "£448.99", priceMinor: chosen ? 67399 : 44899, compareAtPriceMinor: chosen ? 82399 : undefined, format: gbp },
    availability: { state: chosen ? "available" : "selection-required", message: "" }, options: [], selection: [], quantity: 1,
    setQuantity: () => undefined, selectOption: () => undefined, addToCart, canAddToCart: Boolean(chosen),
    relatedProducts: [otherBed], pairedProducts: [mattress, headboard, engraved],
  };
}
const page = (data: ReturnType<typeof presentation>) => ({ pageType: "product", resource: { type: "product", id: "b1", handle: "calder", visible: true, data: { title: "Calder bed", productPresentation: data } } });
function cartStub(): StorefrontCartAccess & { lines: Map<string, number> } {
  const lines = new Map<string, number>();
  return { lines, quantity: (id) => lines.get(id) ?? 0, setQuantity: vi.fn(async (id: string, quantity: number) => { lines.set(id, quantity); return { ok: true }; }) };
}
const block = (settings: Record<string, unknown> = {}): BlockNode => ({ id: "set", type: "complementary-products", enabled: true, settings: { ...structuredClone(getBlockDefinition("complementary-products")!.defaultSettings), ...settings } });
const part = (type: string, settings: Record<string, unknown> = {}): BlockNode => ({ id: type, type, enabled: true, settings: { ...structuredClone(getBlockDefinition(type)!.defaultSettings), ...settings } });
const section = (blocks: BlockNode[]): SectionNode => ({ id: "main", type: "main-product", enabled: true, settings: structuredClone(getSectionDefinition("main-product")!.defaultSettings), blocks });
const draw = (blocks: BlockNode[], options: { cart?: StorefrontCartAccess; data?: ReturnType<typeof presentation>; mode?: "published" | "editor" } = {}) => {
  const commerce = { getProducts: async () => [], cart: options.cart } as unknown as CommerceDataProvider;
  return render(<RegistrySectionRenderer section={section(blocks)} mode={options.mode ?? "published"} commerce={commerce} page={page(options.data ?? presentation("King")) as never} storeSlug="demo" />).container;
};

describe("Complete the set", () => {
  it("new blocks suggest products from other collections; the settings validate", () => {
    expect(getBlockDefinition("complementary-products")!.defaultSettings).toMatchObject({ heading: "Complete the set", source: "pairs", addToBag: true, matchSize: true });
    expect(validateSectionAgainstRegistry(section([block({ column: "below" })]), "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(section([block({ source: "everything" })]), "product")).not.toEqual([]);
  });

  it("starts each card on the size chosen for this product, with that size's price, and skips sold-out sizes", () => {
    draw([block()]);
    const size = screen.getByLabelText("Size for Hollis mattress") as HTMLSelectElement;
    expect(size.selectedOptions[0].textContent).toBe("King");
    expect(screen.getByRole("option", { name: "Super King (sold out)" })).toHaveProperty("disabled", true);
    const card = size.closest("li")!;
    expect(within(card).getByText("£374.00")).toBeTruthy();
    expect(within(card).getByLabelText("Was £449.00")).toBeTruthy();
  });

  it("ticks build a running total with the saving, and one button adds this product and the ticked items", async () => {
    const cart = cartStub();
    const data = presentation("King");
    const user = userEvent.setup();
    const added = vi.fn();
    window.addEventListener("jelly:cart-added", added);
    draw([block()], { cart, data });
    expect(screen.getByRole("button", { name: "Add 1 item to basket" })).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Add Hollis mattress to my set" }));
    await user.selectOptions(screen.getByLabelText("Size for Arlo headboard"), "h1-Double");
    await user.click(screen.getByRole("checkbox", { name: "Add Arlo headboard to my set" }));
    const summary = document.querySelector(".jelly-set-summary") as HTMLElement;
    expect(within(summary).getByText("Hollis mattress, King")).toBeTruthy();
    expect(within(summary).getByText("Arlo headboard, Double")).toBeTruthy();
    // 673.99 + 374 + 168 = 1215.99; saving: bed 150 + mattress 75.
    expect(within(summary).getByText("£1215.99")).toBeTruthy();
    expect(within(summary).getByText("You save £225.00")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Add 3 items to basket" }));
    await waitFor(() => expect(screen.getByText("Added 3 items to your bag.")).toBeTruthy());
    expect(data.addToCart).toHaveBeenCalledTimes(1);
    expect(cart.lines.get("m1-King")).toBe(1);
    expect(cart.lines.get("h1-Double")).toBe(1);
    expect(added).toHaveBeenCalled();
    window.removeEventListener("jelly:cart-added", added);
  });

  it("without a size chosen for this product, it adds the ticked items only and asks for the size", async () => {
    const cart = cartStub();
    const data = presentation(undefined);
    const user = userEvent.setup();
    draw([block()], { cart, data });
    expect(screen.getByText("Choose a size above")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Tick items to add" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Add Arlo headboard to my set" }));
    await user.click(screen.getByRole("button", { name: "Add 1 item to basket" }));
    await waitFor(() => expect(cart.lines.get("h1-Single")).toBe(1));
    expect(data.addToCart).not.toHaveBeenCalled();
  });

  it("links products that need other choices first, keeps old blocks as links, and the editor cannot add", () => {
    draw([block()]);
    expect(screen.getByRole("link", { name: "Choose options: Engraved sign" }).getAttribute("href")).toBe("/demo/products/sign");
    cleanup();
    const container = draw([{ id: "old", type: "complementary-products", enabled: true, settings: { heading: "Pairs well with", limit: 3 } }], { cart: cartStub() });
    expect([...container.querySelectorAll(".jelly-complementary-name")].map((item) => item.textContent)).toEqual(["Wren bed"]);
    expect(container.querySelector(".jelly-set")).toBeNull();
    cleanup();
    draw([block()], { cart: cartStub(), mode: "editor" });
    expect((screen.getByRole("button", { name: /to basket|Tick items/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("has no accessibility problems", async () => {
    const container = draw([block()], { cart: cartStub() });
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe("Main product: content under the photos", () => {
  it("blocks set to Under the photos go in their own column after the buying panel; the panel stays in view", () => {
    const container = draw([part("part-product-information"), part("part-product-purchase"), block({ column: "below" }), part("part-product-description", { column: "below" }), part("part-product-reviews", { column: "below" })]);
    const main = container.querySelector(".jelly-main-product")!;
    expect(main.hasAttribute("data-has-below")).toBe(true);
    expect(main.getAttribute("data-sticky")).toBe("details");
    const panel = main.querySelector(".jelly-main-product-details")!;
    const below = main.querySelector(".jelly-main-product-below")!;
    expect([...panel.children].map((child) => child.getAttribute("data-part"))).toEqual(["product-information", "product-purchase"]);
    expect([...below.children].map((child) => child.getAttribute("data-part"))).toEqual(["block", "product-description", "product-reviews"]);
    // Reading order on phones: photos, buying panel, then the rest.
    expect([...main.querySelector(".jelly-main-product-grid")!.children].map((child) => child.className)).toEqual(["jelly-main-product-media", "jelly-main-product-details", "jelly-main-product-below"]);
  });

  it("with Keep in view set to Neither, nothing stays in view even with content under the photos", () => {
    const node = section([part("part-product-information"), part("part-product-purchase"), part("part-product-description", { column: "below" })]);
    node.settings = { ...node.settings, stickyColumn: "none" };
    const commerce = { getProducts: async () => [] } as unknown as CommerceDataProvider;
    const { container } = render(<RegistrySectionRenderer section={node} mode="published" commerce={commerce} page={page(presentation("King")) as never} storeSlug="demo" />);
    const main = container.querySelector(".jelly-main-product")!;
    expect(main.hasAttribute("data-has-below")).toBe(true);
    expect(main.getAttribute("data-sticky")).toBe("none");
  });

  it("without such blocks the section is unchanged", () => {
    const container = draw([part("part-product-information"), part("part-product-purchase")]);
    expect(container.querySelector(".jelly-main-product-below")).toBeNull();
    expect(container.querySelector(".jelly-main-product")!.getAttribute("data-sticky")).toBe("media");
  });
});
