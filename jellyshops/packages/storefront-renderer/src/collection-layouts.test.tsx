import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import type { SectionNode } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { StorefrontRuntimeContext } from "./runtime-context";
import type { PublicProduct } from "./types";
import { CollectionProductGridSection, storyTiles } from "./sections/collection-sections";
import { ProductListBrowser, withStories, type StoryTile } from "./sections/product-list-browser";

const product = (id: string, swatch?: string): PublicProduct => ({ id, name: `Product ${id}`, href: `/p/${id}`, imageUrl: "", price: "£10.00", priceMinor: 1000, available: true, swatches: swatch ? [{ label: swatch, color: "#336699" }] : [] }) as PublicProduct;
const products = [product("1", "Blue"), product("2", "Red"), product("3", "Blue"), product("4")];
const story = (id: string, position: number): StoryTile => ({ id, heading: `Story ${id}`, position });
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

describe("collection layouts", () => {
  it("places story tiles after their product number, and the rest at the end", () => {
    const order = withStories(products, [story("b", 9), story("a", 2)]).map((item) => item.kind === "story" ? item.story.id : item.product.id);
    expect(order).toEqual(["1", "2", "a", "3", "4", "b"]);
  });

  it("chips: availability and colours are on/off buttons that filter the list", async () => {
    const { container } = render(<ProductListBrowser products={products} columns={3} limit={12} showSort={false} showFilters emptyMessage="None" layout="chips" />);
    expect(container.querySelector(".jelly-list-filters")).toBeNull();
    const blue = screen.getByRole("button", { name: "Blue" });
    expect(blue).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(blue);
    expect(blue).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".jelly-product-card")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(container.querySelectorAll(".jelly-product-card")).toHaveLength(4);
    expect(await noViolations(container)).toEqual([]);
  });

  it("sidebar: marks the list so the filters stand beside the products", () => {
    const { container } = render(<ProductListBrowser products={products} columns={3} limit={12} showSort showFilters emptyMessage="None" layout="sidebar" />);
    expect(container.querySelector(".jelly-list-browser")).toHaveAttribute("data-layout", "sidebar");
    expect(within(container).getByRole("group", { name: "Filters" })).toBeTruthy();
  });

  it("editorial: builds story tiles from the section's blocks and shows them with a named link", async () => {
    const blocks = [
      { id: "s1", type: "story-tile", enabled: true, settings: { heading: "Made by hand", text: "Small batches.", link: "/pages/about", linkLabel: "Our story", position: 1 } },
      { id: "s2", type: "story-tile", enabled: false, settings: { heading: "Hidden", position: 2 } },
      { id: "s3", type: "story-tile", enabled: true, settings: { heading: "   ", position: 3 } },
    ] as SectionNode["blocks"];
    const tiles = storyTiles(blocks, "demo");
    expect(tiles.map((tile) => tile.heading)).toEqual(["Made by hand"]);
    expect(tiles[0].href).toBe("/demo/pages/about");
    const { container } = render(<ProductListBrowser products={products} columns={3} limit={12} showSort={false} showFilters={false} emptyMessage="None" layout="editorial" stories={tiles} />);
    expect(screen.getByRole("link", { name: "Our story: Made by hand" })).toHaveAttribute("href", "/demo/pages/about");
    expect(await noViolations(container)).toEqual([]);
  });

  it("the collection grid uses the browser for any layout but plain grid, and filter layouts always show filters", () => {
    const context = { mode: "published", storeSlug: "demo", commerce: { getProducts: async () => [] }, page: { pageType: "collection", resource: { id: "c", handle: "c", data: { collectionPresentation: { collection: { id: "c", title: "C" }, products, totalProducts: 4 } } } } } as unknown as StorefrontRuntimeContext;
    const { container } = render(<CollectionProductGridSection context={context} section={{ settings: { listLayout: "sidebar" } }} />);
    expect(container.querySelector(".jelly-list-browser")).toHaveAttribute("data-filters", "true");
  });

  it("the registry accepts the layouts and the story tile block", () => {
    const section = (settings: Record<string, unknown>, blocks: SectionNode["blocks"] = []) => ({ id: "g", type: "collection-product-grid", enabled: true, settings: { columns: 3, limit: 12, emptyMessage: "None", ...settings }, blocks }) as SectionNode;
    expect(validateSectionAgainstRegistry(section({ listLayout: "editorial" }, [{ id: "s", type: "story-tile", enabled: true, settings: { heading: "Story", position: 3 } }]), "collection")).toEqual([]);
    expect(validateSectionAgainstRegistry(section({ listLayout: "masonry" }), "collection").length).toBeGreaterThan(0);
  });
});
