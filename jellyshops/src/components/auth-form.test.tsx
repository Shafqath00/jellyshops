import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const { supabase, useAuth, router } = vi.hoisted(() => ({
  supabase: { auth: { signUp: vi.fn(), signInWithPassword: vi.fn() } },
  useAuth: vi.fn(),
  router: { replace: vi.fn() },
}));

vi.mock("@/features/auth/auth-provider", () => ({ supabase, useAuth }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

import { AuthForm } from "./auth-form";

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ configured: true });
  supabase.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  vi.stubGlobal("fetch", vi.fn());
});

it("keeps signup without a session on the email-confirmation path", async () => {
  const user = userEvent.setup();
  render(<AuthForm mode="signup" />);

  await user.type(screen.getByLabelText("Your name"), "Maya Potter");
  await user.type(screen.getByLabelText("Email"), "maya@example.com");
  await user.type(screen.getByLabelText("Password"), "secure-password");
  await user.click(screen.getByRole("button", { name: /create account/i }));

  expect(await screen.findByRole("status")).toHaveTextContent(/check your inbox to confirm your email/i);
  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: "maya@example.com",
    password: "secure-password",
    options: { data: { name: "Maya Potter" } },
  });
  expect(router.replace).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
