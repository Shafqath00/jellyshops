import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { StoreEditorApiError } from "@/features/store-editor/api/types";

const { api, useAuth, router } = vi.hoisted(() => ({
  api: {
    installStarterPack: vi.fn(), listThemeCatalog: vi.fn(), getThemeConfiguration: vi.fn(), saveThemeConfiguration: vi.fn(), publish: vi.fn(),
  },
  useAuth: vi.fn(),
  router: { push: vi.fn() },
}));

vi.mock("@/features/auth/auth-provider", () => ({ useAuth }));
vi.mock("@/features/store-editor/api/client", () => ({ createStoreEditorApi: () => api }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import OnlineStorePage from "./page";

const catalog = [
  { id: "api-one", name: "API One", version: "2.0.0", description: "Loaded from catalog", previewAsset: "/themes/api-one/preview.svg", available: true },
  { id: "api-two", name: "API Two", version: "3.0.0", description: "Another catalog theme", available: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ session: { access_token: "token" }, activeStore: { id: "store-a", slug: "store-a" } });
  api.listThemeCatalog.mockResolvedValue(catalog);
  api.installStarterPack.mockResolvedValue({ storeId: "store-a", starterPackId: "fresh-market", starterPackVersion: "1.0.0", generation: 1, installed: true });
  api.getThemeConfiguration.mockResolvedValue({ storeId: "store-a", revision: 4, themeId: "api-one", themeVersion: "2.0.0", settings: { colors: { accent: "#123456" } }, draftArtifactId: "artifact-a" });
  api.saveThemeConfiguration.mockResolvedValue({ theme: { storeId: "store-a", revision: 5, themeId: "api-two", themeVersion: "3.0.0", settings: { colors: { accent: "#123456" } }, draftArtifactId: "artifact-a" }, generation: 9 });
});

it("installs the chosen starter before opening the editor without saving a theme separately", async () => {
  const user = userEvent.setup();
  render(<OnlineStorePage />);
  await user.click(await screen.findByRole("button", { name: "Start with Fresh Market" }));
  await waitFor(() => expect(api.installStarterPack).toHaveBeenCalledWith("store-a", "fresh-market"));
  expect(router.push).toHaveBeenCalledWith("/admin/online-store/editor");
  expect(api.saveThemeConfiguration).not.toHaveBeenCalled();
});

it("shows a recoverable starter installation conflict and remains on the chooser", async () => {
  const user = userEvent.setup();
  api.installStarterPack.mockRejectedValueOnce(new StoreEditorApiError(409, "STARTER_INSTALL_CONFLICT", "This store already has a custom workspace."));
  render(<OnlineStorePage />);
  const button = await screen.findByRole("button", { name: "Start with Fresh Market" });
  await user.click(button);
  expect(await screen.findByRole("alert")).toHaveTextContent("already has a custom workspace");
  expect(button).toBeEnabled();
  expect(router.push).not.toHaveBeenCalled();
});

it("renders catalog themes and marks the configured theme selected", async () => {
  render(<OnlineStorePage />);
  expect(await screen.findByRole("heading", { name: "API One" })).toBeVisible();
  expect(screen.getByText("Loaded from catalog")).toBeVisible();
  expect(screen.getByText("Version 2.0.0")).toBeVisible();
  expect(screen.getAllByText("Selected")).toHaveLength(2);
});

it("saves catalog id and version with the current revision and preserved settings", async () => {
  const user = userEvent.setup(); render(<OnlineStorePage />);
  await user.click(await screen.findByRole("button", { name: "Use this theme" }));
  await waitFor(() => expect(api.saveThemeConfiguration).toHaveBeenCalledWith("store-a", 4, {
    themeId: "api-two", themeVersion: "3.0.0", settings: { colors: { accent: "#123456" } }, draftArtifactId: "artifact-a",
  }));
  expect(await screen.findByText(/API Two is selected/)).toBeVisible();
  expect(api.publish).not.toHaveBeenCalled();
});

it("shows unavailable configured themes without saving on load", async () => {
  api.getThemeConfiguration.mockResolvedValue({ storeId: "store-a", revision: 4, themeId: "removed-theme", themeVersion: "1.0.0", settings: {}, draftArtifactId: null });
  render(<OnlineStorePage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("removed-theme");
  expect(api.saveThemeConfiguration).not.toHaveBeenCalled();
  expect(screen.getAllByRole("button", { name: "Use this theme" })[0]).toBeEnabled();
});

it("surfaces catalog and save failures", async () => {
  api.listThemeCatalog.mockRejectedValueOnce(new Error("catalog offline"));
  render(<OnlineStorePage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("catalog offline");
});

it("prevents duplicate theme saves while a selection is pending", async () => {
  const user = userEvent.setup(); let resolveSave: (value: unknown) => void = () => undefined;
  api.saveThemeConfiguration.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
  render(<OnlineStorePage />);
  const button = await screen.findByRole("button", { name: "Use this theme" });
  await user.click(button); await user.click(button);
  expect(api.saveThemeConfiguration).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  resolveSave({ theme: { storeId: "store-a", revision: 5, themeId: "api-two", themeVersion: "3.0.0", settings: {}, draftArtifactId: null }, generation: 9 });
  expect(await screen.findByText(/API Two is selected/)).toBeVisible();
});

it("recovers from a rejected pending theme save and allows another selection", async () => {
  const user = userEvent.setup(); let rejectSave: (reason: unknown) => void = () => undefined;
  api.saveThemeConfiguration.mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject; }));
  render(<OnlineStorePage />);
  const button = await screen.findByRole("button", { name: "Use this theme" });
  await user.click(button);
  expect(button).toBeDisabled();
  rejectSave(new StoreEditorApiError(409, "STOREFRONT_REVISION_CONFLICT", "Theme settings were changed by another editor", undefined, 5));
  expect(await screen.findByRole("alert")).toHaveTextContent("Theme settings were changed by another editor");
  expect(button).toBeEnabled();
  expect(screen.getAllByText("Selected")).toHaveLength(2);
  await user.click(button);
  await waitFor(() => expect(api.saveThemeConfiguration).toHaveBeenCalledTimes(2));
});

it("surfaces revision conflicts without changing the selected theme", async () => {
  const user = userEvent.setup();
  api.saveThemeConfiguration.mockRejectedValueOnce(new StoreEditorApiError(409, "STOREFRONT_REVISION_CONFLICT", "Theme settings were changed by another editor", undefined, 5));
  render(<OnlineStorePage />);
  await user.click(await screen.findByRole("button", { name: "Use this theme" }));
  await waitFor(() => expect(api.saveThemeConfiguration).toHaveBeenCalledWith("store-a", 4, expect.any(Object)));
  expect(await screen.findByRole("alert")).toHaveTextContent("Theme settings were changed by another editor");
  expect(screen.getAllByText("Selected")).toHaveLength(2);
});

it("renders an empty catalog without offering saves", async () => {
  api.listThemeCatalog.mockResolvedValueOnce([]);
  render(<OnlineStorePage />);
  expect(await screen.findByText("No themes are available for this store.")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Use this theme" })).not.toBeInTheDocument();
  expect(api.saveThemeConfiguration).not.toHaveBeenCalled();
});
