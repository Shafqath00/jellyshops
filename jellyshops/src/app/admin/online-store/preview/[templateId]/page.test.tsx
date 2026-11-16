import { cleanup, render, screen, within } from "@testing-library/react";
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

type Request = { url: string; method: string; body?: Record<string, unknown> };
const requests: Request[] = [];
let existing = false;
let installed = false;
let publishResult: Record<string, unknown> = { ok: true, publication: { id: "pub-1", storeId: "store-1", sourceGeneration: 3 }, diagnostics: [] };
const ownMenu = [{ id: "beds", label: "Beds", target: { kind: "home" }, children: [] }];
const ownSettings = { branding: { logoUrl: "/api/public/media/store-1/logo" }, social: { instagram: "https://instagram.com/little" }, colors: { primary: "#111111" } };

beforeEach(() => {
  existing = false;
  installed = false;
  publishResult = { ok: true, publication: { id: "pub-1", storeId: "store-1", sourceGeneration: 3 }, diagnostics: [] };
  params.templateId = "jelly-avenue";
  requests.length = 0;
  push.mockReset();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    requests.push({ url, method, body: init.body ? JSON.parse(String(init.body)) : undefined });
    if (url.endsWith("/themes")) return Response.json([]);
    if (url.endsWith("/templates")) return Response.json(existing ? [{ id: "home", type: "home", layout: { sections: [] } }] : []);
    if (url.endsWith("/global-sections")) return Response.json([]);
    if (url.endsWith("/menus")) return Response.json(!existing ? [] : installed
      ? [{ id: "new-main", storeId: "store-1", revision: 0, name: "Main menu", handle: "main", items: [{ id: "home" }] }, { id: "old-main", storeId: "store-1", revision: 2, name: "Main menu", handle: "previous-abc", items: ownMenu }]
      : [{ id: "old-main", storeId: "store-1", revision: 1, name: "Main menu", handle: "main", items: ownMenu }]);
    if (url.includes("/menus/") && method === "PATCH") return Response.json({ menu: { id: "new-main" }, generation: 5 });
    if (url.endsWith("/theme-settings")) {
      if (method === "PUT") return Response.json({ theme: { storeId: "store-1", revision: 2, ...JSON.parse(String(init.body)) }, generation: 4 });
      if (installed) return Response.json({ storeId: "store-1", revision: 1, themeId: "jelly-avenue", themeVersion: "1.0.0", settings: { colors: { primary: "#222222" } } });
      return Response.json(existing ? { storeId: "store-1", revision: 4, themeId: "jelly-signature", themeVersion: "1.0.0", settings: ownSettings } : null);
    }
    if (url.includes("/products")) return Response.json({ nodes: [], pageInfo: { hasNextPage: false } });
    if (url.endsWith("/install")) { installed = true; return Response.json({ storeId: "store-1", starterPackId: "jelly-avenue", generation: 1, installed: true }); }
    if (url.endsWith("/publish")) return Response.json(publishResult, { status: publishResult.ok ? 200 : 422 });
    return Response.json({ generation: existing ? 7 : 3, updatedAt: null });
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function useTemplate() {
  const use = await screen.findByRole("button", { name: /Use this template/ });
  await vi.waitFor(() => expect(use).toBeEnabled());
  await userEvent.click(use);
}

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

it("saves the template as a draft without publishing, then offers Customize", async () => {
  render(<TemplatePreviewPage />);
  await useTemplate();
  const ready = await screen.findByRole("dialog", { name: "Avenue is ready" });
  expect(requests.find((request) => request.url.endsWith("/starters/jelly-avenue/install"))?.method).toBe("POST");
  expect(requests.some((request) => request.url.endsWith("/publish"))).toBe(false);
  expect(push).not.toHaveBeenCalled();
  const results = await axe.run(ready, { runOnly: ["wcag2a", "wcag2aa"], rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
  await userEvent.click(within(ready).getByRole("button", { name: "Customize" }));
  expect(push).toHaveBeenCalledWith("/admin/online-store/editor");
});

it("publishes the new draft when asked and links to the live store", async () => {
  render(<TemplatePreviewPage />);
  await useTemplate();
  await userEvent.click(within(await screen.findByRole("dialog", { name: "Avenue is ready" })).getByRole("button", { name: "Publish now" }));
  const live = await screen.findByRole("dialog", { name: "Avenue is live" });
  const publish = requests.find((request) => request.url.endsWith("/publish"));
  expect(publish?.body).toMatchObject({ expectedGeneration: 3 });
  expect(typeof publish?.body?.idempotencyKey).toBe("string");
  expect(within(live).getByRole("link", { name: /View store/ })).toHaveAttribute("href", "/little-things");
});

it("explains what blocks publishing and sends the merchant to the editor", async () => {
  publishResult = { ok: false, diagnostics: [{ code: "MISSING_PRODUCT", severity: "error", message: "The product page needs a product to show." }] };
  render(<TemplatePreviewPage />);
  await useTemplate();
  await userEvent.click(within(await screen.findByRole("dialog", { name: "Avenue is ready" })).getByRole("button", { name: "Publish now" }));
  const blocked = await screen.findByRole("dialog", { name: "A few things need fixing first" });
  expect(blocked).toHaveTextContent("The product page needs a product to show.");
  expect(blocked).not.toHaveTextContent("MISSING_PRODUCT");
  await userEvent.click(within(blocked).getByRole("button", { name: "Fix in the editor" }));
  expect(push).toHaveBeenCalledWith("/admin/online-store/editor");
});

it("asks before switching, and keeps the store's logo, social links and menus", async () => {
  existing = true;
  render(<TemplatePreviewPage />);
  await useTemplate();
  const confirm = await screen.findByRole("dialog", { name: "Switch to Avenue?" });
  expect(requests.some((request) => request.url.endsWith("/install"))).toBe(false);
  expect(within(confirm).getByRole("checkbox", { name: /Keep my logo, social links, languages and menus/ })).toBeChecked();
  await userEvent.click(within(confirm).getByRole("button", { name: "Switch design" }));
  const ready = await screen.findByRole("dialog", { name: "Avenue is ready" });
  expect(ready).toHaveTextContent("Your logo, social links, languages and menus came across.");
  const saved = requests.find((request) => request.url.endsWith("/theme-settings") && request.method === "PUT");
  expect(saved?.body?.settings).toEqual({ colors: { primary: "#222222" }, branding: { logoUrl: expect.stringMatching(/\/api\/public\/media\/store-1\/logo$/) }, social: ownSettings.social });
  const menu = requests.find((request) => request.url.endsWith("/menus/new-main"));
  expect(menu).toMatchObject({ method: "PATCH", body: { expectedRevision: 0, items: ownMenu } });
});

it("can switch without keeping the old logo, links and menus", async () => {
  existing = true;
  render(<TemplatePreviewPage />);
  await useTemplate();
  const confirm = await screen.findByRole("dialog", { name: "Switch to Avenue?" });
  await userEvent.click(within(confirm).getByRole("checkbox", { name: /Keep my logo/ }));
  await userEvent.click(within(confirm).getByRole("button", { name: "Switch design" }));
  const ready = await screen.findByRole("dialog", { name: "Avenue is ready" });
  expect(ready).not.toHaveTextContent("came across");
  expect(requests.some((request) => request.method === "PUT" || request.method === "PATCH")).toBe(false);
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
