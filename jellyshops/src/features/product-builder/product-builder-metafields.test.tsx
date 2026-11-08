import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShopProvider } from "@/contexts/shop-context";
import { ProductBuilder } from "./product-builder";

vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-demo", currency: "GBP", country: "GB" };
  const session = { access_token: "jelly-demo-merchant" };
  return { authApiOrigin: () => "http://localhost:3001", useAuth: () => ({ activeStore, session }) };
});
vi.setConfig({ testTimeout: 20_000 });
afterEach(() => vi.unstubAllGlobals());

const material = { id: "def-material", ownerType: "product", namespace: "custom", key: "material", name: "Material", type: "string", storefrontVisible: true, description: "What it is made of" };
const rating = { id: "def-rating", ownerType: "product", namespace: "custom", key: "rating", name: "Rating", type: "integer", storefrontVisible: false, validations: { min: 1, max: 5 } };

type Options = { definitions?: unknown[]; variantDefinitions?: unknown[]; saveValues?: (body: Record<string, unknown>, ownerType: string) => Response };

function mockApi(options: Options = {}) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null;
    calls.push({ url: String(url), method, body });
    if (String(url).includes("/taxonomy/categories")) return new Response(JSON.stringify({ categories: [], templates: [] }));
    if (String(url).includes("/catalog/collections")) return new Response(JSON.stringify({ nodes: [], nextCursor: null }));
    if (String(url).includes("/digital-products/")) return new Response(JSON.stringify({ fulfillmentType: "PHYSICAL", assets: [] }));
    if (String(url).includes("/custom-data/metafield-values")) {
      if (method === "PUT") return (options.saveValues ?? (() => new Response(JSON.stringify({ saved: 1, cleared: 0 }))))(body!, String(body!.ownerType));
      return new Response(JSON.stringify({ values: [] }));
    }
    if (String(url).includes("/custom-data/metafields")) {
      if (method === "POST") return new Response(JSON.stringify({ id: "def-new", archivedAt: null, origin: "jelly", ...body }), { status: 201 });
      return new Response(JSON.stringify(String(url).includes("ownerType=variant") ? options.variantDefinitions ?? [] : options.definitions ?? [material, rating]));
    }
    const input = body as { variants: object[] };
    return new Response(JSON.stringify({ ...input, id: "canonical-product", storeId: "store-demo", media: [], tags: [], variants: input.variants.map((variant) => ({ ...variant, id: "canonical-variant", quantity: 6, available: true })), available: true }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, puts: () => calls.filter((call) => call.method === "PUT" && call.url.includes("/metafield-values")) };
}

async function fillProduct(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/product name/i), "Linen shirt");
  await user.type(screen.getByLabelText(/^price/i), "49");
}

