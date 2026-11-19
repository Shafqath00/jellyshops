import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { getBlockDefinition, getSectionDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { CommerceDataProvider, PublicProduct, StorefrontCartAccess } from "./types";

afterEach(cleanup);

const sizes = (prefix: string, prices: number[], soldOut: string[] = []) => ({
  optionName: "Size",
  values: ["Single", "Double", "King", "Super King"].map((label, index) => ({ variantId: `${prefix}-${label}`, label, price: `£${prices[index]}.00`, max: soldOut.includes(label) ? 0 : 5 })),
});
const mattress: PublicProduct = { id: "m1", name: "Hollis mattress", href: "/demo/products/hollis", imageUrl: "https://example.com/m.jpg", price: "£249.00", setChoices: sizes("m1", [249, 324, 374, 436], ["Super King"]) };
const headboard: PublicProduct = { id: "h1", name: "Arlo headboard", href: "/demo/products/arlo", imageUrl: "https://example.com/h.jpg", price: "£129.00", setChoices: sizes("h1", [129, 168, 194, 226]) };
const engraved: PublicProduct = { id: "e1", name: "Engraved sign", href: "/demo/products/sign", imageUrl: "", price: "£20.00" };
const otherBed: PublicProduct = { id: "b2", name: "Wren bed", href: "/demo/products/wren", imageUrl: "", price: "£399.00" };

const presentation = (chosen?: string) => ({
  product: { id: "b1", title: "Calder bed", description: "", imageUrl: "", media: [], options: [{ id: "size", name: "Size", required: true, values: ["Single", "Double", "King", "Super King"].map((label) => ({ id: label, label, selected: label === chosen, available: true })) }] },
  pricing: { price: "£449.00" }, availability: { state: "available", message: "In stock" }, options: [], selection: [], quantity: 1,
  setQuantity: () => undefined, selectOption: () => undefined, addToCart: async () => ({ ok: true }), canAddToCart: true,
  relatedProducts: [otherBed], pairedProducts: [mattress, headboard, engraved],
});
const page = (chosen?: string) => ({ pageType: "product", resource: { type: "product", id: "b1", handle: "calder", visible: true, data: { title: "Calder bed", productPresentation: presentation(chosen) } } });

function cartStub(): StorefrontCartAccess & { lines: Map<string, number> } {
  const lines = new Map<string, number>();
  return { lines, quantity: (id) => lines.get(id) ?? 0, setQuantity: vi.fn(async (id: string, quantity: number) => { lines.set(id, quantity); return { ok: true }; }) };
}
const block = (settings: Record<string, unknown> = {}): BlockNode => ({ id: "set", type: "complementary-products", enabled: true, settings: { ...structuredClone(getBlockDefinition("complementary-products")!.defaultSettings), ...settings } });
const section = (blocks: BlockNode[]): SectionNode => ({ id: "main", type: "main-product", enabled: true, settings: structuredClone(getSectionDefinition("main-product")!.defaultSettings), blocks });
const draw = (blocks: BlockNode[], options: { cart?: StorefrontCartAccess; chosen?: string; mode?: "published" | "editor" } = {}) => {
  const commerce = { getProducts: async () => [], cart: options.cart } as unknown as CommerceDataProvider;
  return render(<RegistrySectionRenderer section={section(blocks)} mode={options.mode ?? "published"} commerce={commerce} page={page(options.chosen) as never} storeSlug="demo" />).container;
};

describe("Complete the set", () => {
  it("new blocks suggest products from other collections with Add buttons; the settings validate", () => {
    expect(getBlockDefinition("complementary-products")!.defaultSettings).toMatchObject({ heading: "Complete the set", source: "pairs", addToBag: true, matchSize: true });
    expect(validateSectionAgainstRegistry(section([block()]), "product")).toEqual([]);
    expect(validateSectionAgainstRegistry(section([block({ source: "everything" })]), "product")).not.toEqual([]);
  });

  it("starts each size on the size chosen for this product and skips sold-out sizes", () => {
    draw([block()], { cart: cartStub(), chosen: "King" });
    expect(screen.getByRole("heading", { name: "Complete the set" })).toBeTruthy();
    const mattressSize = screen.getByLabelText("Size for Hollis mattress") as HTMLSelectElement;
    expect(mattressSize.selectedOptions[0].textContent).toBe("King");
    expect(screen.getByRole("option", { name: "Super King (sold out)" })).toHaveProperty("disabled", true);
    // The row shows the price of the chosen size.
    expect(document.querySelectorAll(".jelly-complementary-price")[0].textContent).toBe("£374.00");
  });

  it("adds the chosen size to the bag and says so; products needing other choices link to their page", async () => {
    const cart = cartStub();
    const user = userEvent.setup();
    const changed = vi.fn();
    window.addEventListener("jelly:cart-changed", changed);
    draw([block()], { cart, chosen: "Double" });
    await user.selectOptions(screen.getByLabelText("Size for Arlo headboard"), "h1-King");
    await user.click(screen.getByRole("button", { name: "Add Arlo headboard, King to your bag" }));
    await waitFor(() => expect(cart.lines.get("h1-King")).toBe(1));
    expect(screen.getByText("Added King to your bag.")).toBeTruthy();
    expect(changed).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Choose options: Engraved sign" }).getAttribute("href")).toBe("/demo/products/sign");
    window.removeEventListener("jelly:cart-changed", changed);
  });

  it("keeps the old look for blocks saved before these options, and the editor cannot add", () => {
    const container = draw([{ id: "old", type: "complementary-products", enabled: true, settings: { heading: "Pairs well with", limit: 3 } }], { cart: cartStub() });
    expect([...container.querySelectorAll(".jelly-complementary-name")].map((item) => item.textContent)).toEqual(["Wren bed"]);
    expect(container.querySelector(".jelly-complementary-add")).toBeNull();
    cleanup();
    draw([block()], { cart: cartStub(), mode: "editor" });
    expect((screen.getAllByRole("button", { name: /^Add / })[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it("has no accessibility problems", async () => {
    const container = draw([block()], { cart: cartStub(), chosen: "King" });
    const result = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe("Complete the set follows the product's size", () => {
  it("moves to the new size when the shopper changes this product's size, until they pick one in the row", async () => {
    const commerce = { getProducts: async () => [], cart: cartStub() } as unknown as CommerceDataProvider;
    const view = (chosen: string) => <RegistrySectionRenderer section={section([block()])} mode="published" commerce={commerce} page={page(chosen) as never} storeSlug="demo" />;
    const { rerender } = render(view("Double"));
    expect((screen.getByLabelText("Size for Hollis mattress") as HTMLSelectElement).selectedOptions[0].textContent).toBe("Double");
    rerender(view("King"));
    expect((screen.getByLabelText("Size for Hollis mattress") as HTMLSelectElement).selectedOptions[0].textContent).toBe("King");
    await userEvent.setup().selectOptions(screen.getByLabelText("Size for Hollis mattress"), "m1-Single");
    rerender(view("Double"));
    expect((screen.getByLabelText("Size for Hollis mattress") as HTMLSelectElement).selectedOptions[0].textContent).toBe("Single");
  });
});
