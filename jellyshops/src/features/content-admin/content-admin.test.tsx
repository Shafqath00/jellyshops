import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import type { ContentApi, ContentListResult, PageResource } from "@/features/content/api/client";
import { ContentList } from "./content-list";
import { ContentItemEditor, slugify } from "./content-item-editor";
import { changesBetween, contentProblems, editableFrom } from "./editable";

// jsdom has no layout; the rich text editor asks for these.
Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) });
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
document.elementFromPoint = () => null;

const api = vi.hoisted(() => ({} as Record<string, ReturnType<typeof vi.fn>>));
vi.mock("./shared", async (original) => ({
  ...(await original<typeof import("./shared")>()),
  useContentApi: () => ({ api, storeId: "store-a", storeSlug: "shop", media: undefined, listImages: undefined }),
}));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => ({ session: { access_token: "t", user: { email: "sam@example.test" } }, activeStore: { id: "store-a", slug: "shop" } }) }));
const push = vi.fn();
vi.mock("@/features/admin/admin-routing", async (original) => ({
  ...(await original<typeof import("@/features/admin/admin-routing")>()),
  useAdminRouter: () => ({ push, replace: vi.fn() }),
  useShopAdminHref: () => (href: string) => href,
}));

const page = (patch: Partial<PageResource> = {}): PageResource => ({
  id: "page-1", title: "Delivery", handle: "delivery", status: "PUBLISHED", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "We deliver." }] }] },
  seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null, authorName: "Sam", authorUserId: "u1",
  updatedAt: new Date().toISOString(), publishedAt: "2026-11-01T10:00:00.000Z", scheduledAt: null, archivedAt: null, ...patch,
});
const listResult = (items: PageResource[]): ContentListResult<PageResource> => ({
  items, total: items.length, counts: { all: 3, active: 2, published: 1, draft: 1, scheduled: 0, archived: 1 }, facets: { authors: [{ id: "u1", name: "Sam" }], tags: [] },
});

beforeEach(() => {
  for (const key of Object.keys(api)) delete api[key];
  Object.assign(api, {
    browsePages: vi.fn(async () => listResult([page(), page({ id: "page-2", title: "About us", handle: "about", status: "DRAFT", publishedAt: null })])),
    bulkPages: vi.fn(async (_store: string, _action: string, ids: string[]) => ({ done: ids, failed: [] })),
    getPage: vi.fn(async () => page()),
    listTemplates: vi.fn(async () => []),
    getAssignment: vi.fn(async () => null),
    updatePage: vi.fn(async (_store: string, _id: string, patch: Partial<PageResource>) => page(patch)),
    createPage: vi.fn(async (_store: string, input: Partial<PageResource>) => page({ id: "page-new", status: "DRAFT", publishedAt: null, handle: input.handle ?? "x", title: input.title ?? "" })),
    publishPage: vi.fn(async () => page({ id: "page-new" })),
    checkPageHandle: vi.fn(async (_store: string, handle: string) => ({ handle, available: false, suggestion: `${handle}-2` })),
    archivePage: vi.fn(async () => page({ archivedAt: new Date().toISOString(), status: "DRAFT" })),
    restorePage: vi.fn(async () => page()),
  } satisfies Partial<Record<keyof ContentApi, ReturnType<typeof vi.fn>>>);
  window.localStorage.clear();
  push.mockReset();
});
afterEach(cleanup);

describe("content rules in the editor", () => {
  it("makes web address endings like the server", () => {
    expect(slugify("Delivery & Returns!")).toBe("delivery-and-returns");
    expect(slugify("Café crème")).toBe("cafe-creme");
  });

  it("sends only what changed, shaped for the kind", () => {
    const saved = editableFrom(page());
    expect(changesBetween("page", saved, { ...saved, title: "Shipping", tags: ["x"] })).toEqual({ title: "Shipping" });
    expect(changesBetween("post", { ...saved, blogId: "b1" }, { ...saved, blogId: "b2", authorName: " " })).toEqual({ blogId: "b2", authorName: null });
    expect(contentProblems({ ...saved, title: " ", handle: "Bad Address" }, "page")).toEqual({ title: "Give the page a title.", handle: "Use lowercase letters, numbers and hyphens only, like about-us." });
  });
});

