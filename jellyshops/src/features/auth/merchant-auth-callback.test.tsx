import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { MerchantAuthCallback } from "./merchant-auth-callback";
import { hasRecoverySession } from "./lib/recovery-session";
import type { Session } from "@supabase/supabase-js";

const { exchange, replace } = vi.hoisted(() => ({ exchange: vi.fn(), replace: vi.fn() }));
vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "geist" }), Geist_Mono: () => ({ variable: "geist-mono" }) }));
vi.mock("./lib/supabase-clients", () => ({
  supabaseConfigured: true,
  merchantSupabase: async () => ({ auth: { exchangeCodeForSession: exchange } }),
}));
vi.mock("next/navigation", () => {
  const router = { replace };
  return { useRouter: () => router };
});

function session(id = "recovery-session") {
  return { access_token: "header." + btoa(JSON.stringify({ session_id: id })) + ".signature" } as Session;
}

beforeEach(() => {
  exchange.mockReset();
  replace.mockReset();
  sessionStorage.clear();
});

it("exchanges a Google or signup code once and only follows a merchant return path", async () => {
  exchange.mockResolvedValue({ data: { session: session(), redirectType: null }, error: null });
  render(<StrictMode><MerchantAuthCallback code="pkce-code" nextPath="/admin/products" recovery={false} /></StrictMode>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/products"));
  expect(exchange).toHaveBeenCalledExactlyOnceWith("pkce-code");
});

it("will not open password reset using an ordinary sign-in code", async () => {
  exchange.mockResolvedValue({ data: { session: session(), redirectType: null }, error: null });
  render(<MerchantAuthCallback code="pkce-code" nextPath="/admin" recovery />);
  expect(await screen.findByRole("link", { name: "Request a new reset link" })).toBeVisible();
  expect(replace).not.toHaveBeenCalled();
  expect(hasRecoverySession(session())).toBe(false);
});

it("binds password reset to the session verified by the recovery exchange", async () => {
  exchange.mockResolvedValue({ data: { session: session(), redirectType: "recovery" }, error: null });
  render(<MerchantAuthCallback code="pkce-code" nextPath="/admin" recovery />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/reset-password"));
  expect(hasRecoverySession(session())).toBe(true);
  expect(hasRecoverySession(session("different-session"))).toBe(false);
});

it("has a useful return path when the provider was cancelled", () => {
  render(<MerchantAuthCallback code="" nextPath="/admin" recovery={false} providerError="access_denied" />);
  expect(screen.getByText(/sign-in was cancelled/i)).toBeVisible();
  expect(screen.getByRole("link", { name: "Return to sign in" })).toHaveAttribute("href", "/login");
  expect(exchange).not.toHaveBeenCalled();
});
