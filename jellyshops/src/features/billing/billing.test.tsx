import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoRawCodes } from "@/test/raw-codes";
import { planText } from "@/features/platform/plan-text";
import { BillingSettings } from "./billing-settings";
import { billingNotices, formatBytes, resetBillingCache, trialDaysLeft, usageText, type BillingSummary } from "./billing-summary";

const GB = 1024 ** 3;
const now = new Date("2026-12-01T12:00:00Z");
const summary = (over: Partial<BillingSummary> = {}): BillingSummary => ({
  status: "trialing", plan: "standard", planName: "Jellyshop", trialEndsAt: "2026-12-11T12:00:00Z", currentPeriodEnd: null,
  cancelAtPeriodEnd: false, pauseReason: null, paused: false, exempt: false, enforced: true,
  usage: [{ kind: "products", used: 74, limit: 5000 }, { kind: "photoBytes", used: 72 * 1024 ** 2, limit: 10 * GB }],
  ...over,
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => resetBillingCache());

describe("billing wording", () => {
  it("counts trial days the way people expect, never below zero", () => {
    expect(trialDaysLeft(summary(), now)).toBe(10);
    expect(trialDaysLeft(summary({ trialEndsAt: "2026-12-01T18:00:00Z" }), now)).toBe(1);
    expect(trialDaysLeft(summary({ trialEndsAt: "2026-11-20T00:00:00Z" }), now)).toBe(0);
    expect(trialDaysLeft(summary({ trialEndsAt: null }), now)).toBeNull();
  });

  it("describes usage in plain words", () => {
    expect(usageText({ kind: "products", used: 74, limit: 5000 })).toBe("74 of 5,000 products");
    expect(usageText({ kind: "photoBytes", used: 72 * 1024 ** 2, limit: 10 * GB })).toBe("72 MB of 10 GB");
    expect(usageText({ kind: "products", used: 74, limit: null })).toBe("74 products, no limit on this shop");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("names every plan state in the platform admin", () => {
    expect(planText({ billingStatus: "trialing", trialEndsAt: "2026-12-11T12:00:00Z" })).toBe("Free trial until 11/12/2026");
    expect(planText({ billingStatus: "exempt" })).toBe("No charge");
    expect(planText({ billingStatus: null })).toBe("No plan yet");
  });
});

describe("billing notices above every admin page", () => {
  it("say nothing for a shop in good standing", () => {
    expect(billingNotices(summary(), now)).toEqual([]);
    expect(billingNotices(summary({ status: "exempt", exempt: true }), now)).toEqual([]);
    expect(billingNotices(null, now)).toEqual([]);
  });

  it("warn in the last week of the trial, but only once billing is enforced", () => {
    const ending = summary({ trialEndsAt: "2026-12-04T12:00:00Z" });
    expect(billingNotices(ending, now)).toEqual([expect.objectContaining({ tone: "info", title: "3 days left in your free trial" })]);
    expect(billingNotices({ ...ending, enforced: false }, now)).toEqual([]);
  });

  it("say clearly that a paused shop is closed and nothing is deleted", () => {
    const [notice] = billingNotices(summary({ paused: true, pauseReason: "trial-ended", status: "trialing", trialEndsAt: "2026-11-20T00:00:00Z" }), now);
    expect(notice).toMatchObject({ tone: "critical", title: "Your shop is closed to shoppers" });
    expect(notice.text).toContain("nothing has been deleted");
  });

  it("warn when a limit is nearly full and when it is full, whether or not billing is enforced", () => {
    const notices = billingNotices(summary({ enforced: false, usage: [{ kind: "products", used: 4100, limit: 5000 }, { kind: "photoBytes", used: 10 * GB, limit: 10 * GB }] }), now);
    expect(notices.map((notice) => [notice.tone, notice.title])).toEqual([["warning", "Products is nearly full"], ["critical", "Photo storage is full"]]);
  });
});

describe("Settings > Plan and billing", () => {
  it("shows the plan, the trial end and usage, with no internal codes and no accessibility problems", async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toMatch(/\/api\/stores\/store-1\/billing$/);
      return json(summary());
    });
    const view = render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} />);
    expect(await screen.findByText("Free trial")).toBeInTheDocument();
    expect(screen.getByText("Your free trial ends on 11 December 2026 (10 days left).")).toBeInTheDocument();
    expect(screen.getByText("74 of 5,000 products")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Photo storage: 72 MB of 10 GB" })).toBeInTheDocument();
    expectNoRawCodes(view.container);
    const results = await axe.run(view.container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it("tells an exempt shop it is not charged and shows usage without limits", async () => {
    const fetcher = vi.fn(async () => json(summary({ status: "exempt", exempt: true, trialEndsAt: null, usage: [{ kind: "products", used: 74, limit: null }] })));
    render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} />);
    expect(await screen.findByText("This shop is not charged.")).toBeInTheDocument();
    expect(screen.getByText("No charge")).toBeInTheDocument();
    expect(screen.getByText("74 products, no limit on this shop")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("explains when billing can't be shown, with a way to try again", async () => {
    const fetcher = vi.fn(async () => json({ error: { message: "nope" } }, 403));
    render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} />);
    expect(await screen.findByText("Billing details aren't available")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});

describe("paying with Stripe from Settings > Plan and billing", () => {
  const returnUrl = "http://localhost:3210/admin/s/shop/settings/billing";

  it("opens Stripe Checkout for a shop on its trial", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const navigate = vi.fn();
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        expect(url).toMatch(/\/api\/stores\/store-1\/billing\/checkout$/);
        expect(JSON.parse(String(init.body))).toEqual({ returnUrl });
        return json({ url: "https://checkout.stripe.com/c/pay/cs_1" });
      }
      return json(summary({ checkoutAvailable: true, hasSubscription: false }));
    });
    render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} returnUrl={returnUrl} navigate={navigate} returned={false} />);
    await userEvent.click(await screen.findByRole("button", { name: "Choose a plan" }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("https://checkout.stripe.com/c/pay/cs_1"));
    expect(screen.queryByRole("button", { name: "Manage billing" })).toBeNull();
  });

  it("offers Manage billing once the shop has a plan, and explains when Stripe can't be opened", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    const navigate = vi.fn();
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "POST"
      ? json({ error: { message: "Choose a plan first; then you can manage billing here." } }, 409)
      : json(summary({ status: "active", trialEndsAt: null, currentPeriodEnd: "2027-01-01T00:00:00Z", checkoutAvailable: true, hasSubscription: true })));
    render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} returnUrl={returnUrl} navigate={navigate} returned={false} />);
    expect(await screen.findByText("Your plan renews on 1 January 2027.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose a plan" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Manage billing" }));
    expect(await screen.findByText("Choose a plan first; then you can manage billing here.")).toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("thanks the merchant on the way back and reads the plan fresh", async () => {
    resetBillingCache();
    const fetcher = vi.fn(async () => json(summary({ checkoutAvailable: true })));
    render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} returnUrl={returnUrl} navigate={vi.fn()} returned />);
    expect(await screen.findByText("Your plan is being set up. It can take a minute to show here.")).toBeInTheDocument();
  });

  it("shows no pay buttons while paying isn't set up on the server", async () => {
    const fetcher = vi.fn(async () => json(summary({ checkoutAvailable: false })));
    render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} returnUrl={returnUrl} navigate={vi.fn()} returned={false} />);
    expect(await screen.findByText("You'll be able to choose how to pay for your plan here soon.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose a plan" })).toBeNull();
  });
});

describe("a plan set to cancel", () => {
  it("says it is cancelled and when it ends, even during the trial, and points to Manage billing", async () => {
    const fetcher = vi.fn(async () => json(summary({ cancelAtPeriodEnd: true, currentPeriodEnd: "2026-12-07T16:19:58Z", checkoutAvailable: true, hasSubscription: true })));
    render(<BillingSettings storeId="store-1" token="session" fetcher={fetcher as never} now={now} returnUrl="http://localhost:3210/admin" navigate={vi.fn()} returned={false} />);
    expect(await screen.findByText("Your plan is cancelled and ends on 7 December 2026. To keep it, use Manage billing.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Manage billing" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Choose a plan" })).toBeNull();
  });
});
