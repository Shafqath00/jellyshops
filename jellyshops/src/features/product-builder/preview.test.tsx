import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ConfiguredOptionSelection, ProductOption } from "@/lib/domain";
import { newChoice, withAddedValues, withKind } from "./choices";
import { emptyDraft, withOptions, type ProductDraft } from "./draft";
import { BuyerPreview } from "./BuyerPreview";
import { computePreview, draftToProduct, pruneSelections, toggleSelection } from "./preview";

const choice = (name: string, values: string, kind: ProductOption["type"] = "variant", extra: Partial<ProductOption> = {}): ProductOption =>
  ({ ...withAddedValues(newChoice(0, kind), values), name, ...extra });
const pick = (option: ProductOption, label: string): ConfiguredOptionSelection => ({ optionId: option.id, valueId: option.values.find((v) => v.label === label)!.id });

function tee(extra: ProductOption[] = []) {
  const size = choice("Size", "S, M");
  const colour = choice("Colour", "Black, White");
  const draft = withOptions({ ...emptyDraft, title: "Tee", price: "500", stock: "5" }, [size, colour, ...extra]).draft;
  return { size, colour, draft };
}
const setVariant = (draft: ProductDraft, name: string, patch: Partial<ProductDraft["variants"][number]>) => ({ ...draft, variants: draft.variants.map((v) => v.name === name ? { ...v, ...patch } : v) });

describe("preview logic", () => {
  it("maps a draft onto a storefront product and drops half-finished choices", () => {
    const { draft } = tee([choice("", "A"), choice("Empty", "")]);
    const product = draftToProduct(draft);
    expect(product.options?.map((o) => o.name)).toEqual(["Size", "Colour"]);
    expect(product.inventoryOptionIds).toHaveLength(2);
    expect(product.variants).toHaveLength(4);
    expect(draftToProduct({ ...emptyDraft, price: "10", stock: "1" }).variants).toHaveLength(1);
  });

  it("shows the lowest price and asks for required choices until the combination is complete", () => {
    const { draft, size, colour } = tee();
    const priced = setVariant(draft, "M / White", { priceMinor: 70000 });
    const product = draftToProduct(priced);
    const none = computePreview(product, []);
    expect(none).toMatchObject({ priceMinor: 50000, fromPrice: true, availability: "Choose the required options", variant: undefined });
    expect(none.problems.map((p) => p.code)).toEqual(["required", "required"]);
    const half = computePreview(product, [pick(size, "M")]);
    expect(half).toMatchObject({ priceMinor: 50000, fromPrice: true });
    const full = computePreview(product, [pick(size, "M"), pick(colour, "White")]);
    expect(full).toMatchObject({ priceMinor: 70000, fromPrice: false, availability: "5 available", problems: [] });
  });

  it("adds price changes from price-only choices and extras, including several extras", () => {
    const material = choice("Material", "Cotton, Linen", "configuration", { required: true });
    material.values[1].priceAdjustmentMinor = 5000;
    const extras = choice("Extras", "Wrap, Card", "addon", { multiple: true });
    extras.values[0].priceAdjustmentMinor = 1500;
    extras.values[1].priceAdjustmentMinor = 500;
    const { draft, size, colour } = tee([material, extras]);
    const product = draftToProduct(draft);
    const base = [pick(size, "S"), pick(colour, "Black")];
    expect(computePreview(product, [...base, pick(material, "Linen")]).priceMinor).toBe(55000);
    expect(computePreview(product, [...base, pick(material, "Linen"), pick(extras, "Wrap"), pick(extras, "Card")]).priceMinor).toBe(57000);
    expect(computePreview(product, base).problems.map((p) => p.optionId)).toEqual([material.id]);
  });

  it("reports sold-out combinations and marks the values that lead only to them", () => {
    const { draft, size, colour } = tee();
    const product = draftToProduct(setVariant(draft, "M / White", { stock: 0 }));
    const state = computePreview(product, [pick(size, "M"), pick(colour, "White")]);
    expect(state).toMatchObject({ soldOut: true, availability: "Out of stock" });
    const onlyM = computePreview(product, [pick(size, "M")]);
    expect(onlyM.valueStatus(colour.id, colour.values[1].id)).toBe("sold-out");
    expect(onlyM.valueStatus(colour.id, colour.values[0].id)).toBe("available");
    expect(computePreview(product, [pick(size, "S")]).valueStatus(colour.id, colour.values[1].id)).toBe("available");
  });

  it("treats a missing combination as unavailable and unlimited stock as in stock", () => {
    const { draft, size, colour } = tee();
    const gone = { ...draft, variants: draft.variants.filter((v) => v.name !== "S / White") };
    const product = draftToProduct(gone);
    const state = computePreview(product, [pick(size, "S"), pick(colour, "White")]);
    expect(state.availability).toBe("This combination is unavailable");
    expect(state.valueStatus(colour.id, colour.values[1].id)).toBe("unavailable");
    const unlimited = draftToProduct(setVariant(draft, "S / Black", { stock: Number.MAX_SAFE_INTEGER }));
    expect(computePreview(unlimited, [pick(size, "S"), pick(colour, "Black")])).toMatchObject({ availability: "In stock", soldOut: false });
  });

  it("shows the original price only when it is higher, for simple products", () => {
    const base = { ...emptyDraft, price: "100", stock: "2" };
    expect(computePreview(draftToProduct({ ...base, compareAtPrice: "150" }), []).compareAtMinor).toBe(15000);
    expect(computePreview(draftToProduct({ ...base, compareAtPrice: "50" }), []).compareAtMinor).toBeUndefined();
  });

  it("hides choices whose condition is not met", () => {
    const size = choice("Size", "Single, King");
    const long = choice("Extra long", "Yes", "configuration", { visibleWhen: { optionId: size.id, valueIds: [size.values[1].id] } });
    const product = draftToProduct(withOptions({ ...emptyDraft, price: "1", stock: "1" }, [size, long]).draft);
    expect(computePreview(product, []).visible.has(long.id)).toBe(false);
    expect(computePreview(product, [pick(size, "King")]).visible.has(long.id)).toBe(true);
  });

  it("toggles picks: single replaces, optional can be cleared, required cannot, multi respects the maximum", () => {
    const size = choice("Size", "S, M");
    const gift = choice("Gift", "Wrap, Card", "addon", { multiple: true, maxSelect: 1 });
    const note = choice("Note", "A, B", "configuration");
    expect(toggleSelection(size, [pick(size, "S")], size.values[1].id)).toEqual([pick(size, "M")]);
    expect(toggleSelection(size, [pick(size, "S")], size.values[0].id)).toEqual([pick(size, "S")]);
    expect(toggleSelection(note, [pick(note, "A")], note.values[0].id)).toEqual([]);
    expect(toggleSelection(gift, [pick(gift, "Wrap")], gift.values[1].id)).toEqual([pick(gift, "Wrap")]);
    expect(toggleSelection(gift, [pick(gift, "Wrap")], gift.values[0].id)).toEqual([]);
  });

  it("forgets picks whose value was deleted while previewing", () => {
    const size = choice("Size", "S, M");
    const stale = [pick(size, "S"), { optionId: size.id, valueId: "gone" }, { optionId: "ghost", valueId: "x" }];
    expect(pruneSelections([size], stale)).toEqual([pick(size, "S")]);
  });
});

