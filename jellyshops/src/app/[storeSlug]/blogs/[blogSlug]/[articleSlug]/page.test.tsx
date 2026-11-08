import { render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const { getStorefront } = vi.hoisted(() => ({getStorefront: vi.fn()}));
vi.mock("@/features/storefront/server-storefront", () => ({getServerStorefront: getStorefront}));
vi.mock("@/features/storefront/storefront-page", () => ({PublishedRuntimeStorefront: ({route}: {route: {template: {id: string}}}) => <p>{route.template.id}</p>}));
import Page from "./page";
import {ServerContentPage} from "@/features/storefront/server-content-page";
afterEach(() => vi.unstubAllGlobals());
it("server renders the published article using current-store public content", async () => {
  getStorefront.mockResolvedValue({store: {id: "store-a", slug: "store-a", currency: "USD"}, products: [], publication: {kind: "v4", snapshot: {templates: {selected: {id: "selected", type: "article", handle: "default", layout: {sections: []}}}, templateDefaults: {article: "selected"}, globalSections: {}, assignments: [], menus: {}, theme: {presetId: "minimal", settings: {}}}}});
  const fetcher = vi.fn(async () => new Response(JSON.stringify({type: "article", blog: {id: "blog-a", handle: "news", title: "News"}, article: {id: "resource-a", handle: "opening", title: "Opening", content: {}}}), {headers: {"content-type": "application/json"}}));
  vi.stubGlobal("fetch", fetcher);
  const element = await Page({params: Promise.resolve({storeSlug: "store-a", blogSlug: "news", articleSlug: "opening"})});
  render(await ServerContentPage(element.props));
  expect(screen.getByText("selected")).toBeVisible();
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/api/public/stores/store-a/storefront/context/blogs/news/articles/opening"), {cache: "no-store"});
});
