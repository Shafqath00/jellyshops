import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NavigationPage from "@/app/admin/online-store/navigation/page";
import { NavigationApiError } from "./api/client";
const mock = vi.hoisted(() => ({ api: { listMenus: vi.fn(), updateMenu: vi.fn(), createMenu: vi.fn() }, editor: { listTemplates: vi.fn(), listGlobalSections: vi.fn() }, all: vi.fn(), token: "one" }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ authApiOrigin: () => "http://api", useAuth: () => ({ activeStore: { id: "a" }, session: { access_token: mock.token } }) }));
vi.mock("@/features/admin/api/catalog-api", () => ({ useAdminCatalog: () => ({ all: mock.all }) }));
vi.mock("./api/client", async original => ({ ...await original<typeof import("./api/client")>(), createNavigationApi: () => ({ ...mock.api }) }));
vi.mock("@/features/store-editor/api/client", () => ({ createStoreEditorApi: () => ({ ...mock.editor }) }));
const main = () => ({ id: "m", storeId: "a", revision: 1, name: "Main", handle: "main", items: [{ id: "one", label: "Home", target: { kind: "home" as const }, children: [] }] });
beforeEach(() => {
  vi.resetAllMocks(); mock.token = "one";
  mock.api.listMenus.mockResolvedValue([main()]);
  mock.editor.listTemplates.mockResolvedValue([{ type: "home", handle: "default", layout: { sections: [{ kind: "global", globalSectionId: "h" }] } }]);
  mock.editor.listGlobalSections.mockResolvedValue([{ id: "h", section: { type: "header", blocks: [{ type: "menu", settings: { handle: "main" } }] } }]);
  mock.all.mockResolvedValue([{ id: "beds-id", title: "Beds", handle: "beds" }]);
});
afterEach(cleanup);
async function editHome() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Edit Home" }));
  await user.clear(screen.getByLabelText("Link label")); await user.type(screen.getByLabelText("Link label"), "Welcome");
  await user.click(screen.getByRole("button", { name: "Apply link" }));
  return user;
}
it("selects the header's menu instead of an earlier similarly named record", async () => {
  mock.api.listMenus.mockResolvedValue([{ ...main(), id: "old", handle: "previous", items: [] }, main()]);
  render(<NavigationPage />);
  expect(await screen.findByRole("button", { name: "Edit Home" })).toBeVisible();
});
it("preserves edits on save failure and retries with the same revision", async () => {
  mock.api.updateMenu.mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce({ menu: { ...main(), revision: 2, items: [{ ...main().items[0], label: "Welcome" }] } });
  render(<NavigationPage />); const user = await editHome();
  await user.click(screen.getByRole("button", { name: "Save menu" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Offline");
  expect(screen.getByRole("button", { name: "Edit Welcome" })).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Save menu" }));
  await screen.findByText(/Menu saved/);
  expect(mock.api.updateMenu.mock.calls.map(call => call[2])).toEqual([1, 1]);
});
it("keeps a conflicted draft until the user explicitly reloads", async () => {
  mock.api.updateMenu.mockRejectedValue(new NavigationApiError("Changed elsewhere", 409));
  render(<NavigationPage />); const user = await editHome();
  await user.click(screen.getByRole("button", { name: "Save menu" }));
  const reload = await screen.findByRole("button", { name: "Reload saved menus" });
  expect(screen.getByRole("button", { name: "Edit Welcome" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Save menu" })).toBeDisabled();
  await user.click(reload); await screen.findByRole("button", { name: "Edit Home" });
});
it("retains an unsaved draft when authentication refreshes", async () => {
  const { rerender } = render(<NavigationPage />); await editHome();
  mock.token = "two"; rerender(<NavigationPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Edit Welcome" })).toBeVisible());
  expect(mock.api.listMenus).toHaveBeenCalledTimes(1);
});
it("creates a usable menu from an empty navigation workspace", async () => {
  mock.api.listMenus.mockResolvedValue([]);
  mock.api.createMenu.mockResolvedValue({ menu: { ...main(), items: [] } });
  render(<NavigationPage />); const user = userEvent.setup();
  await screen.findByText(/No navigation menus yet/);
  await user.click(screen.getByRole("button", { name: "Create menu" }));
  await user.type(screen.getByLabelText("Menu name"), "Main"); await user.type(screen.getByLabelText("Menu handle"), "main");
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByRole("button", { name: "Add link" })).toBeVisible();
});
