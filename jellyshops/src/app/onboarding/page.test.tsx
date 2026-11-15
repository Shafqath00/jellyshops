import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, expect, it, vi } from "vitest";

const { useAuth, router, authApiOrigin, getAccessToken, refreshMerchant, setActiveStoreId } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  router: { replace: vi.fn() },
  authApiOrigin: vi.fn(() => "http://api.test"),
  getAccessToken: vi.fn(async () => "merchant-token"),
  refreshMerchant: vi.fn(async () => undefined),
  setActiveStoreId: vi.fn(),
}));

vi.mock("@/features/auth/providers/auth-provider", () => ({ useAuth, authApiOrigin }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/font/google", () => ({ Geist: () => ({ variable: "geist" }), Geist_Mono: () => ({ variable: "geist-mono" }) }));

import OnboardingPage from "./page";

const store = { id: "store-a", name: "Fern Studio", slug: "fern-studio", country: "GB", currency: "GBP", role: "OWNER" };
const session = { user: { id: "merchant-a", email: "maya@example.com", user_metadata: { name: "Maya Patel" } } };

function mockBackend(overrides: Record<string, unknown> = {}) {
  let current = {
    revision: 2, step: "store", answers: {}, store: null,
    images: { profile: false, logo: false }, consentRequired: false, ...overrides,
  };
  const calls: string[] = [];
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const request = init?.method ?? "GET";
    const path = url.pathname.replace("/api/onboarding", "") || "/";
    calls.push(request + " " + path);
    if (path === "/policies") return Response.json({ termsUrl: "https://example.com/terms", privacyUrl: "https://example.com/privacy", version: "v1" });
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer merchant-token");
    if (path === "/consent") {
      expect(JSON.parse(String(init?.body))).toEqual({ version: "v1" });
      current = { ...current, consentRequired: false };
      return new Response(null, { status: 204 });
    }
    if (path === "/availability") return Response.json({ available: true });
    if (path === "/complete") return Response.json({ store });
    if (request === "PATCH") {
      const { revision, step, answers } = JSON.parse(String(init?.body));
      expect(revision).toBe(current.revision);
      current = { ...current, step, answers, revision: current.revision + 1 };
    }
    return Response.json(current);
  });
  return { calls, snapshot: () => current };
}

beforeAll(() => {
  window.matchMedia ??= vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() });
});

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ configured: true, loading: false, session, stores: [], getAccessToken, refreshMerchant, setActiveStoreId, merchantStatus: "ready" });
  vi.stubGlobal("fetch", vi.fn());
});

const ready = { fullName: "Maya Patel", name: "Fern Studio", slug: "fern-studio", country: "GB" };

it("shows the setup steps only after accepting the current policies", async () => {
  const backend = mockBackend({ consentRequired: true });
  const user = userEvent.setup();
  render(<OnboardingPage />);

  await screen.findByRole("heading", { name: /our terms/i });
  expect(screen.queryByLabelText("Store name")).toBeNull();
  expect(screen.getByRole("button", { name: /accept and continue/i })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: /agree/i }));
  await user.click(screen.getByRole("button", { name: /accept and continue/i }));

  expect(await screen.findByLabelText("Store name")).toBeVisible();
  expect(screen.getByLabelText("Your name")).toHaveValue("Maya Patel");
  expect(backend.calls).toContain("POST /consent");
});

it("walks the five steps with a progress bar and keeps answers when going back", async () => {
  const backend = mockBackend();
  const user = userEvent.setup();
  render(<OnboardingPage />);

  expect(await screen.findByRole("progressbar", { name: /store setup progress/i })).toHaveAttribute("aria-valuetext", "Step 1 of 5: Your store");
  await user.type(screen.getByLabelText("Store name"), "Fern Studio");
  expect(screen.getByLabelText("Store web address")).toHaveValue("fern-studio");
  await user.selectOptions(screen.getByLabelText("Where you’re based"), "GB");
  await user.click(screen.getByRole("button", { name: /continue/i }));

  expect(await screen.findByRole("heading", { name: "What do you sell?" })).toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: /beauty & wellness/i }));
  await user.click(screen.getByRole("button", { name: /continue/i }));

  expect(await screen.findByRole("heading", { name: "How do you sell today?" })).toBeInTheDocument();
  await user.click(screen.getByRole("checkbox", { name: /social media/i }));
  await user.click(screen.getByRole("button", { name: /continue/i }));

  const design = await screen.findByRole("heading", { name: "Pick a design" });
  const halo = screen.getByRole("radio", { name: /halo/i });
  expect(halo).toBeChecked();
  expect(within(halo.closest("label")!).getByText("Suggested for you")).toBeInTheDocument();
  expect(design).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(await screen.findByRole("checkbox", { name: /social media/i })).toBeChecked();
  await waitFor(() => expect(backend.snapshot()).toMatchObject({
    step: "profile",
    answers: { name: "Fern Studio", slug: "fern-studio", country: "GB", category: "Beauty & wellness", sellingChannels: ["social"] },
  }));
});

it("stops on step 1 until the required details are filled in", async () => {
  mockBackend({ answers: { fullName: "Maya Patel" } });
  const user = userEvent.setup();
  render(<OnboardingPage />);

  await screen.findByLabelText("Store name");
  await user.click(screen.getByRole("button", { name: /continue/i }));
  expect(await screen.findByText("Enter a store name.")).toBeInTheDocument();
  expect(screen.getByText("Choose where your business is based.")).toBeInTheDocument();
  expect(screen.getByLabelText("Store name")).toHaveFocus();
});

it("creates the store from the last step with the suggested design and opens the dashboard", async () => {
  const backend = mockBackend({ step: "products", answers: { ...ready, category: "Electronics" } });
  const user = userEvent.setup();
  render(<OnboardingPage />);

  await user.type(await screen.findByLabelText("Product name"), "Wireless earbuds");
  await user.type(screen.getByLabelText(/^Price/), "49.99");
  await user.click(screen.getByRole("button", { name: /create my store/i }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin?welcome=1"));
  expect(backend.snapshot().answers).toMatchObject({ theme: "jelly-diode", product: { title: "Wireless earbuds", priceMinor: 4999 } });
  expect(backend.calls.filter((call) => call === "POST /complete")).toHaveLength(1);
});

it("retries dashboard loading after completion without creating a second store", async () => {
  const backend = mockBackend({ step: "review", answers: ready });
  refreshMerchant.mockRejectedValueOnce(new Error("Network unavailable"));
  const user = userEvent.setup();
  render(<OnboardingPage />);

  await user.click(await screen.findByRole("button", { name: /skip and create store/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/store was created/i);
  await user.click(screen.getByRole("button", { name: /open your dashboard/i }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin?welcome=1"));
  expect(setActiveStoreId).toHaveBeenCalledWith(store.id);
  expect(backend.calls.filter((call) => call === "POST /complete")).toHaveLength(1);
});
