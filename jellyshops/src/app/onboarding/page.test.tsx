import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";

const { useAuth, router, authApiOrigin } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  router: { replace: vi.fn() },
  authApiOrigin: vi.fn(() => "http://api.test"),
}));

vi.mock("@/features/auth/auth-provider", () => ({ useAuth, authApiOrigin }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import OnboardingPage from "./page";

const session = { access_token: "merchant-token" };

function store(name = "Maya's pottery") {
  return { id: "store-a", name, slug: "mayas-pottery", currency: "INR", country: "IN", role: "owner" };
}

function setAuth({
  stores = [],
  refreshMerchant = vi.fn().mockResolvedValue(undefined),
}: {
  stores?: ReturnType<typeof store>[];
  refreshMerchant?: ReturnType<typeof vi.fn>;
} = {}) {
  useAuth.mockReturnValue({
    configured: true,
    loading: false,
    session,
    stores,
    refreshMerchant,
  });
  return refreshMerchant;
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth();
  vi.stubGlobal("fetch", vi.fn());
});

it("creates a store and refreshes merchant context before opening the starter chooser", async () => {
  const events: string[] = [];
  let releaseRefresh: () => void = () => {};
  const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
  let rerenderWithCreatedStore: () => void = () => {};
  const authState = {
    configured: true,
    loading: false,
    session,
    stores: [] as ReturnType<typeof store>[],
    refreshMerchant: vi.fn(async () => {
      events.push("refresh-merchant");
      authState.stores = [store()];
      rerenderWithCreatedStore();
      await refreshGate;
    }),
  };
  useAuth.mockReturnValue(authState);
  const refreshMerchant = authState.refreshMerchant;
  vi.mocked(fetch).mockImplementation(async (_input, init) => {
    events.push("create-store");
    expect(init?.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer merchant-token" });
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Maya's pottery", slug: "maya-s-pottery", currency: "INR", country: "IN" });
    return new Response("{}", { status: 201 });
  });
  const user = userEvent.setup();
  const view = render(<OnboardingPage />);
  rerenderWithCreatedStore = () => view.rerender(<OnboardingPage />);

  await user.type(screen.getByLabelText("Store name"), "Maya's pottery");
  await user.click(screen.getByRole("button", { name: /create my shop/i }));

  await waitFor(() => expect(events).toEqual(["create-store", "refresh-merchant"]));
  expect(router.replace).not.toHaveBeenCalled();
  releaseRefresh();
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/online-store"));
  expect(router.replace).toHaveBeenCalledTimes(1);
  expect(events).toEqual(["create-store", "refresh-merchant"]);
  expect(refreshMerchant).toHaveBeenCalledTimes(1);
});

it("sends a returning merchant to the dashboard without creating another store", async () => {
  setAuth({ stores: [store()] });
  render(<OnboardingPage />);

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin"));
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ["an HTTP error", async () => new Response(JSON.stringify({ error: { message: "That address is taken." } }), { status: 409 })],
  ["a network error", async () => { throw new Error("Network unavailable"); }],
])("keeps the form available after %s", async (_label, response) => {
  const refreshMerchant = setAuth();
  vi.mocked(fetch).mockImplementation(response as typeof fetch);
  const user = userEvent.setup();
  render(<OnboardingPage />);

  await user.type(screen.getByLabelText("Store name"), "Maya's pottery");
  await user.click(screen.getByRole("button", { name: /create my shop/i }));

  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByRole("button", { name: /create my shop/i })).toBeEnabled();
  expect(refreshMerchant).not.toHaveBeenCalled();
  expect(router.replace).not.toHaveBeenCalled();
});

it("offers a refresh-only retry when creation succeeds but merchant refresh fails", async () => {
  const refreshMerchant = vi.fn().mockRejectedValueOnce(new Error("Context unavailable")).mockResolvedValueOnce(undefined);
  setAuth({ refreshMerchant });
  vi.mocked(fetch).mockResolvedValue(new Response("{}", { status: 201 }));
  const user = userEvent.setup();
  render(<OnboardingPage />);

  await user.type(screen.getByLabelText("Store name"), "Maya's pottery");
  await user.click(screen.getByRole("button", { name: /create my shop/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/shop was created, but we couldn't load it yet/i);
  await user.click(screen.getByRole("button", { name: /retry loading/i }));

  await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/admin/online-store"));
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(refreshMerchant).toHaveBeenCalledTimes(2);
});
