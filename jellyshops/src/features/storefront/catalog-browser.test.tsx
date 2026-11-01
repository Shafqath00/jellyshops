import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CatalogBrowser } from "./catalog-browser";
const store = { id: "a", slug: "new", currency: "GBP" };
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => store, listProducts: () => [] }, state: { version: 1 } }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("resolves uploaded covers returned by collection grid refreshes", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ nodes: [{ id: "p", storeId: "a", title: "Bed", handle: "bed", description: "", media: [{ id: "m", position: 0, url: "/api/public/media/a/m", altText: "Bed" }], variants: [{ id: "v", title: "Standard", priceMinor: 25000, quantity: 1, available: true }], available: true }], nextCursor: null })));
  render(<CatalogBrowser storeSlug="new" collectionId="beds" />);
  expect(await screen.findByRole("img", { name: "Bed" })).toHaveAttribute("src", `${(process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "")}/api/public/media/a/m`);
});
