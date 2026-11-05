import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { recipeSchema, registerRecipes, type SectionRecipe } from "@jelly/storefront-themes";
import { RegistrySectionRenderer } from "./registry-section-renderer";

const recipe = recipeSchema.parse({
  type: "acme-shop/picks", name: "Picks", supportedPages: ["home"],
  settings: [
    { id: "count", type: "number", label: "How many", default: 2, min: 1, max: 12 },
    { id: "range", type: "collection", label: "Collection" },
  ],
  elements: [{ kind: "heading", text: "Picks" }, { kind: "spacer", size: 40 }, { kind: "products", limit: "{count}", collection: "{range}", columns: 3 }],
}) as SectionRecipe;
const product = (n: number) => ({ id: `p${n}`, name: `Product ${n}`, href: `/shop/p${n}`, imageUrl: "https://example.com/p.jpg", price: "£10.00" });
const section = (settings: Record<string, unknown> = {}): SectionNode => ({ id: "picks-1", type: "acme-shop/picks", enabled: true, settings, blocks: [] });

afterEach(() => { registerRecipes("acme-shop", []); });

describe("recipe spacer and product list", () => {
  it("draws a spacer of the given height and the store's products", async () => {
    registerRecipes("acme-shop", [recipe]);
    const getProducts = vi.fn(async () => [product(1), product(2), product(3)]);
    const view = render(<RegistrySectionRenderer section={section()} mode="published" commerce={{ getProducts }} storeSlug="shop" themeId="acme-shop" />);
    expect((view.container.querySelector(".jelly-recipe-spacer") as HTMLElement).style.height).toBe("40px");
    await waitFor(() => expect(screen.getAllByText(/^Product \d$/)).toHaveLength(2));
    expect(getProducts).toHaveBeenCalledWith({ featured: true, limit: 2 });
  });

  it("asks for the collection the merchant picked", async () => {
    registerRecipes("acme-shop", [recipe]);
    const getProducts = vi.fn(async () => [product(7)]);
    render(<RegistrySectionRenderer section={section({ range: "col-9", count: 5 })} mode="published" commerce={{ getProducts }} storeSlug="shop" themeId="acme-shop" />);
    await waitFor(() => expect(screen.getByText("Product 7")).toBeInTheDocument());
    expect(getProducts).toHaveBeenCalledWith({ featured: false, limit: 5, collectionId: "col-9" });
  });

  it("draws nothing for the product list when the store has no products", async () => {
    registerRecipes("acme-shop", [recipe]);
    const getProducts = vi.fn(async () => []);
    const view = render(<RegistrySectionRenderer section={section()} mode="published" commerce={{ getProducts }} storeSlug="shop" themeId="acme-shop" />);
    await waitFor(() => expect(getProducts).toHaveBeenCalled());
    expect(view.container.querySelector(".jelly-recipe-products")).toBeNull();
    expect(screen.getByRole("heading", { name: "Picks" })).toBeInTheDocument();
  });
});
