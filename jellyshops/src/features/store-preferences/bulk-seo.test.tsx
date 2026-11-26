import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import { bulkProblems, currentValue, needsWork, toPatch, withEdit, type BulkRow } from "./bulk-seo";
import { BulkSeoEditor } from "./bulk-seo-editor";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  browsePages: vi.fn(),
  browseArticles: vi.fn(),
  updatePage: vi.fn(async () => ({})),
  updateArticle: vi.fn(async () => ({})),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }), useParams: () => ({ shop: "harbour" }), usePathname: () => "/admin/s/harbour/settings/preferences/seo" }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ request: mocks.request, ready: true, storeId: "store-a", all: vi.fn() }) }));
vi.mock("@/features/content-admin/shared", () => ({
  useContentApi: () => ({ api: { browsePages: mocks.browsePages, browseArticles: mocks.browseArticles, updatePage: mocks.updatePage, updateArticle: mocks.updateArticle }, storeId: "store-a", storeSlug: "harbour" }),
}));

const row = (extra: Partial<BulkRow> = {}): BulkRow => ({ key: "product:p1", kind: "product", id: "p1", name: "Oak bed", fallbackTitle: "Oak bed", fallbackDescription: "", seoTitle: "", seoDescription: "", status: "ACTIVE", ...extra });

describe("bulk SEO rules", () => {
  it("blocks over-long text and angle brackets, and says how many characters too many", () => {
    expect(bulkProblems({ seoTitle: "x".repeat(75), seoDescription: "ok" })).toEqual({ title: "5 too many characters. Keep it to 70." });
    expect(bulkProblems({ seoTitle: "fine", seoDescription: "<b>" })).toEqual({ description: "Remove the < and > characters." });
    expect(bulkProblems({ seoTitle: "fine", seoDescription: "fine" })).toEqual({});
  });
  it("knows which rows need work", () => {
    expect(needsWork(row())).toBe(true);
    expect(needsWork(row({ fallbackDescription: "Solid oak." }))).toBe(false);
    expect(needsWork(row({ seoDescription: "Great bed." }))).toBe(false);
    expect(needsWork(row({ seoDescription: "x".repeat(161) }))).toBe(true);
  });
  it("keeps an edit only while it differs from what is saved, and sends empty as 'clear'", () => {
    const r = row({ seoTitle: "Saved" });
    const edited = withEdit(new Map(), r, { seoTitle: "New" });
    expect(currentValue(r, edited)).toEqual({ seoTitle: "New", seoDescription: "" });
    expect(withEdit(edited, r, { seoTitle: "Saved" }).size).toBe(0);
    expect(toPatch({ seoTitle: "  ", seoDescription: " Text " })).toEqual({ seoTitle: null, seoDescription: "Text" });
  });
});

describe("Bulk SEO editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.request.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return {};
      return { nodes: [
        { id: "p1", title: "Oak bed", description: "Solid oak frame.", status: "ACTIVE", seoTitle: null, seoDescription: null },
        { id: "p2", title: "Pine bed", description: "", status: "ACTIVE", seoTitle: "Pine", seoDescription: null },
        { id: "p3", title: "Old bed", description: "", status: "ARCHIVED", seoTitle: null, seoDescription: null },
      ], nextCursor: null };
    });
    mocks.browsePages.mockResolvedValue({ items: [{ id: "g1", title: "About us", status: "PUBLISHED", seoTitle: null, seoDescription: null }], total: 1, counts: {} });
    mocks.browseArticles.mockResolvedValue({ items: [{ id: "a1", title: "First post", excerpt: "A summary.", status: "PUBLISHED", seoTitle: null, seoDescription: null }], total: 1, counts: {} });
  });
  const open = () => render(<ToastProvider><BulkSeoEditor /></ToastProvider>);

  it("lists live products, saves only what changed, and clears the save bar", async () => {
    const user = userEvent.setup();
    open();
    const title = await screen.findByLabelText("Search title for Oak bed");
    expect(screen.queryByText("Old bed")).toBeNull();
    expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull();
    await user.type(title, "Solid oak bed | Harbour");
    await user.type(screen.getByLabelText("Search description for Pine bed"), "A pine bed.");
    const bar = screen.getByRole("region", { name: "Unsaved changes" });
    await user.click(within(bar).getByRole("button", { name: "Save 2 changes" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull());
    const patches = mocks.request.mock.calls.filter(([, init]) => init?.method === "PATCH").map(([path, init]) => [path, JSON.parse(String(init.body))]);
    expect(patches).toEqual([
      ["/products/p1", { seoTitle: "Solid oak bed | Harbour", seoDescription: null }],
      ["/products/p2", { seoTitle: "Pine", seoDescription: "A pine bed." }],
    ]);
    expect(await screen.findByText("2 items saved")).toBeVisible();
  });

  it("refuses to save text that is too long and tells the owner which box", async () => {
    const user = userEvent.setup();
    open();
    const description = await screen.findByLabelText("Search description for Oak bed");
    await user.click(description);
    await user.paste("x".repeat(170));
    expect(await screen.findByText("10 too many characters. Keep it to 160.")).toBeVisible();
    await user.click(within(screen.getByRole("region", { name: "Unsaved changes" })).getByRole("button", { name: /Save/ }));
    expect(await screen.findByText("1 row has text that is too long. Fix it first.")).toBeVisible();
    expect(mocks.request.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  });

  it("shows only rows that need work on request, and keeps edits when switching tabs", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByLabelText("Search title for Oak bed");
    await user.click(screen.getByRole("checkbox", { name: "Only show ones that need work" }));
    expect(screen.queryByLabelText("Search title for Oak bed")).toBeNull();   // it has a description to fall back on
    expect(screen.getByLabelText("Search title for Pine bed")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Only show ones that need work" }));
    await user.type(screen.getByLabelText("Search title for Oak bed"), "Edited");
    await user.click(screen.getByRole("tab", { name: /Pages/ }));
    await user.type(await screen.findByLabelText("Search description for About us"), "Who we are.");
    await user.click(screen.getByRole("tab", { name: /Products/ }));
    expect(screen.getByLabelText("Search title for Oak bed")).toHaveValue("Edited");
    await user.click(within(screen.getByRole("region", { name: "Unsaved changes" })).getByRole("button", { name: "Save 2 changes" }));
    await waitFor(() => expect(mocks.updatePage).toHaveBeenCalledWith("store-a", "g1", { seoTitle: null, seoDescription: "Who we are." }));
  });

  it("has no accessibility problems", async () => {
    const { container } = open();
    await screen.findByLabelText("Search title for Oak bed");
    const result = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "best-practice"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});
