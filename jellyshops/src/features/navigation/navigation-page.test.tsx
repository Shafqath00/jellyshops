import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import NavigationPage from "@/app/admin/s/[shop]/content/menus/page";
import { describeTarget, linkProblem, menuIssues, productIds, type LinkResources } from "./link-check";
import { typedTarget } from "./components/link-picker";

const mock = vi.hoisted(() => ({
  api: { listMenus: vi.fn(), updateMenu: vi.fn(), createMenu: vi.fn(), publishCheck: vi.fn() },
  editor: { listTemplates: vi.fn(), listGlobalSections: vi.fn(), loadWorkspace: vi.fn(), publish: vi.fn(), uploadMedia: vi.fn() },
  content: { listPages: vi.fn(), listBlogs: vi.fn(), listArticles: vi.fn() },
  catalog: { all: vi.fn(), request: vi.fn() },
}));
vi.mock("@/features/auth/providers/auth-provider", () => ({ authApiOrigin: () => "http://api", useAuth: () => ({ activeStore: { id: "a", slug: "shop" }, session: { access_token: "t" } }) }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ ...mock.catalog, ready: true, storeId: "a" }) }));
vi.mock("./api/client", async (original) => ({ ...await original<typeof import("./api/client")>(), createNavigationApi: () => mock.api }));
vi.mock("@/features/store-editor/api/client", () => ({ createStoreEditorApi: () => mock.editor }));
vi.mock("@/features/content/api/client", async (original) => ({ ...await original<typeof import("@/features/content/api/client")>(), createContentApi: () => mock.content }));
vi.mock("@/features/admin/admin-routing", async (original) => ({ ...await original<typeof import("@/features/admin/admin-routing")>(), useAdminRouter: () => ({ push: vi.fn() }) }));

const menu = () => ({
  id: "m", storeId: "a", revision: 1, name: "Main menu", handle: "main",
  items: [
    { id: "beds", label: "Beds", target: { kind: "collection" as const, resourceId: "col-beds" }, children: [{ id: "about", label: "About", target: { kind: "page" as const, resourceId: "page-about" }, children: [] }] },
    { id: "gone", label: "Old sale", target: { kind: "page" as const, resourceId: "page-deleted" }, children: [] },
  ],
});

beforeEach(() => {
  vi.resetAllMocks();
  mock.api.listMenus.mockResolvedValue([menu()]);
  mock.api.updateMenu.mockImplementation(async (_store: string, _id: string, _revision: number, patch: { items: unknown[] }) => ({ menu: { ...menu(), revision: 2, items: patch.items }, generation: 8 }));
  mock.api.publishCheck.mockResolvedValue({ ok: true, live: true, menus: ["main"], design: false });
  mock.editor.listTemplates.mockResolvedValue([{ type: "home", handle: "default", layout: { sections: [{ kind: "global", globalSectionId: "h" }] } }]);
  mock.editor.listGlobalSections.mockResolvedValue([{ id: "h", section: { type: "header", blocks: [{ type: "menu", settings: { handle: "main" } }] } }]);
  mock.editor.loadWorkspace.mockResolvedValue({ generation: 8, updatedAt: null });
  mock.editor.publish.mockResolvedValue({ ok: true, diagnostics: [] });
  mock.content.listPages.mockResolvedValue([{ id: "page-about", title: "About us", handle: "about", status: "PUBLISHED" }, { id: "page-draft", title: "Secret", handle: "secret", status: "DRAFT" }]);
  mock.content.listBlogs.mockResolvedValue([]);
  mock.content.listArticles.mockResolvedValue([]);
  mock.catalog.all.mockResolvedValue([{ id: "col-beds", title: "All beds", handle: "beds" }]);
  mock.catalog.request.mockResolvedValue({ nodes: [], nextCursor: null });
});
afterEach(cleanup);

const renderPage = () => render(<ToastProvider><NavigationPage /></ToastProvider>);

