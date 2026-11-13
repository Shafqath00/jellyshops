import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { customerSupabase } = vi.hoisted(() => ({ customerSupabase: vi.fn() }));
vi.mock("@/features/auth/lib/supabase-clients", () => ({ customerSupabase, supabaseConfigured: true }));
vi.mock("next/navigation", () => ({ useParams: () => ({ storeSlug: "shop" }) }));
vi.mock("@/contexts/shop-context", () => ({ useShop: () => ({ repository: { getStoreBySlug: () => undefined } }) }));

import { CustomerProvider, useCustomer } from "./customer-provider";

function Status() {
  const { loading, session } = useCustomer();
  return <p>{loading ? "loading" : session ? "signed in" : "guest"}</p>;
}

function fakeClient() {
  return {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      getSession: async () => ({ data: { session: { user: { id: "u1", email_confirmed_at: null }, access_token: "t" } }, error: null }),
    },
  };
}

describe("CustomerProvider and the sign-in library", () => {
  beforeEach(() => { vi.clearAllMocks(); window.localStorage.clear(); window.history.replaceState({}, "", "/shop"); customerSupabase.mockResolvedValue(fakeClient()); });
  afterEach(() => window.localStorage.clear());

  it("does not load the sign-in library for a visitor who never signed in", async () => {
    render(<CustomerProvider><Status /></CustomerProvider>);
    await waitFor(() => expect(screen.getByText("guest")).toBeInTheDocument());
    expect(customerSupabase).not.toHaveBeenCalled();
  });

  it("loads it when a customer session is saved in this browser", async () => {
    window.localStorage.setItem("jelly-customer-auth", "{}");
    render(<CustomerProvider><Status /></CustomerProvider>);
    await waitFor(() => expect(screen.getByText("signed in")).toBeInTheDocument());
    expect(customerSupabase).toHaveBeenCalledTimes(1);
  });

  it("loads it to finish a sign-in link (?code=)", async () => {
    window.history.replaceState({}, "", "/shop/account?code=abc");
    render(<CustomerProvider><Status /></CustomerProvider>);
    await waitFor(() => expect(customerSupabase).toHaveBeenCalledTimes(1));
  });
});
