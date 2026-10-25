import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { draftToPayload, emptyDraft, validateDraftForPublish, validateSimpleDraft } from "./draft";
import { ProductBuilder } from "./ProductBuilder";
import { buildCategoryPaths, getCategoryTemplates, searchCategoryPaths, type Taxonomy } from "./taxonomy";

vi.mock("@/features/auth/auth-provider", () => {
  const activeStore = { id: "store-demo", currency: "INR", country: "IN" };
  const session = { access_token: "jelly-demo-merchant" };
  return { useAuth: () => ({ activeStore, session }) };
});
afterEach(() => vi.unstubAllGlobals());

const cat = (id: string, name: string, parentId: string | null = null, position = 0) => ({ id, storeId: "store-demo", parentId, name, slug: name.toLowerCase(), position, source: "platform" as const });
const taxonomy: Taxonomy = {
  categories: [cat("fashion", "Fashion"), cat("men", "Men", "fashion"), cat("tees", "T-Shirts", "men"), cat("furniture", "Furniture", null, 1), cat("beds", "Beds", "furniture")],
  templates: [
    { id: "t1", categoryId: "fashion", name: "Size", optionKind: "variant", displayType: "buttons", required: true, multiple: false, defaultValues: ["S"], position: 0 },
    { id: "t2", categoryId: "tees", name: "size", optionKind: "variant", displayType: "buttons", required: true, multiple: false, defaultValues: ["S", "M"], position: 0 },
    { id: "t3", categoryId: "tees", name: "Colour", optionKind: "variant", displayType: "color", required: true, multiple: false, defaultValues: [], position: 1 },
  ],
};

describe("taxonomy helpers", () => {
  it("builds readable paths in tree order", () => {
    expect(buildCategoryPaths(taxonomy.categories).map((p) => p.label)).toEqual(["Fashion", "Fashion › Men", "Fashion › Men › T-Shirts", "Furniture", "Furniture › Beds"]);
  });
  it("searches every word and lists leaves before groups", () => {
    const paths = buildCategoryPaths(taxonomy.categories);
    expect(searchCategoryPaths(paths, "men t-shirt").map((p) => p.label)).toEqual(["Fashion › Men › T-Shirts"]);
    expect(searchCategoryPaths(paths, "fashion").map((p) => p.label)).toEqual(["Fashion › Men › T-Shirts", "Fashion", "Fashion › Men"]);
    expect(searchCategoryPaths(paths, "")).toHaveLength(5);
  });
  it("keeps orphaned categories selectable", () => {
    expect(buildCategoryPaths([cat("x", "Lost", "gone")]).map((p) => p.label)).toEqual(["Lost"]);
  });
  it("inherits templates and lets a child override a parent by name", () => {
    const templates = getCategoryTemplates("tees", taxonomy);
    expect(templates.map((t) => [t.name, t.defaultValues.length])).toEqual([["size", 2], ["Colour", 0]]);
    expect(getCategoryTemplates("beds", taxonomy)).toEqual([]);
  });
});

describe("draft", () => {
  const valid = { ...emptyDraft, title: " Mug ", price: "499", stock: "3" };
  it("accepts a minimal product and treats stock as optional", () => {
    expect(validateSimpleDraft(valid)).toEqual({});
    expect(validateSimpleDraft({ ...valid, stock: "" })).toEqual({});
  });
  it("reports plain-language errors per field", () => {
    expect(validateSimpleDraft(emptyDraft)).toMatchObject({ title: expect.any(String), price: "Enter a price." });
    expect(validateSimpleDraft({ ...valid, price: "abc" }).price).toMatch(/valid price/);
    expect(validateSimpleDraft({ ...valid, stock: "-1" }).stock).toMatch(/whole number/);
    expect(validateSimpleDraft({ ...valid, stock: "2.5" }).stock).toBeDefined();
    expect(validateSimpleDraft({ ...valid, compareAtPrice: "100" }).compareAtPrice).toMatch(/higher/);
    expect(validateSimpleDraft({ ...valid, compareAtPrice: "x" }).compareAtPrice).toMatch(/valid price/);
    expect(validateSimpleDraft({ ...valid, compareAtPrice: "599" })).toEqual({});
  });
  it("builds a one-variant payload in minor units", () => {
    const payload = draftToPayload({ ...valid, compareAtPrice: "599.50", sku: " MUG-1 ", categoryId: "tees", published: false }, "T-Shirts");
    expect(payload).toMatchObject({ handle: "mug", title: "Mug", productType: "T-Shirts", status: "DRAFT", primaryCategoryId: "tees", options: [], inventoryOptionIds: [] });
    expect(payload.variants).toEqual([{ title: "Standard", sku: "MUG-1", priceMinor: 49900, compareAtPriceMinor: 59950, quantity: 3, trackInventory: true, options: {} }]);
  });
  it("omits optional fields and defaults stock to zero", () => {
    const payload = draftToPayload({ ...valid, stock: "" }, undefined);
    expect(payload).not.toHaveProperty("imageUrl");
    expect(payload).toMatchObject({ productType: "Other", primaryCategoryId: undefined });
    expect(payload.variants[0]).toMatchObject({ quantity: 0, sku: undefined, compareAtPriceMinor: null });
  });
  it("runs the shared publish validator", () => {
    expect(validateDraftForPublish(valid).errors).toEqual([]);
    expect(validateDraftForPublish({ ...valid, title: "" }).errors.map((e) => e.code)).toContain("title_required");
    expect(validateDraftForPublish(valid).warnings.map((w) => w.code)).toContain("no_photos");
  });
});

