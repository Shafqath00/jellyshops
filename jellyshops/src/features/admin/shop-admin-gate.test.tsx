import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  current: {
    stores: [] as Array<{ id: string; slug: string; name: string }>,
    activeStore: null as null | { id: string; slug: string; name: string },
    setActiveStoreId: vi.fn(),
    merchantStatus: "ready" as "ready" | "loading" | "error",
    session: { user: { email: "owner@example.test" } },
    signOut: vi.fn(),
  },
}));
const params = vi.hoisted(() => ({ current: { shop: "alpha" } as Record<string, string> }));

vi.mock("next/navigation", () => ({ useParams: () => params.current, usePathname: () => "/admin/s/alpha" }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth: () => auth.current }));

import { ShopAdminGate } from "./shop-admin-gate";

const alpha = { id: "store-a", slug: "alpha", name: "Alpha" };
const beta = { id: "store-b", slug: "beta", name: "Beta" };

beforeEach(() => {
  auth.current.setActiveStoreId.mockClear();
  auth.current.stores = [alpha, beta];
  auth.current.activeStore = alpha;
  auth.current.merchantStatus = "ready";
  params.current = { shop: "alpha" };
});

describe("ShopAdminGate", () => {
  it("shows the shop's pages when the address and the active store match", () => {
    render(<ShopAdminGate><p>Orders page</p></ShopAdminGate>);
    expect(screen.getByText("Orders page")).toBeInTheDocument();
  });

  it("switches the active store to the shop in the address before showing its pages", () => {
    params.current = { shop: "beta" };
    render(<ShopAdminGate><p>Orders page</p></ShopAdminGate>);
    expect(screen.queryByText("Orders page")).not.toBeInTheDocument();
    expect(auth.current.setActiveStoreId).toHaveBeenCalledWith("store-b");
  });

  it("refuses a shop the merchant can't open without saying whether it exists", () => {
    params.current = { shop: "someone-elses-shop" };
    render(<ShopAdminGate><p>Orders page</p></ShopAdminGate>);
    expect(screen.queryByText("Orders page")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "You don't have access to this shop" })).toBeInTheDocument();
    expect(screen.getByText("owner@example.test")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute("href", "/admin/s/beta");
    expect(screen.queryByText(/not found|doesn.t exist/i)).not.toBeInTheDocument();
    expect(auth.current.setActiveStoreId).not.toHaveBeenCalled();
  });

  it("waits while the merchant's shops are loading", () => {
    auth.current.merchantStatus = "loading";
    params.current = { shop: "someone-elses-shop" };
    render(<ShopAdminGate><p>Orders page</p></ShopAdminGate>);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
