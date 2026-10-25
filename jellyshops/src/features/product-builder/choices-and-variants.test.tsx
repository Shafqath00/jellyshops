import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import type { Product, ProductOption, ProductVariant } from "@/lib/domain";
import { applyBulk, describeScope } from "./bulk";
import { choiceFromTemplate, moveChoice, newChoice, unusedTemplates, withAddedValues, withKind, withoutValue } from "./choices";
import { draftToPayload, emptyDraft, productToDraft, validateBuilderDraft, withOptions, type ProductDraft } from "./draft";
import { ProductBuilder } from "./ProductBuilder";
import type { Taxonomy, TaxonomyTemplate } from "./taxonomy";

vi.mock("@/features/auth/auth-provider", () => {
  const activeStore = { id: "store-demo", currency: "INR", country: "IN" };
  const session = { access_token: "jelly-demo-merchant" };
  return { useAuth: () => ({ activeStore, session }) };
});
afterEach(() => vi.unstubAllGlobals());

const template = (extra: Partial<TaxonomyTemplate>): TaxonomyTemplate => ({ id: "t", categoryId: "tees", name: "Size", optionKind: "variant", displayType: "buttons", required: true, multiple: false, defaultValues: ["S", "M", "L"], position: 0, ...extra });
const withValues = (option: ProductOption, ...labels: string[]) => labels.reduce((current, label) => withAddedValues(current, label), option);
const named = (option: ProductOption, name: string): ProductOption => ({ ...option, name });

describe("choice helpers", () => {
  it("creates variant choices as required single-pick, and addons as optional multi-pick", () => {
    expect(newChoice(0)).toMatchObject({ type: "variant", required: true, multiple: false });
    expect(newChoice(0, "addon")).toMatchObject({ type: "addon", required: false, multiple: true });
  });
  it("builds a choice from a category template", () => {
    const choice = choiceFromTemplate(template({}), 2);
    expect(choice).toMatchObject({ name: "Size", type: "variant", required: true, multiple: false, position: 2 });
    expect(choice.values.map((v) => v.label)).toEqual(["S", "M", "L"]);
    expect(choiceFromTemplate(template({ optionKind: "addon", required: false, multiple: true, name: "Extras" }), 0)).toMatchObject({ type: "addon", required: false, multiple: true });
    expect(choiceFromTemplate(template({ optionKind: "variant", multiple: true }), 0).multiple).toBe(false);
  });
  it("hides suggestions already added, ignoring case", () => {
    const options = [named(newChoice(0), " size ")];
    expect(unusedTemplates([template({}), template({ id: "c", name: "Colour" })], options).map((t) => t.name)).toEqual(["Colour"]);
  });
  it("adds comma or newline separated values without duplicates or blanks", () => {
    const option = withAddedValues(newChoice(0), "S, M,, m\nL");
    expect(option.values.map((v) => v.label)).toEqual(["S", "M", "L"]);
    expect(option.values.map((v) => v.position)).toEqual([0, 1, 2]);
    expect(withAddedValues(option, "  ")).toBe(option);
  });
  it("removes a value and renumbers positions", () => {
    const option = withValues(newChoice(0), "S, M, L");
    expect(withoutValue(option, option.values[0].id).values.map((v) => [v.label, v.position])).toEqual([["M", 0], ["L", 1]]);
  });
  it("switching to stock-tracked clears per-value surcharges; to extra makes it optional multi-pick", () => {
    const material = { ...withValues(newChoice(0, "configuration"), "Wood"), required: true };
    material.values[0].priceAdjustmentMinor = 500;
    const tracked = withKind(material, "variant");
    expect(tracked).toMatchObject({ type: "variant", required: true, multiple: false });
    expect(tracked.values[0].priceAdjustmentMinor).toBe(0);
    expect(withKind(material, "addon")).toMatchObject({ type: "addon", multiple: true, required: false });
    expect(withKind(material, "configuration")).toBe(material);
  });
  it("reorders choices and ignores moves past the ends", () => {
    const a = named(newChoice(0), "A"), b = named(newChoice(1), "B");
    expect(moveChoice([a, b], b.id, -1).map((o) => [o.name, o.position])).toEqual([["B", 0], ["A", 1]]);
    expect(moveChoice([a, b], a.id, -1)).toEqual([a, b]);
  });
});

