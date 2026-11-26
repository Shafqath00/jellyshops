import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe, { type AxeResults } from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import type { ContentListResult, PageResource } from "@/features/content/api/client";
import { ContentEditor } from "@/features/content-editor/content-editor";
import { ImageDialog, LinkDialog, VideoDialog } from "@/features/content-editor/dialogs";
import { MenuBuilder } from "@/features/navigation/components/menu-builder";
import type { LinkResources } from "@/features/navigation/link-check";
import { ContentList } from "./content-list";
import { ContentItemEditor } from "./content-item-editor";

// jsdom has no layout; the rich text editor asks for these.
Range.prototype.getBoundingClientRect = () => ({ x: 0, y: 0, top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, toJSON: () => ({}) });
Range.prototype.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] }) as unknown as DOMRectList;
document.elementFromPoint = () => null;

/** Automated WCAG A/AA checks (axe). Colour contrast needs real layout, so it is checked in the browser. */
/** The whole page is checked (dialogs are drawn outside the render container), so the container argument is optional. */
async function violations(...scope: unknown[]): Promise<string[]> {
  void scope;
  // Radix puts two invisible focus-trap helpers (span[data-radix-focus-guard]) around an open modal; they are part of
  // the library’s focus handling, not content, so they are left out of the check. Everything else is checked.
  const results: AxeResults = await axe.run({ include: [["body"]], exclude: [["[data-radix-focus-guard]"]] }, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] },
    rules: { "color-contrast": { enabled: false }, region: { enabled: false }, "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } },
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).slice(0, 3).join(" | ")}`);
}

const api = vi.hoisted(() => ({} as Record<string, ReturnType<typeof vi.fn>>));
vi.mock("./shared", async (original) => ({
  ...(await original<typeof import("./shared")>()),
  useContentApi: () => ({ api, storeId: "store-a", storeSlug: "shop", media: undefined, listImages: undefined }),
}));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => ({ session: { access_token: "t", user: { email: "sam@example.test" } }, activeStore: { id: "store-a", slug: "shop" } }) }));
vi.mock("@/features/admin/admin-routing", async (original) => ({
  ...(await original<typeof import("@/features/admin/admin-routing")>()),
  useAdminRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useShopAdminHref: () => (href: string) => href,
}));

const page = (patch: Partial<PageResource> = {}): PageResource => ({
  id: "page-1", title: "Delivery", handle: "delivery", status: "PUBLISHED", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "We deliver." }] }] },
  seoTitle: null, seoDescription: null, socialMediaId: null, noindex: false, canonicalOverride: null, authorName: "Sam", authorUserId: "u1",
  updatedAt: new Date().toISOString(), publishedAt: "2026-11-01T10:00:00.000Z", scheduledAt: null, archivedAt: null, ...patch,
});
const listResult = (items: PageResource[]): ContentListResult<PageResource> => ({
  items, total: items.length, counts: { all: 2, active: 2, published: 1, draft: 1, scheduled: 0, archived: 0 }, facets: { authors: [{ id: "u1", name: "Sam" }], tags: [] },
});

beforeEach(() => {
  for (const key of Object.keys(api)) delete api[key];
  Object.assign(api, {
    browsePages: vi.fn(async () => listResult([page(), page({ id: "page-2", title: "About us", handle: "about", status: "DRAFT", publishedAt: null })])),
    getPage: vi.fn(async () => page()),
    listTemplates: vi.fn(async () => []),
    getAssignment: vi.fn(async () => null),
    listBlogs: vi.fn(async () => []),
  });
  window.localStorage.clear();
});
afterEach(cleanup);

describe("accessibility of the content screens", () => {
  it("the pages list", async () => {
    const { container } = render(<ToastProvider><ContentList kind="page" /></ToastProvider>);
    await screen.findByRole("region", { name: "Pages" });
    expect(await violations(container)).toEqual([]);
  });

  it("the empty pages list", async () => {
    api.browsePages.mockResolvedValue({ items: [], total: 0, counts: { all: 0, active: 0, published: 0, draft: 0, scheduled: 0, archived: 0 }, facets: { authors: [], tags: [] } });
    const { container } = render(<ToastProvider><ContentList kind="page" /></ToastProvider>);
    await screen.findByText("Add your first page");
    expect(await violations(container)).toEqual([]);
  });

  it("the page editor with its sidebar", async () => {
    const { container } = render(<ToastProvider><ContentItemEditor kind="page" id="page-1" /></ToastProvider>);
    await screen.findByRole("textbox", { name: "Page content" });
    expect(await violations(container)).toEqual([]);
  });

  it("the rich text editor on its own, including the HTML view", async () => {
    const user = userEvent.setup();
    const { container } = render(<ContentEditor initialValue={{ type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hello" }] }] }} onChange={() => undefined} label="Page content" />);
    await screen.findByRole("textbox", { name: "Page content" });
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Edit HTML" }));
    expect(await violations(container)).toEqual([]);
  });

  // One dialog per test, so each starts from a clean page.
  it("the link dialog", async () => {
    render(<LinkDialog open onOpenChange={() => undefined} initial={null} onApply={() => undefined} />);
    await screen.findByRole("dialog");
    expect(await violations(document.body)).toEqual([]);
  });

  it("the photo dialog", async () => {
    const media = { list: async () => [{ id: "m1", url: "/api/public/media/s/m1", name: "bed.jpg" }] };
    render(<ImageDialog open onOpenChange={() => undefined} media={media} onInsert={() => undefined} />);
    await screen.findByRole("option");
    expect(await violations(document.body)).toEqual([]);
  });

  it("the photo dialog when the store has no photos yet", async () => {
    render(<ImageDialog open onOpenChange={() => undefined} media={{ list: async () => [] }} onInsert={() => undefined} />);
    await screen.findByText("No photos yet. Upload one to use it here.");
    expect(await violations()).toEqual([]);
  });

  it("the video dialog", async () => {
    render(<VideoDialog open onOpenChange={() => undefined} onInsert={() => undefined} />);
    await screen.findByRole("dialog");
    expect(await violations(document.body)).toEqual([]);
  });
});

describe("accessibility of the navigation builder", () => {
  const resources: LinkResources = { ready: true, pages: [{ id: "pg", title: "About", path: "/pages/about", state: "live" }], posts: [], blogs: [], collections: [], products: [] };
  const items = [
    { id: "a", label: "Beds", target: { kind: "home" as const }, children: [{ id: "b", label: "About", target: { kind: "page" as const, resourceId: "pg" }, children: [] }] },
    { id: "c", label: "Old", target: { kind: "page" as const, resourceId: "gone" }, children: [] },
  ];

  it("the tree, with a broken link and with a link's settings open", async () => {
    const user = userEvent.setup();
    const { container } = render(<MenuBuilder items={items} onChange={() => undefined} resources={resources} searchProducts={async () => []} />);
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: /^Old/ }));
    await waitFor(() => expect(screen.getByRole("combobox")).toBeTruthy());
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole("combobox"));
    expect(await violations(container)).toEqual([]);
  });

  it("an empty menu", async () => {
    const { container } = render(<MenuBuilder items={[]} onChange={() => undefined} resources={resources} searchProducts={async () => []} />);
    expect(await violations(container)).toEqual([]);
  });
});