describe("BuyerPreview", () => {
  const shirt = () => tee().draft;
  it("explains missing required choices only after the shopper tries to add to cart", async () => {
    const user = userEvent.setup();
    render(<BuyerPreview draft={shirt()} currency="INR" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("preview-availability")).toHaveTextContent("Choose the required options");
    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Please choose a Size.", "Please choose a Colour."]);
    await user.click(screen.getByRole("radio", { name: "S" }));
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual(["Please choose a Colour."]);
  });

  it("adds to cart with the exact total once everything required is picked", async () => {
    const user = userEvent.setup();
    const extras = choice("Extras", "Wrap", "addon", { multiple: true });
    extras.values[0].priceAdjustmentMinor = 2500;
    const { draft } = tee([extras]);
    render(<BuyerPreview draft={draft} currency="INR" />);
    await user.click(screen.getByRole("radio", { name: "S" }));
    await user.click(screen.getByRole("radio", { name: "Black" }));
    expect(screen.getByText("₹500.00")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: /Wrap/ }));
    expect(screen.getByText("₹525.00")).toBeVisible();
    expect(screen.getByTestId("preview-availability")).toHaveTextContent("5 available");
    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByText("Added to cart. Total ₹525.00")).toBeVisible();
    expect(screen.getByText(/isn.t live in your store yet/)).toBeVisible();
  });

  it("disables the button for a sold-out combination and says so", async () => {
    const user = userEvent.setup();
    render(<BuyerPreview draft={setVariant(shirt(), "M / White", { stock: 0 })} currency="INR" />);
    await user.click(screen.getByRole("radio", { name: "M" }));
    await user.click(screen.getByRole("radio", { name: "White" }));
    expect(screen.getByRole("button", { name: "Sold out" })).toBeDisabled();
    expect(screen.getByTestId("preview-availability")).toHaveTextContent("Out of stock");
  });

  it("renders dropdown choices and honours optional ones", async () => {
    const user = userEvent.setup();
    const finish = choice("Finish", "Matte, Gloss", "configuration", { required: false, display: "dropdown" });
    const draft = withOptions({ ...emptyDraft, title: "Frame", price: "10", stock: "3" }, [finish]).draft;
    render(<BuyerPreview draft={draft} currency="INR" />);
    const select = screen.getByRole("combobox", { name: /Finish/ });
    expect(within(select).getByRole("option", { name: "None" })).toBeVisible();
    await user.selectOptions(select, "Gloss");
    expect(select).toHaveValue(finish.values[1].id);
    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(await screen.findByText("Added to cart. Total ₹10.00")).toBeVisible();
  });

  it("keeps working while the seller edits: a removed value is forgotten", async () => {
    const user = userEvent.setup();
    const draft = shirt();
    const { rerender } = render(<BuyerPreview draft={draft} currency="INR" />);
    await user.click(screen.getByRole("radio", { name: "S" }));
    const without = withOptions(draft, draft.options.map((o) => o.name === "Size" ? { ...o, values: o.values.filter((v) => v.label !== "S") } : o)).draft;
    rerender(<BuyerPreview draft={without} currency="INR" />);
    expect(screen.queryByRole("radio", { name: "S" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toContain("Please choose a Size.");
  });

  it("a stock-tracked choice never offers multi-pick even if flagged", () => {
    const flagged = withKind(choice("Size", "S, M", "configuration", { multiple: true }), "variant");
    const draft = withOptions({ ...emptyDraft, price: "1", stock: "1" }, [flagged]).draft;
    render(<BuyerPreview draft={draft} currency="INR" />);
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
