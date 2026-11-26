import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultStorePreferences, type StorePreferences } from "@jelly/storefront-schema";
import { ToastProvider } from "@/components/admin";
import { imageAdvice, imageFileProblem } from "./cards/sharing-card";
import { extractTrackingId } from "./cards/tracking-card";
import { policyTemplate } from "./policy-templates";
import { StorePreferencesPage } from "./preferences-page";
import { RedirectsManager } from "./redirects-manager";
import { setAt } from "./use-preferences-form";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useParams: () => ({ shop: "harbour" }), usePathname: () => "/admin/s/harbour/settings/preferences" }));
vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-a", slug: "harbour", name: "Harbour" };
  const session = { access_token: "token" };
  return { useAuth: () => ({ activeStore, session }), authApiOrigin: () => "http://api.local" };
});
afterEach(() => { vi.unstubAllGlobals(); });

const settings = { id: "store-a", name: "Harbour", slug: "harbour", currency: "GBP", country: "GB", shippingMinor: 0, shippingCopy: "", contactEmail: "hello@harbour.test", timezone: "Europe/London", revision: 1 };
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

function stubApi(options: { saveStatus?: number; saveBody?: unknown } = {}) {
  let stored: { preferences: StorePreferences; revision: number } = { preferences: defaultStorePreferences(), revision: 2 };
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/preferences") && init?.method === "PUT") {
      if (options.saveStatus) return json(options.saveBody, options.saveStatus);
      const body = JSON.parse(String(init.body));
      stored = { preferences: body.preferences, revision: stored.revision + 1 };
      return json({ available: true, ...stored, updatedAt: "2026-11-26T10:00:00.000Z" });
    }
    if (path.endsWith("/preferences")) return json({ available: true, ...stored, updatedAt: null });
    if (path.endsWith("/preferences/history")) return json({ changes: [{ id: "c1", at: "2026-11-26T09:00:00.000Z", actorName: "Sam", sections: ["seo", "tracking"] }] });
    if (path.endsWith("/settings")) return json({ settings });
    if (path.includes("/content/pages")) return json([{ id: "p1", title: "Privacy policy", handle: "privacy", status: "PUBLISHED" }, { id: "p2", title: "Returns", handle: "returns", status: "DRAFT" }]);
    if (path.endsWith("/redirects")) return json({ redirects: [{ id: "r1", from: "/old-beds", to: "/collections/beds", createdAt: "2026-11-26T09:00:00.000Z" }], total: 1, available: true });
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const putBody = (fetchMock: ReturnType<typeof stubApi>) => JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")![1]!.body));
const page = () => render(<ToastProvider><StorePreferencesPage /></ToastProvider>);

