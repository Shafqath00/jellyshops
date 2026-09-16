import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantPaymentsPanel } from "./merchant-payments-panel";

vi.mock("../merchant-session", () => ({
  getMerchantSession: () => ({ storeId: "store-demo", token: "jelly-demo-merchant" }),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("MerchantPaymentsPanel", () => {
  it("explains inactive card payments and launches the server-issued onboarding link", async () => {
    const user = userEvent.setup();
    const redirect = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ connected: true, checkoutReady: false, cardPaymentsStatus: "inactive", payoutsStatus: "inactive", closed: false }))
      .mockResolvedValueOnce(jsonResponse({ url: "https://connect.stripe.test/onboarding" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    render(<MerchantPaymentsPanel redirect={redirect} />);

    expect(await screen.findByText(/card payments are inactive/i)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /continue stripe onboarding/i }));

    await waitFor(() => expect(redirect).toHaveBeenCalledWith("https://connect.stripe.test/onboarding"));
  });

  it("warns the merchant when Stripe reports the connected account is closed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ connected: true, checkoutReady: false, closed: true })));

    render(<MerchantPaymentsPanel />);

    expect(await screen.findByText(/this stripe account is closed/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /stripe onboarding/i })).not.toBeInTheDocument();
  });

  it("uses only the dashboard URL supplied by the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      connected: true, checkoutReady: true, cardPaymentsStatus: "active", payoutsStatus: "active", closed: false,
      dashboardUrl: "https://dashboard.stripe.com",
    })));

    render(<MerchantPaymentsPanel />);

    const link = await screen.findByRole("link", { name: /open stripe dashboard/i });
    expect(link).toHaveAttribute("href", "https://dashboard.stripe.com");
  });

  it("summarizes the verification fields Stripe says are due", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      connected: true, checkoutReady: false, cardPaymentsStatus: "inactive", payoutsStatus: "inactive", closed: false,
      requirements: { requirements: { currently_due: ["business_profile.url", "external_account"] } },
    })));

    render(<MerchantPaymentsPanel />);

    expect(await screen.findByText("business_profile.url")).toBeVisible();
    expect(screen.getByText("external_account")).toBeVisible();
  });
});
