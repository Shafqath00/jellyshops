import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  session: null as null | { access_token: string },
  level: "aal1",
  factors: [] as Array<{ id: string; status: string }>,
  signInWithPassword: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  enroll: vi.fn(async () => ({ data: { id: "factor-new", totp: { qr_code: "data:image/svg+xml;base64,PHN2Zy8+", secret: "SECRETKEY" } }, error: null })),
  challengeAndVerify: vi.fn(),
  unenroll: vi.fn(async () => ({ error: null })),
}));
const client = {
  auth: {
    getSession: async () => ({ data: { session: auth.session } }),
    signInWithPassword: auth.signInWithPassword,
    signOut: auth.signOut,
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: auth.level } }),
      listFactors: async () => ({ data: { totp: auth.factors, all: auth.factors } }),
      enroll: auth.enroll,
      challengeAndVerify: auth.challengeAndVerify,
      unenroll: auth.unenroll,
    },
  },
};
vi.mock("@/features/auth/lib/supabase-clients", () => ({ merchantSupabase: async () => client }));
vi.mock("@/features/auth/providers/auth-provider", () => ({ authApiOrigin: () => "https://api.test" }));
vi.mock("@/features/auth/components/auth-shell", () => ({
  MerchantAuthShell: ({ title, subtitle, children }: { title: string; subtitle: string; children?: React.ReactNode }) => <main><h1>{title}</h1><p>{subtitle}</p>{children}</main>,
}));

import { PlatformConsole } from "./platform-console";

const shops = [{ id: "store-a", name: "Express Bed", slug: "express-bed", country: "GB", currency: "GBP", createdAt: "2026-11-19T10:00:00.000Z", archived: false, ownerEmail: "owner@example.test" }];
function backend(me: { status: number; body: unknown }) {
  const fetch = vi.fn(async (url: string) => url.endsWith("/api/platform/me")
    ? new Response(JSON.stringify(me.body), { status: me.status })
    : Response.json({ stores: shops }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

beforeEach(() => {
  auth.session = null; auth.level = "aal1"; auth.factors = [];
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

it("asks staff to sign in", async () => {
  backend({ status: 401, body: {} });
  render(<PlatformConsole />);
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
});

it("sets up the authenticator the first time, then lists shops", async () => {
  auth.session = { access_token: "token" };
  const fetch = backend({ status: 200, body: { role: "OWNER", email: "owner@example.test" } });
  auth.challengeAndVerify.mockImplementation(async () => { auth.level = "aal2"; return { error: null }; });
  render(<PlatformConsole />);
  expect(await screen.findByRole("heading", { name: "Set up your authenticator" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /QR code/ })).toBeInTheDocument();
  expect(screen.getByText("SECRETKEY")).toBeInTheDocument();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("6-digit code"), "123456");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(auth.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-new", code: "123456" });
  expect(await screen.findByRole("heading", { name: "Shops" })).toBeInTheDocument();
  expect(await screen.findByRole("cell", { name: "Express Bed" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "express-bed" })).toHaveAttribute("href", "/express-bed");
  expect(fetch).toHaveBeenCalledWith("https://api.test/api/platform/stores", expect.objectContaining({ headers: { Authorization: "Bearer token" } }));
});

it("asks for the code when the authenticator is already set up", async () => {
  auth.session = { access_token: "token" };
  auth.factors = [{ id: "factor-1", status: "verified" }];
  backend({ status: 200, body: {} });
  render(<PlatformConsole />);
  expect(await screen.findByRole("heading", { name: "Confirm it's you" })).toBeInTheDocument();
  expect(auth.enroll).not.toHaveBeenCalled();
});

it("shows 'not available' to accounts that aren't platform admins", async () => {
  auth.session = { access_token: "token" };
  auth.level = "aal2";
  backend({ status: 403, body: { error: { code: "PLATFORM_FORBIDDEN", message: "This page isn't available to your account." } } });
  render(<PlatformConsole />);
  expect(await screen.findByRole("heading", { name: "Not available" })).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
});

it("signs out and asks to sign in again after 12 hours", async () => {
  auth.session = { access_token: "token" };
  auth.level = "aal2";
  backend({ status: 403, body: { error: { code: "PLATFORM_SIGN_IN_AGAIN", message: "For safety, sign in again (at least every 12 hours)." } } });
  render(<PlatformConsole />);
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
  expect(screen.getByRole("alert")).toHaveTextContent("at least every 12 hours");
});
