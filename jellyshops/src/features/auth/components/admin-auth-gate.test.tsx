import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
const { useAuth, replace, retry } = vi.hoisted(() => ({ useAuth: vi.fn(), replace: vi.fn(), retry: vi.fn(async () => {}) }));
vi.mock("@/features/auth/auth-provider", () => ({ useAuth }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }), usePathname: () => "/admin" }));
import { AdminAuthGate } from "./admin-auth-gate";
beforeEach(() => { vi.clearAllMocks(); });
it("shows a retry after merchant loading fails instead of redirecting to onboarding", async () => {
  useAuth.mockReturnValue({ configured: true, loading: false, merchantLoading: false, merchantStatus: "error", merchantError: "Could not load your stores", refreshMerchant: retry, session: {}, stores: [] });
  render(<AdminAuthGate>studio</AdminAuthGate>);
  expect(screen.getByRole("alert")).toHaveTextContent("Could not load your stores");
  expect(replace).not.toHaveBeenCalled();
  await userEvent.setup().click(screen.getByRole("button", { name: /retry/i }));
  expect(retry).toHaveBeenCalled();
});
it("redirects only a successfully loaded empty store list", async () => {
  useAuth.mockReturnValue({ configured: true, loading: false, merchantLoading: false, merchantStatus: "ready", merchantError: null, refreshMerchant: retry, session: {}, stores: [] });
  render(<AdminAuthGate>studio</AdminAuthGate>);
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
});
