import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import axe from "axe-core";
import TemplatePreviewPage from "./page";

const { push, auth, params } = vi.hoisted(() => ({
  push: vi.fn(),
  params: { templateId: "jelly-avenue" },
  auth: { session: { access_token: "merchant-token" }, activeStore: { id: "store-1", name: "Little Things", slug: "little-things", currency: "GBP" } },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useParams: () => params }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => auth, authApiOrigin: () => "http://127.0.0.1:3001" }));

const requests: Array<{ url: string; method: string }> = [];
let existing = false;
beforeEach(() => {
  existing = false;
  params.templateId = "jelly-avenue";
  requests.length = 0;
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    requests.push({ url, method: init.method ?? "GET" });
    if (url.endsWith("/themes")) return Response.json([]);
    if (url.endsWith("/templates")) return Response.json(existing ? [{ id: "home", type: "home", layout: { sections: [] } }] : []);
    if (url.endsWith("/global-sections") || url.endsWith("/menus")) return Response.json([]);
    if (url.endsWith("/theme-settings")) return Response.json(existing ? { storeId: "store-1", revision: 4, themeId: "jelly-signature", themeVersion: "1.0.0", settings: {} } : null);
    if (url.includes("/products")) return Response.json({ nodes: [], pageInfo: { hasNextPage: false } });
    if (url.endsWith("/install")) return Response.json({ storeId: "store-1", starterPackId: "jelly-avenue", generation: 1, installed: true });
    return Response.json({ generation: existing ? 7 : 0, updatedAt: null });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("shows the design full page with page tabs, styles, devices and a way back", async () => {
  render(<TemplatePreviewPage />);
  expect(await screen.findByRole("heading", { name: "Avenue" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Back to templates" })).toHaveAttribute("href", "/admin/online-store");
  for (const page of ["Home", "Collection", "Product", "Cart"]) expect(screen.getByRole("tab", { name: page })).toBeInTheDocument();
  for (const device of ["Desktop", "Tablet", "Mobile"]) expect(screen.getByRole("button", { name: device })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Style" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Desktop" }));
  await userEvent.click(screen.getByRole("tab", { name: "Product" }));
  expect(screen.getByRole("tab", { name: "Product" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByTitle(/Product page, desktop preview/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Mobile" }));
  expect(screen.getByRole("button", { name: "Mobile" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByTitle(/Product page, mobile preview/)).toBeInTheDocument();
  expect(requests.filter((request) => request.method !== "GET")).toHaveLength(0);

  const results = await axe.run(document.querySelector("[data-template-preview] header") as Element, { runOnly: ["wcag2a", "wcag2aa"], rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

it("uses the template for a new store and opens the editor", async () => {
  render(<TemplatePreviewPage />);
  const use = await screen.findByRole("button", { name: /Use this template/ });
  await vi.waitFor(() => expect(use).toBeEnabled());
  await userEvent.click(use);
  expect(requests.find((request) => request.url.endsWith("/starters/jelly-avenue/install"))?.method).toBe("POST");
  expect(push).toHaveBeenCalledWith("/admin/online-store/editor");
});

it("asks before replacing an existing draft", async () => {
  existing = true;
  render(<TemplatePreviewPage />);
  const use = await screen.findByRole("button", { name: /Use this template/ });
  await vi.waitFor(() => expect(use).toBeEnabled());
  await userEvent.click(use);
  expect(await screen.findByRole("dialog", { name: "Switch to Avenue?" })).toBeVisible();
  expect(requests.some((request) => request.url.endsWith("/install"))).toBe(false);
});

it("offers Customize when the design is already the store's own", async () => {
  existing = true;
  params.templateId = "jelly-signature";
  render(<TemplatePreviewPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Customize" }));
  expect(push).toHaveBeenCalledWith("/admin/online-store/editor");
});

it("explains when a design does not exist", async () => {
  params.templateId = "no-such-design";
  render(<TemplatePreviewPage />);
  expect(await screen.findByRole("heading", { name: "This store design does not exist" })).toBeVisible();
});