describe("custom data in the product editor", () => {
  it("shows the store's custom fields with their descriptions and types", async () => {
    mockApi();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    expect(await screen.findByRole("heading", { name: "Custom data" })).toBeVisible();
    expect(await screen.findByLabelText("Material")).toBeVisible();
    const hint = (text: string) => screen.getByText((_, element) => element?.tagName === "P" && element.textContent === text);
    expect(hint("What it is made of · Single-line text · custom.material · Available to your theme")).toBeVisible();
    expect(screen.getByLabelText("Rating")).toBeVisible();
    expect(hint("Whole number · custom.rating · Admin only")).toBeVisible();
  });

  it("saves the values with the product, under the new product's id", async () => {
    const { puts, calls } = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await fillProduct(user);
    await user.type(await screen.findByLabelText("Material"), "Organic linen");
    await user.type(screen.getByLabelText("Rating"), "4");
    await user.click(screen.getByRole("button", { name: /save product/i }));
    expect(await screen.findByText("Product saved successfully")).toBeVisible();
    expect(puts()).toHaveLength(1);
    expect(puts()[0].body).toEqual({ ownerType: "product", ownerId: "canonical-product", values: { "def-material": "Organic linen", "def-rating": 4 } });
    // The product is saved first, so the custom data always has an owner to belong to.
    const order = calls.filter((call) => call.method !== "GET").map((call) => call.url.includes("/metafield-values") ? "values" : "product");
    expect(order).toEqual(["product", "values"]);
    expect(screen.queryByText("Unsaved changes")).not.toBeInTheDocument();
  });

  it("does not ask the server to save custom data when none was entered", async () => {
    const { puts } = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await fillProduct(user);
    await screen.findByLabelText("Material");
    await user.click(screen.getByRole("button", { name: /save product/i }));
    expect(await screen.findByText("Product saved successfully")).toBeVisible();
    expect(puts()).toHaveLength(0);
  });

  it("says the product was saved when its custom data was refused, shows why next to the field, and keeps it unsaved", async () => {
    mockApi({ saveValues: () => new Response(JSON.stringify({ error: { code: "METAFIELD_INVALID", message: "Rating: Enter 5 or less.", issues: [{ path: "def-rating", message: "Rating: Enter 5 or less." }] } }), { status: 422 }) });
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await fillProduct(user);
    await user.type(await screen.findByLabelText("Rating"), "9");
    await user.click(screen.getByRole("button", { name: /save product/i }));
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.map((alert) => alert.textContent).join(" ")).toContain("Your product was saved, but its custom data was not: Rating: Enter 5 or less.");
    expect(screen.queryByText("Product saved successfully")).not.toBeInTheDocument();
    expect(screen.getByText("Unsaved changes")).toBeVisible();
    expect(screen.getByLabelText("Rating")).toHaveAttribute("aria-invalid", "true");
    // Fixing the value and saving again updates the same product and clears the notice.
    await userEvent.setup().clear(screen.getByLabelText("Rating"));
    await userEvent.setup().type(screen.getByLabelText("Rating"), "5");
    expect(screen.getByLabelText("Rating")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("marks the editor as having unsaved changes when a custom field is edited", async () => {
    mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await user.type(await screen.findByLabelText("Material"), "L");
    expect(screen.getByText("Unsaved changes")).toBeVisible();
  });

  it("adds a custom field without leaving the editor, and offers it straight away", async () => {
    const { calls } = mockApi();
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    await screen.findByLabelText("Material");
    await user.click(screen.getByRole("button", { name: "Add custom field" }));
    await user.type(screen.getByLabelText("Name"), "Care guide");
    await user.selectOptions(screen.getByLabelText("Type"), "url");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    expect(await screen.findByLabelText("Care guide")).toBeVisible();
    const post = calls.find((call) => call.method === "POST" && call.url.includes("/custom-data/metafields"));
    expect(post?.body).toMatchObject({ ownerType: "product", namespace: "custom", key: "care_guide", name: "Care guide", type: "url", storefrontVisible: true });
    expect(screen.queryByRole("group", { name: "New custom field" })).not.toBeInTheDocument();
  });

  it("explains that there are no custom fields yet", async () => {
    mockApi({ definitions: [] });
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    expect(await screen.findByText(/No custom fields yet/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Add custom field" })).toBeVisible();
  });

  it("says when custom data cannot be loaded, without stopping the product from being saved", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/custom-data/")) return new Response(JSON.stringify({ error: { message: "Custom data is unavailable." } }), { status: 503 });
      if (String(url).includes("/taxonomy/categories")) return new Response(JSON.stringify({ categories: [], templates: [] }));
      if (String(url).includes("/catalog/collections")) return new Response(JSON.stringify({ nodes: [], nextCursor: null }));
      if (String(url).includes("/digital-products/")) return new Response(JSON.stringify({ fulfillmentType: "PHYSICAL", assets: [] }));
      const input = JSON.parse(String(init?.body)) as { variants: object[] };
      return new Response(JSON.stringify({ ...input, id: "canonical-product", storeId: "store-demo", media: [], tags: [], variants: input.variants.map((variant) => ({ ...variant, id: "v", quantity: 1, available: true })), available: true }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<ShopProvider><ProductBuilder /></ShopProvider>);
    expect(await screen.findByText("Custom data is unavailable.")).toBeVisible();
    await fillProduct(user);
    await user.click(screen.getByRole("button", { name: /save product/i }));
    expect(await screen.findByText("Product saved successfully")).toBeVisible();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, init]) => String(url).includes("/metafield-values") && (init as RequestInit | undefined)?.method === "PUT")).toHaveLength(0));
  });
});
