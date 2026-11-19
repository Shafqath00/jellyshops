import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { expectNoRawCodes } from "@/test/raw-codes";
import { NewStoreForm } from "./new-store-form";
import { newStoreProblems, slugFromName } from "./new-store-api";

const push = vi.fn();
const refreshMerchant = vi.fn(async () => {});
const setActiveStoreId = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-a", country: "GB" };
  const getAccessToken = async () => "token";
  return { useAuth: () => ({ activeStore, getAccessToken, refreshMerchant, setActiveStoreId }), authApiOrigin: () => "http://api.local" };
});
afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); setActiveStoreId.mockReset(); });

describe("new store rules", () => {
  it("makes a web address from the name and explains problems in plain words", () => {
    expect(slugFromName("Express Bed Café")).toBe("express-bed-cafe");
    expect(newStoreProblems({ name: "", slug: "ab", country: "GB", design: "" })).toEqual({ name: "Enter a store name.", slug: "Use 3 to 63 lowercase letters, numbers and single hyphens." });
    expect(newStoreProblems({ name: "Shop", slug: "my-shop", country: "GB", design: "" })).toEqual({});
  });
});

describe("Add another store", () => {
  it("creates the store, installs the chosen design and switches to it", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/availability")) return Promise.resolve(new Response(JSON.stringify({ available: true })));
      if (url.endsWith("/api/stores")) return Promise.resolve(new Response(JSON.stringify({ store: { id: "store-new", slug: "second-shop", name: "Second shop", body: init?.body } }), { status: 201 }));
      return Promise.resolve(new Response(JSON.stringify({ installed: true }), { status: 201 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<NewStoreForm />);
    await user.type(screen.getByLabelText(/Store name/), "Second shop");
    expect(screen.getByLabelText(/Web address/)).toHaveValue("second-shop");
    expect(await screen.findByText("jelly.shop/second-shop is free.")).toBeVisible();
    await user.click(screen.getByRole("radio", { name: /Resthaven/ }));
    await user.click(screen.getByRole("button", { name: "Create store" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin?welcome=1"));
    const create = fetchMock.mock.calls.find(([url]) => url.endsWith("/api/stores"));
    expect(JSON.parse(String(create?.[1]?.body))).toEqual({ name: "Second shop", slug: "second-shop", country: "GB", currency: "GBP" });
    expect(fetchMock).toHaveBeenCalledWith("http://api.local/api/stores/store-new/storefront/starters/jelly-resthaven/install", expect.objectContaining({ method: "POST" }));
    expect(refreshMerchant).toHaveBeenCalled();
    expect(setActiveStoreId).toHaveBeenCalledWith("store-new");
    expectNoRawCodes();
  });

  it("refuses a taken address and shows the server's message when creating fails", async () => {
    const fetchMock = vi.fn((url: string) => url.includes("/availability")
      ? Promise.resolve(new Response(JSON.stringify({ available: false })))
      : Promise.resolve(new Response(JSON.stringify({ error: { code: "STORE_SLUG_TAKEN", message: "That store address is already in use." } }), { status: 409 })));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<NewStoreForm />);
    await user.type(screen.getByLabelText(/Store name/), "Taken");
    expect(await screen.findByText("That web address is taken. Choose another.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create store" }));
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/stores"))).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });
});
