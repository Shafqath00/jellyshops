import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { supabase, useAuth, router } = vi.hoisted(() => ({
  supabase: { auth: { signUp: vi.fn(), signInWithPassword: vi.fn(), resetPasswordForEmail: vi.fn(), signInWithOAuth: vi.fn() } },
  useAuth: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "geist" }), Geist_Mono: () => ({ variable: "geist-mono" }) }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth, authApiOrigin: () => "http://localhost:3001" }));
// The sign-in client is loaded on demand (supabase-clients.ts).
vi.mock("@/features/auth/lib/supabase-clients", () => ({ merchantSupabase: async () => supabase, supabaseConfigured: true }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

import { AuthForm } from "./auth-form";
import { merchantReturnPath } from "../lib/auth-navigation";

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ configured: true });
  supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    termsUrl: "https://jellyshop.example/terms", privacyUrl: "https://jellyshop.example/privacy", version: "2026-01",
  }))));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("keeps signup without a session on the email-confirmation path", async () => {
  const user = userEvent.setup();
  render(<AuthForm mode="signup" />);

  await user.type(screen.getByLabelText("Your name"), "Maya Potter");
  await user.type(screen.getByLabelText("Email"), "maya@example.com");
  await user.type(screen.getByLabelText("Password"), "secure-password");
  await user.type(screen.getByLabelText("Confirm password"), "secure-password");
  expect(await screen.findByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "https://jellyshop.example/terms");
  await user.click(screen.getByRole("button", { name: /create account/i }));

  expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
  expect(screen.getByText("maya@example.com")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /resend email in \d+s/i })).toBeDisabled();
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: "maya@example.com",
    password: "secure-password",
    options: { data: { name: "Maya Potter" }, emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fonboarding" },
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith("http://localhost:3001/api/onboarding/policies", expect.anything());
});

it("keeps a password mismatch on the form and never calls signup", async () => {
  const user = userEvent.setup();
  render(<AuthForm mode="signup" />);
  await screen.findByRole("link", { name: "Terms of Service" });
  await user.type(screen.getByLabelText("Your name"), "Maya Potter");
  await user.type(screen.getByLabelText("Email"), "maya@example.com");
  await user.type(screen.getByLabelText("Password"), "secure-password");
  await user.type(screen.getByLabelText("Confirm password"), "another-password");
  await user.click(screen.getByRole("button", { name: /create account/i }));

  expect(screen.getByText("Passwords don’t match.")).toBeVisible();
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

it("uses neutral password recovery feedback for an unknown account", async () => {
  const user = userEvent.setup();
  supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: { code: "user_not_found" } });
  render(<AuthForm mode="login" />);
  await user.click(screen.getByRole("button", { name: /forgot password/i }));
  await user.type(screen.getByLabelText("Email"), "maya@example.com");
  await user.click(screen.getByRole("button", { name: /send reset link/i }));
  expect(await screen.findByRole("status")).toHaveTextContent(/if an account uses this email/i);
});

it("accepts only approved merchant return paths", () => {
  expect(merchantReturnPath("/admin/products?q=candles")).toBe("/admin/products?q=candles");
  expect(merchantReturnPath("/onboarding")).toBe("/onboarding");
  for (const target of ["https://other.site", "//other.site", "/\\other.site", "/admin/%2e%2e/signup", "/admin/%5c..", "/sweet-bakes"]) {
    expect(merchantReturnPath(target)).toBe("/admin");
  }
});

it("uses the existing PKCE callback for Google signup", async () => {
  const user = userEvent.setup();
  vi.stubEnv("NEXT_PUBLIC_JELLYSHOP_GOOGLE_SIGN_IN", "true");
  supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://google.example" }, error: null });
  render(<AuthForm mode="signup" />);
  await screen.findByRole("link", { name: "Terms of Service" });
  await user.click(screen.getByRole("button", { name: "Sign up with Google" }));
  expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fonboarding" },
  });
});

it("gates new account creation when policies have not been configured", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
  render(<AuthForm mode="signup" />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/new accounts are temporarily unavailable/i);
  expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
});
