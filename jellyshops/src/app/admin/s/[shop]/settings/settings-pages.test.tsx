import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import GeneralSettingsPage from "./general/page";
import ShippingSettingsPage from "./shipping/page";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }));
const refreshMerchant = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("next/navigation", () => ({ useRouter: () => navigation, useParams: () => ({ shop: "jelly-beds" }), usePathname: () => "/admin/s/jelly-beds/settings/general" }));
vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-a" };
  const session = { access_token: "token" };
  return { useAuth: () => ({ activeStore, session, refreshMerchant }), authApiOrigin: () => "http://api.local" };
});
afterEach(() => { vi.unstubAllGlobals(); });

const settings = { id: "store-a", name: "Jelly Beds", slug: "jelly-beds", currency: "GBP", country: "GB", shippingMinor: 499, shippingCopy: "", contactEmail: null, timezone: "Europe/London", revision: 3 };
const stub = () => { const fetchMock = vi.fn((_url: string, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify({ settings: init?.method === "PATCH" ? { ...settings, ...JSON.parse(String(init.body)), revision: 4 } : settings })))); vi.stubGlobal("fetch", fetchMock); return fetchMock; };
const patchBody = (fetchMock: ReturnType<typeof stub>) => JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")![1]!.body));

describe("settings pages", () => {
  it("saves only the delivery fields, in minor units, with the revision", async () => {
    const fetchMock = stub();
    const user = userEvent.setup();
    render(<ShippingSettingsPage />);
    const charge = await screen.findByLabelText("Charge per order (GBP)");
    expect(charge).toHaveValue("4.99");
    await user.clear(charge); await user.type(charge, "abc");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter an amount such as 4.99, or 0 for free delivery.")).toBeVisible();
    await user.clear(charge); await user.type(charge, "0");
    expect(screen.getByText("Delivery is free.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patchBody(fetchMock)).toEqual({ revision: 3, shippingMinor: 0, shippingCopy: "" }));
  });

  it("saves store details without touching delivery", async () => {
    const fetchMock = stub();
    const user = userEvent.setup();
    render(<GeneralSettingsPage />);
    const name = await screen.findByLabelText("Store name");
    await user.clear(name); await user.type(name, "Jelly Sleep");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patchBody(fetchMock)).toEqual({ revision: 3, name: "Jelly Sleep", slug: "jelly-beds", timezone: "Europe/London", contactEmail: null, description: "", category: "", businessType: "" }));
    expect(screen.queryByLabelText(/Flat shipping/)).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("asks before changing the store's address, then opens the settings under the new one", async () => {
    const fetchMock = stub();
    const user = userEvent.setup();
    render(<GeneralSettingsPage />);
    const address = await screen.findByRole("textbox", { name: /Store address/ });
    await user.clear(address); await user.type(address, "jelly-sleep");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Change your store's address?" })).toBeVisible();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Change address" }));
    await waitFor(() => expect(patchBody(fetchMock).slug).toBe("jelly-sleep"));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/admin/s/jelly-sleep/settings/general"));
    expect(refreshMerchant).toHaveBeenCalled();
  });
});