describe("combinations", () => {
  const tee = (): ProductDraft => {
    const size = named(withValues(newChoice(0), "S, M, L"), "Size");
    const colour = named(withValues(newChoice(1), "Black, White"), "Colour");
    return withOptions({ ...emptyDraft, title: "Tee", price: "499", stock: "5" }, [size, colour]).draft;
  };
  it("generates six combinations priced at the starting price", () => {
    const draft = tee();
    expect(draft.variants).toHaveLength(6);
    expect(draft.variants.every((v) => v.priceMinor === 49900 && v.stock === 5)).toBe(true);
    expect(draft.variants[0].name).toBe("S / Black");
  });
  it("keeps edits when a value is added and drops combinations when an option is removed", () => {
    const draft = tee();
    draft.variants[0] = { ...draft.variants[0], priceMinor: 1, sku: "KEEP" };
    const size = draft.options[0];
    const more = withOptions(draft, [withAddedValues(size, "XL"), draft.options[1]]).draft;
    expect(more.variants).toHaveLength(8);
    expect(more.variants.find((v) => v.sku === "KEEP")?.priceMinor).toBe(1);
    expect(withOptions(more, []).draft.variants).toEqual([]);
  });
  it("reports the 100-combination limit and leaves the previous combinations in place", () => {
    const draft = tee();
    const many = (name: string, n: number) => named(withValues(newChoice(0), Array.from({ length: n }, (_, i) => `${name}${i}`).join(",")), name);
    const result = withOptions(draft, [many("A", 11), many("B", 10)]);
    expect(result.error).toMatch(/101|110/);
    expect(result.draft.variants).toBe(draft.variants);
  });
  it("applies bulk price and stock to everything or one value, and rejects bad input", () => {
    const draft = tee();
    const black = draft.options[1].values[0];
    const priced = applyBulk(draft.variants, { optionId: draft.options[1].id, valueId: black.id }, "price", "650") as { variants: ProductVariant[] };
    expect(priced.variants.filter((v) => v.priceMinor === 65000).map((v) => v.name)).toEqual(["S / Black", "M / Black", "L / Black"]);
    const stocked = applyBulk(draft.variants, null, "stock", "0") as { variants: ProductVariant[] };
    expect(stocked.variants.every((v) => v.stock === 0)).toBe(true);
    expect(applyBulk(draft.variants, null, "price", "abc")).toHaveProperty("error");
    expect(applyBulk(draft.variants, null, "price", "")).toHaveProperty("error");
    expect(applyBulk(draft.variants, null, "stock", "2.5")).toHaveProperty("error");
    expect(describeScope({ optionId: draft.options[1].id, valueId: black.id }, draft.options)).toBe("all Black");
    expect(describeScope(null, draft.options)).toBe("all combinations");
  });
});