describe("pages list", () => {
  it("shows pages with their status, author and counts per tab", async () => {
    render(<ToastProvider><ContentList kind="page" /></ToastProvider>);
    const table = await screen.findByRole("region", { name: "Pages" });
    expect(within(table).getByRole("link", { name: "Delivery" })).toBeTruthy();
    expect(within(table).getByText("/pages/about")).toBeTruthy();
    expect(within(table).getAllByText("Sam").length).toBeGreaterThan(0);
    expect(screen.getByRole("tab", { name: /Archived/ })).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Add page" })).toBeTruthy();
  });

  it("searches after a pause and asks the server with the words", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ContentList kind="page" /></ToastProvider>);
    await screen.findByRole("region", { name: "Pages" });
    await user.type(screen.getByRole("searchbox", { name: "Search pages" }), "deliv");
    await waitFor(() => expect(api.browsePages).toHaveBeenLastCalledWith("store-a", expect.objectContaining({ q: "deliv", state: "active" })));
  });

  it("archives the chosen pages and offers Undo", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ContentList kind="page" /></ToastProvider>);
    const table = await screen.findByRole("region", { name: "Pages" });
    await user.click(within(table).getByRole("checkbox", { name: /Delivery/ }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(api.bulkPages).toHaveBeenCalledWith("store-a", "archive", ["page-1"]));
    await user.click(await screen.findByRole("button", { name: "Undo" }));
    await waitFor(() => expect(api.bulkPages).toHaveBeenLastCalledWith("store-a", "restore", ["page-1"]));
  });

  it("explains what pages are for when there are none", async () => {
    api.browsePages.mockResolvedValue({ items: [], total: 0, counts: { all: 0, active: 0, published: 0, draft: 0, scheduled: 0, archived: 0 }, facets: { authors: [], tags: [] } });
    render(<ToastProvider><ContentList kind="page" /></ToastProvider>);
    expect(await screen.findByText("Add your first page")).toBeTruthy();
    expect(screen.getByText(/Pages hold information that rarely changes/)).toBeTruthy();
  });
});

describe("page editor", () => {
  it("saves a new page as a draft once it has a title, with an address made from it", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ContentItemEditor kind="page" id={null} /></ToastProvider>);
    await user.type(await screen.findByRole("textbox", { name: /Title/ }), "Returns policy");
    await waitFor(() => expect(api.createPage).toHaveBeenCalledWith("store-a", expect.objectContaining({ title: "Returns policy", handle: "returns-policy" })), { timeout: 3000 });
    expect(await screen.findByText("Page saved as a draft")).toBeTruthy();
    expect(window.location.pathname).toBe("/admin/content/pages/page-new");
  });

  it("keeps changes to a live page on this device until Save, then saves only what changed", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ContentItemEditor kind="page" id="page-1" /></ToastProvider>);
    const title = await screen.findByRole("textbox", { name: /Title/ });
    await user.clear(title);
    await user.type(title, "Shipping");
    expect(await screen.findByText("Unsaved changes")).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 1700));
    expect(api.updatePage).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("jelly-content:store-a:page:page-1")).toContain("Shipping");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.updatePage).toHaveBeenCalledWith("store-a", "page-1", { title: "Shipping" }));
  });

  it("autosaves a draft page by itself", async () => {
    api.getPage.mockResolvedValue(page({ status: "DRAFT", publishedAt: null }));
    const user = userEvent.setup();
    render(<ToastProvider><ContentItemEditor kind="page" id="page-1" /></ToastProvider>);
    await user.type(await screen.findByRole("textbox", { name: /Title/ }), " times");
    await waitFor(() => expect(api.updatePage).toHaveBeenCalledWith("store-a", "page-1", { title: "Delivery times" }), { timeout: 3000 });
  });

  it("warns when the web address is taken and fills in the suggestion", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ContentItemEditor kind="page" id="page-1" /></ToastProvider>);
    const handle = await screen.findByRole("textbox", { name: "Handle" });
    await user.clear(handle);
    await user.type(handle, "about");
    expect(await screen.findByText(/already uses “about”/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Use about-2" }));
    expect(handle).toHaveValue("about-2");
  });

  it("offers to restore changes left on this device from an earlier visit", async () => {
    const saved = editableFrom(page());
    window.localStorage.setItem("jelly-content:store-a:page:page-1", JSON.stringify({ value: { ...saved, title: "Unsaved title" }, savedAt: Date.now() - 60_000 }));
    const user = userEvent.setup();
    render(<ToastProvider><ContentItemEditor kind="page" id="page-1" /></ToastProvider>);
    expect(await screen.findByText("You have changes that weren't saved")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restore them" }));
    expect(screen.getByRole("textbox", { name: /Title/ })).toHaveValue("Unsaved title");
  });

  it("archives with Undo from More actions", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><ContentItemEditor kind="page" id="page-1" /></ToastProvider>);
    await screen.findByRole("textbox", { name: /Title/ });
    await user.click(screen.getByRole("button", { name: /More actions/ }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(api.archivePage).toHaveBeenCalledWith("store-a", "page-1"));
    await user.click(await screen.findByRole("button", { name: "Undo archive" }));
    await waitFor(() => expect(api.restorePage).toHaveBeenCalledWith("store-a", "page-1"));
  });
});