describe("link checks", () => {
  const resources: LinkResources = {
    ready: true, blogs: [], posts: [], products: [{ id: "p1", title: "Oak bed", path: "/products/oak", state: "draft" }], collections: [],
    pages: [{ id: "pg", title: "About", path: "/pages/about", state: "live" }, { id: "arch", title: "Old", path: "/pages/old", state: "archived" }],
  };
  it("says what a link points to and why shoppers couldn't open it", () => {
    expect(describeTarget({ kind: "page", resourceId: "pg" }, resources)).toBe("Page: About");
    expect(linkProblem({ kind: "page", resourceId: "pg" }, resources)).toBeNull();
    expect(linkProblem({ kind: "page", resourceId: "nope" }, resources)).toContain("was deleted");
    expect(linkProblem({ kind: "page", resourceId: "arch" }, resources)).toContain("archived");
    expect(linkProblem({ kind: "product", resourceId: "p1" }, resources)).toContain("isn't published");
    expect(linkProblem({ kind: "external", url: "javascript:alert(1)" }, resources)).toContain("isn't valid");
    expect(linkProblem({ kind: "page", resourceId: "nope" }, { ...resources, ready: false })).toBeNull();
  });
  it("lists every problem in a menu and the products it points to", () => {
    const items = [{ id: "a", label: "A", target: { kind: "product" as const, resourceId: "p1" }, children: [{ id: "b", label: "B", target: { kind: "page" as const, resourceId: "nope" }, children: [] }] }];
    expect(menuIssues(items, resources).map((issue) => issue.id)).toEqual(["a", "b"]);
    expect(productIds(items)).toEqual(["p1"]);
  });
  it("reads typed destinations", () => {
    expect(typedTarget("example.com/shop")).toEqual({ kind: "external", url: "https://example.com/shop" });
    expect(typedTarget("/pages/faq")).toEqual({ kind: "external", url: "/pages/faq" });
    expect(typedTarget("#reviews")).toEqual({ kind: "anchor", anchor: "reviews" });
    expect(typedTarget("beds")).toBeNull();
  });
});

describe("navigation page", () => {
  it("shows the header menu with its nested links, where it is used and a warning for a broken link", async () => {
    renderPage();
    const tree = await screen.findByRole("list", { name: "Links in this menu" });
    expect(within(tree).getByText("Beds")).toBeTruthy();
    expect(within(tree).getByText("Page: About us")).toBeTruthy();
    expect(screen.getByText(/Header · 3 links/)).toBeTruthy();
    expect(await screen.findByText("1 link won't work for shoppers")).toBeTruthy();
    expect(screen.getByText(/Old sale:/)).toBeTruthy();
  });

  it("moves links with the buttons and saves them in their new order", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("list", { name: "Links in this menu" });
    await user.click(screen.getByRole("button", { name: "Move Old sale into the link above" }));
    await user.click(screen.getByRole("button", { name: "Move Old sale up" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mock.api.updateMenu).toHaveBeenCalled());
    const saved = mock.api.updateMenu.mock.calls[0]![3].items as Array<{ id: string; children: Array<{ id: string }> }>;
    expect(saved.map((item) => item.id)).toEqual(["beds"]);
    expect(saved[0]!.children.map((item) => item.id)).toEqual(["gone", "about"]);
  });

  it("adds a link and picks its destination by searching, taking the page's name", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("list", { name: "Links in this menu" });
    await user.click(screen.getByRole("button", { name: "Add link" }));
    const picker = screen.getByRole("combobox");
    await user.type(picker, "about");
    await user.click(await screen.findByRole("option", { name: /About us/ }));
    expect(screen.getByLabelText(/^Name/)).toHaveValue("About us");
  });

  it("publishes only the menus when nothing else in the design changed", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("list", { name: "Links in this menu" });
    await user.click(screen.getByRole("button", { name: "Publish menu changes" }));
    await waitFor(() => expect(mock.editor.publish).toHaveBeenCalledWith("a", 8, "menus-a-8"));
    expect(await screen.findByText("Menu changes are live on your store")).toBeTruthy();
  });

  it("asks before publishing when the store design has other unpublished changes", async () => {
    mock.api.publishCheck.mockResolvedValue({ ok: true, live: true, menus: ["main"], design: true });
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("list", { name: "Links in this menu" });
    await user.click(screen.getByRole("button", { name: "Publish menu changes" }));
    expect(await screen.findByText("Publish your store design too?")).toBeTruthy();
    expect(mock.editor.publish).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Publish everything" }));
    await waitFor(() => expect(mock.editor.publish).toHaveBeenCalled());
  });
});