describe("payload and validation", () => {
  const base = (): ProductDraft => withOptions({ ...emptyDraft, title: "Tee", price: "499" }, [named(withValues(newChoice(0), "S, M"), "Size"), named(withValues(newChoice(1, "configuration"), "Cotton, Linen"), "Material")]).draft;
  it("sends one variant per combination, only stock-tracked choices as inventory options, and ids only for saved rows", () => {
    const draft = base();
    const payload = draftToPayload(draft, "T-Shirts", { variantIds: [draft.variants[0].id], imageUrl: "" });
    expect(payload.inventoryOptionIds).toEqual([draft.options[0].id]);
    expect(payload.variants).toHaveLength(2);
    expect(payload.variants[0]).toHaveProperty("id", draft.variants[0].id);
    expect(payload.variants[1]).not.toHaveProperty("id");
    expect(payload.options).toHaveLength(2);
  });
  it("never sends the unlimited-stock sentinel as a quantity", () => {
    const draft = base();
    draft.variants[0] = { ...draft.variants[0], stock: Number.MAX_SAFE_INTEGER };
    const [first] = draftToPayload(draft, undefined).variants as Array<{ quantity?: number; trackInventory: boolean }>;
    expect(first).toMatchObject({ trackInventory: false });
    expect(first).not.toHaveProperty("quantity");
  });
  it("re-sends the photo only when it changed", () => {
    const draft = { ...base(), imageUrl: "https://x/a.jpg" };
    expect(draftToPayload(draft, undefined, { variantIds: [], imageUrl: "https://x/a.jpg" })).not.toHaveProperty("imageUrl");
    expect(draftToPayload(draft, undefined, { variantIds: [], imageUrl: "https://x/b.jpg" })).toHaveProperty("imageUrl", "https://x/a.jpg");
  });
  it("plain-language problems for empty or duplicate choices, none for a good setup", () => {
    expect(validateBuilderDraft(base()).problems).toEqual([]);
    const empty = withOptions({ ...emptyDraft, title: "Tee", price: "1" }, [newChoice(0)]).draft;
    expect(validateBuilderDraft(empty).problems.map((p) => p.code)).toEqual(expect.arrayContaining(["option_name_required", "option_values_required"]));
    const dup = withOptions({ ...emptyDraft, title: "Tee", price: "1" }, [named(withValues(newChoice(0), "A, a"), "X")]).draft;
    expect(dup.options[0].values).toHaveLength(1);
  });
  it("requires the starting price even with combinations", () => {
    const draft = { ...base(), price: "" };
    expect(validateBuilderDraft(draft).fields.price).toBe("Enter a price.");
  });
  it("does not duplicate title/price errors in the problem list", () => {
    const { problems } = validateBuilderDraft({ ...emptyDraft });
    expect(problems.map((p) => p.code)).toEqual([]);
  });
});

describe("opening a saved product", () => {
  const variant = (id: string, extra: Partial<ProductVariant> = {}): ProductVariant => ({ id, name: "Standard", sku: "S1", priceMinor: 25000, compareAtPriceMinor: 30000, stock: 4, options: {}, ...extra });
  const product = (extra: Partial<Product> = {}): Product => ({ id: "p1", storeId: "store-demo", name: "Mug", slug: "mug", description: "Nice", category: "Home", imageUrl: "https://x/m.jpg", media: [{ id: "m", url: "https://x/m.jpg" }], published: true, archived: false, featured: false, primaryCategoryId: "beds", variants: [variant("v1")], ...extra });
  it("fills a simple product and remembers the Standard variant", () => {
    const { draft, persisted } = productToDraft(product());
    expect(draft).toMatchObject({ title: "Mug", price: "250.00", compareAtPrice: "300.00", stock: "4", sku: "S1", categoryId: "beds", variants: [] });
    expect(persisted).toEqual({ variantIds: ["v1"], standardVariantId: "v1", imageUrl: "https://x/m.jpg" });
    expect(draftToPayload(draft, "Home", persisted).variants[0]).toHaveProperty("id", "v1");
  });
  it("treats the placeholder image as no photo and unlimited stock as blank (left untouched on save)", () => {
    const { draft, persisted } = productToDraft(product({ media: [], variants: [variant("v1", { stock: Number.MAX_SAFE_INTEGER })] }));
    expect(draft.imageUrl).toBe("");
    expect(draft.stock).toBe("");
    const [sent] = draftToPayload(draft, "Home", persisted).variants as Array<Record<string, unknown>>;
    expect(sent).not.toHaveProperty("quantity");
  });
  it("opens a product with combinations as-is", () => {
    const size = named(withValues(newChoice(0), "S, M"), "Size");
    const variants = size.values.map((v, i) => variant(`v${i}`, { name: v.label, options: { [size.id]: v.id } }));
    const { draft, persisted } = productToDraft(product({ options: [size], inventoryOptionIds: [size.id], variants }));
    expect(draft.variants).toHaveLength(2);
    expect(draft.compareAtPrice).toBe("");
    expect(persisted.standardVariantId).toBeUndefined();
    expect(persisted.variantIds).toEqual(["v0", "v1"]);
  });
});