function mockApi() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/taxonomy/categories") && (!init?.method || init.method === "GET")) return new Response(JSON.stringify(taxonomy));
    if (String(url).includes("/taxonomy/categories") && init?.method === "POST") return new Response(JSON.stringify(cat("new", JSON.parse(String(init.body)).name, JSON.parse(String(init.body)).parentId)), { status: 201 });
    const input = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ...input, id: "canonical-product", storeId: "store-demo", media: [], tags: [], variants: input.variants.map((v: object) => ({ ...v, id: "canonical-variant", quantity: 6, available: true })), available: true }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const productCalls = (mock: ReturnType<typeof mockApi>) => mock.mock.calls.filter(([url]) => String(url).includes("/catalog/products"));

describe("ProductBuilder", () => {
  it("creates a simple product with a category and shows a live preview", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);

    await user.type(screen.getByLabelText(/product name/i), "Mango Tee");
    await user.type(screen.getByLabelText(/^price/i), "650");
    await user.type(screen.getByLabelText(/original price/i), "800");
    expect(within(screen.getByLabelText(/preview of what shoppers/i)).getByRole("heading", { name: "Mango Tee" })).toBeVisible();

    await user.type(await screen.findByLabelText(/search categories/i), "t-shirts");
    await user.click(await screen.findByRole("button", { name: "Fashion › Men › T-Shirts" }));
    expect(screen.getAllByText("Fashion › Men › T-Shirts").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /save product/i }));
    expect(await screen.findByText(/Product saved successfully/)).toBeVisible();
    const [call] = productCalls(fetchMock);
    expect(call[1]).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(call[1]?.body))).toMatchObject({ title: "Mango Tee", primaryCategoryId: "tees", productType: "T-Shirts", status: "ACTIVE", variants: [{ priceMinor: 65000, compareAtPriceMinor: 80000 }] });
  });

  it("blocks saving, explains what is missing and focuses the first problem", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await user.click(screen.getByRole("button", { name: /save product/i }));
    expect(await screen.findByText("Give your product a name.")).toBeVisible();
    expect(screen.getByText("Enter a price.")).toBeVisible();
    expect(screen.getByLabelText(/product name/i)).toHaveFocus();
    expect(productCalls(fetchMock)).toHaveLength(0);
    await user.type(screen.getByLabelText(/product name/i), "x");
    expect(screen.queryByText("Give your product a name.")).toBeNull();
  });

  it("updates, rather than duplicates, when saved twice", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await user.type(screen.getByLabelText(/product name/i), "Mug");
    await user.type(screen.getByLabelText(/^price/i), "100");
    await user.click(screen.getByRole("button", { name: /save product/i }));
    await screen.findByText(/Product saved successfully/);
    await user.type(screen.getByLabelText(/product name/i), "s");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(productCalls(fetchMock)).toHaveLength(2));
    expect(productCalls(fetchMock).map(([, init]) => init?.method)).toEqual(["POST", "PATCH"]);
  });

  it("adds a custom category inside a chosen parent and selects it", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await user.click(await screen.findByRole("button", { name: /add your own category/i }));
    await user.type(screen.getByLabelText(/new category name/i), "Hoodies");
    await user.selectOptions(screen.getByLabelText(/inside/i), "men");
    await user.click(screen.getByRole("button", { name: /^add category$/i }));
    expect((await screen.findAllByText("Fashion › Men › Hoodies")).length).toBeGreaterThan(0);
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]?.body))).toEqual({ name: "Hoodies", parentId: "men" });
  });

  it("shows an error and keeps the form when the API rejects the save", async () => {
    const fetchMock = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify(taxonomy)));
    fetchMock.mockImplementationOnce(async () => new Response(JSON.stringify({ error: { message: "Nope" } }), { status: 409 }));
    await user.type(screen.getByLabelText(/product name/i), "Mug");
    await user.type(screen.getByLabelText(/^price/i), "100");
    await user.click(screen.getByRole("button", { name: /save product/i }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByLabelText(/product name/i)).toHaveValue("Mug");
  });
});
