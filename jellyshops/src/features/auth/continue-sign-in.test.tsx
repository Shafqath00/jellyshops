import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const verifyOtp = vi.hoisted(() => vi.fn());
vi.mock("./lib/supabase-clients", () => ({ supabaseConfigured: true, merchantSupabase: async () => ({ auth: { verifyOtp } }) }));
vi.mock("./components/auth-shell", () => ({
  MerchantAuthShell: ({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) => <main><h1>{title}</h1><p>{subtitle}</p>{children}</main>,
}));

import { ContinueSignIn } from "./continue-sign-in";

const replace = vi.fn();
beforeEach(() => {
  verifyOtp.mockReset();
  replace.mockClear();
  window.history.replaceState(null, "", "/auth/continue#token_hash=one-time&next=%2Fs%2Fmyshop%3Fwelcome%3D1");
});
afterEach(() => vi.restoreAllMocks());

it("swaps the one-time token for this site's session and opens the page", async () => {
  verifyOtp.mockResolvedValue({ data: { session: { access_token: "admin-token" } }, error: null });
  render(<ContinueSignIn go={replace} />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/s/myshop?welcome=1"));
  expect(verifyOtp).toHaveBeenCalledWith({ token_hash: "one-time", type: "email" });
  expect(window.location.hash).toBe("");
});

it("asks the merchant to sign in when the token has expired or was used", async () => {
  verifyOtp.mockResolvedValue({ data: { session: null }, error: new Error("expired") });
  render(<ContinueSignIn go={replace} />);
  expect(await screen.findByRole("heading", { name: "Sign in to your dashboard" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fs%2Fmyshop%3Fwelcome%3D1");
  expect(replace).not.toHaveBeenCalled();
  expect(window.location.hash).toBe("");
});

it("never follows a next address outside the admin", async () => {
  window.history.replaceState(null, "", "/auth/continue#token_hash=t&next=https%3A%2F%2Fevil.test");
  verifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
  render(<ContinueSignIn go={replace} />);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
});