const cat = (id: string, name: string, parentId: string | null = null) => ({ id, storeId: "store-demo", parentId, name, slug: name.toLowerCase(), position: 0, source: "platform" as const });
const taxonomy: Taxonomy = {
  categories: [cat("fashion", "Fashion"), cat("tees", "T-Shirts", "fashion")],
  templates: [
    template({ id: "t-size", categoryId: "tees", name: "Size", defaultValues: ["S", "M", "L"] }),
    template({ id: "t-colour", categoryId: "tees", name: "Colour", displayType: "color", defaultValues: ["Black", "White"], position: 1 }),
    template({ id: "t-extra", categoryId: "tees", name: "Gift wrap", optionKind: "addon", required: false, multiple: true, defaultValues: ["Gift wrap"], position: 2 }),
  ],
};

function mockApi() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/taxonomy/categories")) return new Response(JSON.stringify(taxonomy));
    const input = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ...input, id: "p-saved", storeId: "store-demo", media: [], tags: [], available: true,
      variants: input.variants.map((v: Record<string, unknown>, i: number) => ({ ...v, id: v.id ?? `server-v${i}`, quantity: v.quantity ?? null, available: true })) }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const productCalls = (mock: ReturnType<typeof mockApi>) => mock.mock.calls.filter(([url]) => String(url).includes("/catalog/products"));

describe("ProductBuilder choices and combinations", () => {
  it("builds a T-shirt from category suggestions, edits combinations and saves six variants", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);

    await user.type(screen.getByLabelText(/product name/i), "Classic Tee");
    await user.type(screen.getByLabelText(/^price/i), "499");
    expect(screen.queryByText(/Suggested for/)).toBeNull();

    await user.type(await screen.findByLabelText(/search categories/i), "t-shirts");
    await user.click(await screen.findByRole("button", { name: "Fashion › T-Shirts" }));
    expect(await screen.findByText(/Suggested for T-Shirts/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Size" }));
    await user.click(screen.getByRole("button", { name: "Colour" }));
    expect(screen.queryByRole("button", { name: "Size" })).toBeNull();
    expect(screen.getByRole("button", { name: "Gift wrap" })).toBeVisible();
    expect(await screen.findByText(/6 combinations/)).toBeVisible();

    const preview = screen.getByLabelText(/preview of what shoppers/i);
    expect(within(preview).getAllByTestId("preview-choice")).toHaveLength(2);
    expect(within(preview).getAllByLabelText("required")).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText("Bulk scope"), screen.getByRole("option", { name: "all Black" }));
    await user.type(screen.getByLabelText("Bulk value"), "650");
    await user.click(screen.getByRole("button", { name: /apply to all black/i }));
    expect(screen.getByLabelText("Price for S / Black")).toHaveValue("650.00");
    expect(screen.getByLabelText("Price for S / White")).toHaveValue("499.00");
    expect(within(preview).getByText(/From/)).toBeVisible();

    await user.clear(screen.getByLabelText("Stock for M / White"));
    await user.type(screen.getByLabelText("Stock for M / White"), "0");
    await user.click(screen.getByRole("button", { name: /save product/i }));
    expect(await screen.findByText(/Product saved successfully/)).toBeVisible();

    const [call] = productCalls(fetchMock);
    const body = JSON.parse(String(call[1]?.body));
    expect(body.variants).toHaveLength(6);
    expect(body.options.map((o: ProductOption) => o.name)).toEqual(["Size", "Colour"]);
    expect(body.inventoryOptionIds).toHaveLength(2);
    expect(body.variants.find((v: { title: string }) => v.title === "S / Black").priceMinor).toBe(65000);
    expect(body.variants.find((v: { title: string }) => v.title === "M / White").quantity).toBe(0);
    expect(body.variants.every((v: Record<string, unknown>) => !("id" in v))).toBe(true);

    // The second save must update the rows the server created, not add six more.
    await user.type(screen.getByLabelText("SKU for S / Black"), "TEE-1");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(productCalls(fetchMock)).toHaveLength(2));
    const second = JSON.parse(String(productCalls(fetchMock)[1][1]?.body));
    expect(productCalls(fetchMock)[1][1]?.method).toBe("PATCH");
    expect(second.variants.every((v: { id?: string }) => typeof v.id === "string" && v.id.startsWith("server-v"))).toBe(true);
    expect(second.variants.find((v: { sku?: string }) => v.sku === "TEE-1")).toBeDefined();
  });

  it("lets sellers type their own choice, explains the stock question, and shows price surcharges", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await user.type(screen.getByLabelText(/^price/i), "1000");
    await user.click(screen.getByRole("button", { name: /this product comes in different options/i }));
    await user.type(screen.getByLabelText("Choice name"), "Material");
    await user.click(screen.getByRole("radio", { name: /changes the price only/i }));
    await user.type(screen.getByLabelText(/add .* values/i), "Wood, Metal{Enter}");
    expect(screen.queryByText(/Combinations/)).toBeNull();
    await user.type(screen.getByLabelText(/\+ price/i, { selector: "input#" + (screen.getAllByLabelText(/\+ price/i)[0] as HTMLElement).id }), "250");
    const preview = screen.getByLabelText(/preview of what shoppers/i);
    expect(within(preview).getByText("Material")).toBeVisible();
    expect(within(preview).getByText(/\+.*250/)).toBeVisible();
    expect(within(preview).getByLabelText("required")).toBeVisible();
    await user.click(screen.getByLabelText("Shoppers must choose"));
    expect(within(preview).getByText(/\(optional\)/)).toBeVisible();
  });

  it("blocks saving with plain-language problems and removes them when fixed", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await user.type(screen.getByLabelText(/product name/i), "Tee");
    await user.type(screen.getByLabelText(/^price/i), "10");
    await user.click(screen.getByRole("button", { name: /this product comes in different options/i }));
    await user.click(screen.getByRole("button", { name: /save product/i }));
    const alert = await screen.findByText(/before saving/i);
    expect(alert.closest("[data-problems]")).toHaveTextContent(/needs a name|every choice needs a name/i);
    expect(alert.closest("[data-problems]")).toHaveTextContent(/at least one value/i);
    expect(productCalls(fetchMock)).toHaveLength(0);
    await user.click(screen.getByLabelText("Remove Choice 1"));
    expect(screen.queryByText(/before saving/i)).toBeNull();
  });

  it("warns and keeps previous combinations when choices would create too many", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await user.type(screen.getByLabelText(/^price/i), "10");
    for (const [name, count] of [["A", 11], ["B", 10]] as const) {
      await user.click(screen.getAllByRole("button", { name: /(this product comes in|add another)/i })[0]);
      const names = screen.getAllByLabelText("Choice name");
      await user.type(names[names.length - 1], name);
      const adders = screen.getAllByLabelText(new RegExp(`add ${name} values`, "i"));
      await user.click(adders[0]);
      await user.paste(Array.from({ length: count }, (_, i) => `${name}${i}`).join(","));
      await user.keyboard("{Enter}");
    }
    expect(await screen.findByText(/would create 110/i)).toBeVisible();
  });
});

