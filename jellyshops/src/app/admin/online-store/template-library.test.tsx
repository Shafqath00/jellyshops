import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import OnlineStorePage from "./page";

const { push, auth } = vi.hoisted(() => ({
  push: vi.fn(),
  auth: { session: { access_token: "merchant-token" }, activeStore: { id: "store-1", name: "Little Things", slug: "little-things" } },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/auth/auth-provider", () => ({ useAuth: () => auth }));

const themes = [{ id: "fresh-market", name: "Fresh Market", version: "1.0.0", description: "Fresh and welcoming", available: true }, { id: "classic", name: "Classic", version: "1.0.0", description: "Timeless essentials", available: true }];
const requests: Array<{ url: string; method: string; body?: Record<string, unknown> }> = [];
let existing = false;
let failLoad = false;
beforeEach(() => {
  existing = false;
  failLoad = false;
  requests.length = 0;
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    requests.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (failLoad) return Response.json({ error: { message: "Unable to reach your store" } }, { status: 503 });
    if (url.endsWith("/themes")) return Response.json(themes);
    if (url.endsWith("/templates")) return Response.json(existing ? [{ id: "home", type: "home", layout: { sections: [] } }] : []);
    if (url.endsWith("/global-sections") || url.endsWith("/menus")) return Response.json([]);
    if (url.endsWith("/theme-settings")) {
      if (init.method === "PUT") {
        const body = JSON.parse(String(init.body));
        return Response.json({ theme: { storeId: "store-1", revision: 5, ...body }, generation: 8 });
      }
      return Response.json(existing ? { storeId: "store-1", revision: 4, themeId: "fresh-market", themeVersion: "1.0.0", settings: { colors: { accent: "#123456" } } } : null);
    }
    if (url.endsWith("/install")) return Response.json({ storeId: "store-1", starterPackId: "fresh-market", generation: 1, installed: true });
    return Response.json({ generation: existing ? 7 : 0, updatedAt: null });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("previews a template without installing it, then installs the chosen template and opens the editor", async () => {
  render(<OnlineStorePage />);
  await userEvent.click(await screen.findByRole("button", { name: "Preview Fresh Market" }));
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("heading", { name: "Fresh Market" })).toBeVisible();
  expect(requests.filter((request) => request.method !== "GET")).toHaveLength(0);
  await userEvent.click(within(dialog).getByRole("button", { name: "Use template" }));
  expect(requests.find((request) => request.url.endsWith("/starters/fresh-market/install"))?.method).toBe("POST");
  expect(push).toHaveBeenCalledWith("/admin/online-store/editor");
});

it("offers continued editing rather than installation for an existing workspace", async () => {
  existing = true;
  render(<OnlineStorePage />);
  expect(await screen.findByRole("link", { name: /Continue editing/i })).toHaveAttribute("href", "/admin/online-store/editor");
  expect(screen.queryByRole("button", { name: /^Use template/ })).not.toBeInTheDocument();
  expect(requests.some((request) => request.url.endsWith("/install"))).toBe(false);
});

it("changes appearance using the latest revision while preserving custom settings", async () => {
  existing = true;
  render(<OnlineStorePage />);
  await userEvent.click(await screen.findByRole("button", { name: "Use Classic" }));
  expect(await screen.findByRole("status")).toHaveTextContent(/Classic/);
  const mutation = requests.find((request) => request.method === "PUT");
  expect(mutation?.body).toMatchObject({ expectedRevision: 4, themeId: "classic", settings: { colors: { accent: "#123456" } } });
  expect(screen.getByRole("button", { name: "Customize Classic" })).toBeEnabled();
});

it("allows retrying a failed gallery load without leaving the page", async () => {
  failLoad = true;
  render(<OnlineStorePage />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to reach your store");
  failLoad = false;
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("button", { name: "Preview Fresh Market" })).toBeEnabled();
});
