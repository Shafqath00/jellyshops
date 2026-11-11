import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { RecentlyViewedSection, recentlyViewedProducts } from "./sections/recently-viewed";
import type { CommerceDataProvider, PublicProduct, StorefrontRecentlyViewedAccess } from "./types";
import type { StorefrontRuntimeContext } from "./runtime-context";

afterEach(cleanup);

const product = (id: string, name: string): PublicProduct => ({ id, name, href: `/shop/products/${id}`, imageUrl: "", price: "£100.00" });
const products = [product("a", "Ascot bed"), product("b", "Bowen bed"), product("c", "Cleo mattress"), product("d", "Dale headboard")];
const section: SectionNode = { id: "recent", type: "recently-viewed", enabled: true, settings: { limit: 3, heading: "You looked at" }, blocks: [] } as unknown as SectionNode;

function listAccess(initial: string[]): StorefrontRecentlyViewedAccess & { set(ids: string[]): void } {
  let ids: readonly string[] = initial;
  const listeners = new Set<() => void>();
  return {
    ids: () => ids,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    set(next) { ids = next; listeners.forEach((listener) => listener()); },
  };
}

function commerce(recentlyViewed?: StorefrontRecentlyViewedAccess): CommerceDataProvider {
  return { initialProducts: products, getProducts: async () => products, recentlyViewed };
}

const context = (mode: StorefrontRuntimeContext["mode"], currentId?: string): StorefrontRuntimeContext => ({
  mode,
  ...(currentId ? { page: { pageType: "product", resource: { id: currentId, handle: currentId, data: {} } } } : {}),
} as StorefrontRuntimeContext);

it("keeps the shopper's order, skips the product on screen and unknown ids, and stops at the limit", () => {
  expect(recentlyViewedProducts(["c", "gone", "a", "b", "d"], products, "a", 2).map((item) => item.id)).toEqual(["c", "b"]);
});

it("is hidden on the live store until the shopper has opened a product, then shows it", async () => {
  const access = listAccess([]);
  const provider = commerce(access);
  const { container } = render(<RecentlyViewedSection context={context("published", "a")} section={section} commerce={provider} />);
  expect(container).toBeEmptyDOMElement();
  await act(async () => { access.set(["a", "c", "b"]); });
  expect(await screen.findByRole("heading", { name: "You looked at" })).toBeInTheDocument();
  expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(expect.arrayContaining(["/shop/products/c", "/shop/products/b"]));
  expect(screen.queryByText("Ascot bed")).toBeNull();
});

it("shows sample products and a note in the editor", async () => {
  render(<RecentlyViewedSection context={context("editor")} section={section} commerce={commerce()} />);
  expect(screen.getByText(/Shoppers see the products they opened most recently/)).toBeInTheDocument();
  expect(await screen.findByText("Cleo mattress")).toBeInTheDocument();
  expect(screen.queryByText("Dale headboard")).toBeNull();
});