describe("ProductBuilder editing", () => {
  it("opens a saved product and updates it in place", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    const product: Product = { id: "p1", storeId: "store-demo", name: "Mug", slug: "mug", description: "", category: "Home", imageUrl: "https://x/m.jpg", media: [{ id: "m", url: "https://x/m.jpg" }], published: true, archived: false, featured: false, primaryCategoryId: "tees", variants: [{ id: "v1", name: "Standard", sku: "", priceMinor: 25000, stock: 4, options: {} }] };
    render(<ShopProvider><ProductBuilder initial={product} /></ShopProvider>);
    expect(screen.getByLabelText(/product name/i)).toHaveValue("Mug");
    expect(screen.getByLabelText(/^price/i)).toHaveValue("250.00");
    expect(screen.getByRole("button", { name: /save changes/i })).toBeVisible();
    await user.type(screen.getByLabelText(/product name/i), "s");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(productCalls(fetchMock)).toHaveLength(1));
    const [call] = productCalls(fetchMock);
    expect(String(call[0])).toContain("/catalog/products/p1");
    expect(call[1]?.method).toBe("PATCH");
    const body = JSON.parse(String(call[1]?.body));
    expect(body.variants[0]).toMatchObject({ id: "v1", priceMinor: 25000, quantity: 4 });
    expect(body).not.toHaveProperty("imageUrl");
  });
});