describe("Store preferences page", () => {
  it("shows the save bar only after a change, previews it, and saves with the revision", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    page();
    const title = await screen.findByRole("textbox", { name: /^Homepage title/ });
    expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull();
    await user.type(title, "Oak beds made in Devon");
    expect(screen.getByText("22 of 70 characters")).toBeVisible();
    expect(within(screen.getByRole("group", { name: "Search result preview" })).getByText("Oak beds made in Devon")).toBeVisible();
    const bar = screen.getByRole("region", { name: "Unsaved changes" });
    await user.click(within(bar).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(putBody(fetchMock)).toMatchObject({ revision: 2, preferences: { seo: { homeTitle: "Oak beds made in Devon" } } }));
    expect(await screen.findByText("Preferences saved")).toBeVisible();
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull());
  });

  it("discards changes", async () => {
    stubApi();
    const user = userEvent.setup();
    page();
    const title = await screen.findByRole("textbox", { name: /^Homepage title/ });
    await user.type(title, "Something");
    await user.click(within(screen.getByRole("region", { name: "Unsaved changes" })).getByRole("button", { name: "Discard" }));
    expect(title).toHaveValue("");
  });

  it("explains problems next to the field and refuses to send them", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    page();
    const pixel = await screen.findByRole("textbox", { name: /^Meta Pixel ID/ });
    await user.type(pixel, "abc");
    expect(await screen.findByText("A Meta Pixel ID is a number of 8 to 20 digits.")).toBeVisible();
    expect(pixel).toHaveAttribute("aria-invalid", "true");
    await user.click(within(screen.getByRole("region", { name: "Unsaved changes" })).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("One setting needs fixing before you can save.")).toBeVisible();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(false);
  });

  it("keeps only the ID when a whole tracking snippet is pasted", async () => {
    stubApi();
    const user = userEvent.setup();
    page();
    const ga = await screen.findByRole("textbox", { name: /^Google Analytics 4 measurement ID/ });
    await user.click(ga);
    await user.paste("<script async src=\"https://www.googletagmanager.com/gtag/js?id=G-AB12CD34EF\"></script>");
    expect(ga).toHaveValue("G-AB12CD34EF");
  });

  it("shows the server's field problems and the conflict banner", async () => {
    stubApi({ saveStatus: 409, saveBody: { error: { code: "PREFERENCES_REVISION_CONFLICT", message: "These preferences were changed in another window. Reload to see the latest before saving.", currentRevision: 5 } } });
    const user = userEvent.setup();
    page();
    await user.type(await screen.findByRole("textbox", { name: /^Homepage title/ }), "Harbour");
    await user.click(within(screen.getByRole("region", { name: "Unsaved changes" })).getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Changed somewhere else")).toBeVisible();
  });

  it("lists policy pages with their state and the change history", async () => {
    stubApi();
    page();
    const privacy = await screen.findByLabelText("Page for the privacy policy");
    await waitFor(() => expect(privacy).toHaveValue("privacy"));
    await waitFor(() => expect(screen.getAllByText("Published").length).toBeGreaterThan(0));
    expect(screen.getByText("Shoppers can't see this page yet. Publish it to link it from your footer and checkout.")).toBeVisible();
    expect(screen.getAllByText("Page missing")).toHaveLength(2);
    expect(await screen.findByText(/changed Search and sharing, Tracking/)).toBeVisible();
  });

  it("has no accessibility problems (contrast checked in the browser)", async () => {
    stubApi();
    const { container } = page();
    await screen.findByRole("textbox", { name: /^Homepage title/ });
    await screen.findByText(/changed Search and sharing/);
    const result = await axe.run(container, { runOnly: ["wcag2a", "wcag2aa", "best-practice"], rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});

describe("URL redirects page", () => {
  it("lists redirects and checks a new one before sending it", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    render(<ToastProvider><RedirectsManager /></ToastProvider>);
    expect(await screen.findByRole("button", { name: "/old-beds" })).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Add redirect" })[0]);
    await user.type(screen.getByRole("textbox", { name: /^Old address/ }), "/checkout");
    await user.type(screen.getByLabelText("Send shoppers to"), "/collections/beds");
    await user.click(screen.getByRole("button", { name: "Add redirect", hidden: false }));
    expect(await screen.findByText("This address is always a page on your store, so it can't be redirected.")).toBeVisible();
    expect(fetchMock.mock.calls.some(([url, init]) => String(url).endsWith("/redirects") && init?.method === "POST")).toBe(false);
  });
});

describe("helpers", () => {
  it("sets nested values without changing the original", () => {
    const before = defaultStorePreferences();
    const after = setAt(before, "seo.structuredData.products", false);
    expect(after.seo.structuredData.products).toBe(false);
    expect(before.seo.structuredData.products).toBe(true);
  });
  it("pulls tracking IDs out of snippets", () => {
    expect(extractTrackingId("gtm", "https://www.googletagmanager.com/ns.html?id=GTM-ABC1234")).toBe("GTM-ABC1234");
    expect(extractTrackingId("pixel", "fbq('init', '123456789012345');")).toBe("123456789012345");
    expect(extractTrackingId("ga", "not an id")).toBe("not an id");
  });
  it("checks photo files and gives advice on shape and size", () => {
    expect(imageFileProblem("favicon", { type: "image/jpeg", size: 1000 })).toBe("Use a PNG, WebP or GIF file.");
    expect(imageFileProblem("social", { type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/too large/);
    expect(imageAdvice("favicon", { width: 64, height: 32 })).toMatch(/isn't square/);
    expect(imageAdvice("social", { width: 1200, height: 630 })).toBeNull();
    expect(imageAdvice("social", { width: 800, height: 420 })).toMatch(/800 pixels wide/);
  });
  it("fills policy templates with the business details", () => {
    const doc = policyTemplate("privacy", { storeName: "Harbour", legalName: "Harbour Home Ltd", email: "hi@harbour.test", address: "1 Quay St, Bristol" });
    const text = JSON.stringify(doc);
    expect(text).toContain("Harbour Home Ltd");
    expect(text).toContain("hi@harbour.test");
    expect(text).toContain("1 Quay St, Bristol");
  });
});
