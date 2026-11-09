import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import DashboardPage from "./page";
import { changeText } from "@/features/admin/home/change-text";
import { niceMax } from "@/features/admin/home/sales-chart";

vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-a", name: "Jelly Beds", slug: "jelly-beds", currency: "GBP" };
  const session = { access_token: "token" };
  return { useAuth: () => ({ activeStore, session }), authApiOrigin: () => "http://api.local" };
});
afterEach(() => { vi.unstubAllGlobals(); });

const summary = {
  timezone: "Europe/London",
  setup: { details: true, products: true, publication: false, shipping: true, payments: true },
  revenueMinor: 204800, orderCount: 5, publishedProductCount: 3,
  actionableOrders: [{ id: "o1", number: "JS-000004", status: "PROCESSING", customerSnapshot: { name: "Rahul Kumar" }, totalMinor: 162400, currency: "GBP", createdAt: "2026-10-26T20:42:00.000Z" }],
  lowStock: [{ productId: "p1", variantId: "v1", title: "Utah Ottoman Divan Bed", variantTitle: "Double / Without storage", sku: null, available: 0, quantity: 2 }],
};
const sales = (days: number) => ({
  days, timezone: "Europe/London",
  current: { revenueMinor: 204800, paidOrders: 2, averageOrderMinor: 102400 },
  previous: { revenueMinor: 102400, paidOrders: 2, averageOrderMinor: 51200 },
  daily: Array.from({ length: days }, (_, index) => ({ date: `2026-11-${String(index + 1).padStart(2, "0")}`, revenueMinor: index === days - 1 ? 204800 : 0, paidOrders: index === days - 1 ? 2 : 0 })),
});

describe("Home", () => {
  it("shows setup steps, sales for the chosen period and what needs attention, in plain words", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes("/sales") ? sales(Number(new URL(url).searchParams.get("days"))) : summary))));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<DashboardPage />);
    expect(await screen.findByRole("heading", { name: "Set up your store" })).toBeVisible();
    expect(screen.getByText("4 of 5 done")).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Setup progress" })).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByRole("link", { name: "Publish your store design" })).toHaveAttribute("href", "/admin/online-store");
    expect(screen.getByRole("link", { name: "Choose a design" })).toHaveAttribute("href", "/admin/online-store");
    expect(screen.getByRole("link", { name: /Orders to send/ })).toHaveTextContent("1");
    expect((await screen.findAllByText("£2,048.00"))[0]).toBeVisible();
    expect(screen.getAllByText("Up 100% on the 30 days before")).toHaveLength(2);
    expect(screen.getByText("Same as the 30 days before")).toBeVisible();
    expect(screen.getByText("Double / Without storage")).toBeVisible();
    expect(screen.getByText("Out of stock")).toBeVisible();
    expect(screen.getByText("Being prepared")).toBeVisible();
    expect(screen.queryByText("No SKU")).toBeNull();
    await user.selectOptions(screen.getByLabelText("Sales period"), "7");
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("/admin-summary/sales?days=7"), expect.anything()));
    expect(await screen.findAllByText("Up 100% on the 7 days before", {}, { timeout: 3000 })).toHaveLength(2);
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe("niceMax", () => {
  it("rounds the chart scale up to a value that halves cleanly", () => {
    expect(niceMax(204800)).toBe(400000);
    expect(niceMax(150)).toBe(200);
    expect(niceMax(4100)).toBe(5000);
    expect(niceMax(0)).toBe(0);
  });
});

describe("changeText", () => {
  it("compares with the period before in words", () => {
    expect(changeText(150, 100, "the 7 days before")).toBe("Up 50% on the 7 days before");
    expect(changeText(50, 100, "the 7 days before")).toBe("Down 50% on the 7 days before");
    expect(changeText(0, 0, "the 7 days before")).toBe("Same as the 7 days before");
    expect(changeText(10, 0, "the 7 days before")).toBe("New this period (nothing in the 7 days before)");
  });
});
