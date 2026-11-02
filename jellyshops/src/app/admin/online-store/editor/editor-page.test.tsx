import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

/**
 * Smoke test for the whole editor: the page, its hooks and its views working together against a
 * fake API (load, select, edit, hide a block, save, undo, theme settings and saved looks).
 */
const section = { id: "story", type: "custom-content", enabled: true, settings: { contentAlignment: "center" }, blocks: [
  { id: "title", type: "heading", enabled: true, settings: { text: "Our story" } },
  { id: "cta", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop" } },
] };
const template = { id: "t-home", storeId: "s1", revision: 3, type: "home", handle: "default", name: "Home", layout: { sections: [{ kind: "inline", section }] } };

const api = {
  loadWorkspace: vi.fn(async () => ({ generation: 5, updatedAt: null })),
  listTemplates: vi.fn(async () => [structuredClone(template)]),
  listGlobalSections: vi.fn(async () => []),
  listMenus: vi.fn(async () => []),
  listPresets: vi.fn(async () => []),
  listCatalog: vi.fn(async () => ({ products: [], collections: [] })),
  listPages: vi.fn(async () => []),
  listBlogs: vi.fn(async () => []),
  listArticles: vi.fn(async () => []),
  listThemeCatalog: vi.fn(async () => [{ id: "jelly-signature", name: "Jelly Minimal", version: "1.0.0", description: "", available: true, settingsSchema: [{ id: "colors.accent", type: "color", label: "Accent", default: "#ece7de", group: "Colors" }] }]),
  getThemeConfiguration: vi.fn(async () => ({ storeId: "s1", revision: 0, themeId: "jelly-signature", themeVersion: "1.0.0", settings: {} })),
  listDynamicSources: vi.fn(async () => []),
  listThemeLooks: vi.fn(async () => ({ looks: [{ id: "look-1", name: "Winter", themeId: "jelly-signature", themeVersion: "1.0.0", settings: {}, createdAt: "", updatedAt: "" }] })),
  updateTemplate: vi.fn(async (_store: string, id: string, revision: number, patch: { layout: Record<string, unknown> }) => ({ template: { ...template, id, revision: revision + 1, layout: patch.layout }, generation: 6 })),
  uploadMedia: vi.fn(),
};

vi.mock("@/features/store-editor/api/client", () => ({ createStoreEditorApi: () => api }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => ({ session: { access_token: "token" }, activeStore: { id: "s1", name: "Oak & Ash", slug: "oak" } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import OnlineStoreEditorPage from "./page";

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/admin/online-store/editor");
  window.matchMedia = window.matchMedia ?? (((query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as never);
});

const loaded = async () => {
  render(<OnlineStoreEditorPage />);
  return await screen.findByRole("complementary", { name: "Template hierarchy" }, { timeout: 5000 });
};

it("loads the workspace and shows the page structure, the preview and the empty settings panel", async () => {
  const tree = await loaded();
  expect(api.listTemplates).toHaveBeenCalled();
  expect(within(tree).getByRole("button", { name: "Custom content" })).toBeInTheDocument();
  expect(screen.getByLabelText("Storefront preview", { selector: "main" })).toBeInTheDocument();
  expect(screen.getByText("Select a section to edit")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Theme settings" }).length).toBeGreaterThan(0);
});

it("selects a section, shows its settings, and saves a hidden block through the save queue", async () => {
  const user = userEvent.setup();
  const tree = await loaded();
  await user.click(within(tree).getByRole("button", { name: "Custom content" }));
  expect(await screen.findByText("Section settings")).toBeInTheDocument();
  // Selecting a section opens it in the tree.
  expect(within(tree).getByRole("button", { name: "Collapse Custom content" })).toBeInTheDocument();
  await user.click(within(tree).getByRole("button", { name: /^Hide Button: Shop now/ }));
  await waitFor(() => expect(api.updateTemplate).toHaveBeenCalled(), { timeout: 5000 });
  const [, templateId, revision, patch] = api.updateTemplate.mock.calls[0];
  expect(templateId).toBe("t-home");
  expect(revision).toBe(3);
  const saved = (patch.layout.sections as Array<{ section: { blocks: Array<{ id: string; enabled: boolean }> } }>)[0].section.blocks;
  expect(saved.find((block) => block.id === "cta")?.enabled).toBe(false);
  expect(saved.find((block) => block.id === "title")?.enabled).toBe(true);
  // The tree shows it hidden, and Undo puts it back.
  expect(await within(tree).findByRole("button", { name: /^Show Button: Shop now/ })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Undo last editor change" }));
  await waitFor(() => expect(api.updateTemplate).toHaveBeenCalledTimes(2), { timeout: 5000 });
  const undone = (api.updateTemplate.mock.calls[1][3].layout.sections as Array<{ section: { blocks: Array<{ id: string; enabled: boolean }> } }>)[0].section.blocks;
  expect(undone.find((block) => block.id === "cta")?.enabled).toBe(true);
});

it("opens theme settings with the saved looks panel and the theme's own fields", async () => {
  const user = userEvent.setup();
  await loaded();
  await user.click(screen.getAllByRole("button", { name: "Theme settings" })[0]);
  expect(await screen.findByRole("region", { name: "Saved looks" })).toBeInTheDocument();
  expect(screen.getByText("Winter")).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "Theme settings" })).toBeInTheDocument();
});

it("opens the section library from the tree and lists the sections that can be added", async () => {
  const user = userEvent.setup();
  await loaded();
  await user.click(screen.getByRole("button", { name: "Add section to Template" }));
  expect(await screen.findByRole("button", { name: "Back to sections" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Add section" })).toBeInTheDocument();
});
