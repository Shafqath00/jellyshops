import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { getStorefront } = vi.hoisted(() => ({getStorefront: vi.fn()}));
vi.mock("@/features/storefront/server-storefront", () => ({getServerStorefront: getStorefront}));
vi.mock("@/features/storefront/storefront-page", () => ({PublishedRuntimeStorefront: ({route}: {route: {template: {id: string}}}) => <p>{route.template.id}</p>}));
import Page from "./page";
import {ServerContentPage} from "@/features/storefront/server-content-page";
afterEach(() => vi.unstubAllGlobals());
it("server renders the published blog using current-store public content", async () => {
  getStorefront.mockResolvedValue({store: {id: "store-a", slug: "store-a", currency: "USD"}, products: [], publication: {kind: "v4", snapshot: {templates: {selected: {id: "selected", type: "blog", handle: "default", layout: {sections: []}}}, templateDefaults: {blog: "selected"}, globalSections: {}, assignments: [], menus: {}, theme: {presetId: "minimal", settings: {}}}}});
  const fetcher = vi.fn(async () => new Response(JSON.stringify({type: "blog", blog: {id: "resource-a", handle: "news", title: "News"}, articles: []}), {headers: {"content-type": "application/json"}}));
  vi.stubGlobal("fetch", fetcher);
  const element = await Page({params: Promise.resolve({storeSlug: "store-a", blogSlug: "news"})});
  render(await ServerContentPage(element.props));
  expect(screen.getByText("selected")).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/public/stores/store-a/storefront/context/blogs/news"), {cache: "no-store"});
});
