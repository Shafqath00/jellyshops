import { cleanup, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { ClosedShops, type ClosedShop } from "./closed-shops";

afterEach(cleanup);

const shop = (over: Partial<ClosedShop>): ClosedShop => ({
  storeId: "s1", name: "Sleep Well", slug: "sleep-well", ownerEmail: "owner@example.test", status: "expired",
  closedSince: "2027-01-01T09:00:00Z", warnedAt: null, deleteFrom: null, due: false, ...over,
});

describe("closed shops in the platform admin", () => {
  it("says which shops have been warned and which can be deleted", async () => {
    const shops = [
      shop({ storeId: "a", name: "Due Shop", warnedAt: "2027-03-18T09:00:00Z", deleteFrom: "2027-04-01T09:00:00Z", due: true }),
      shop({ storeId: "b", name: "Warned Shop", status: "past_due", warnedAt: "2027-03-18T09:00:00Z", deleteFrom: "2027-04-01T09:00:00Z" }),
      shop({ storeId: "c", name: "Quiet Shop" }),
    ];
    const { container } = render(<ClosedShops load={async () => ({ status: 200, body: { shops, retentionDays: 90, warningDays: 14 } })} />);
    expect(await screen.findByRole("heading", { name: "Closed shops" })).toBeTruthy();
    expect(screen.getByText(/1 shop can be deleted/)).toBeTruthy();
    expect(screen.getByText("Can be deleted (since 1 Apr 2027)")).toBeTruthy();
    expect(screen.getByText("Warned 18 Mar 2027; can be deleted from 1 Apr 2027")).toBeTruthy();
    expect(screen.getByText(/Not warned yet/)).toBeTruthy();
    expect(screen.getByText("Payment failed")).toBeTruthy();
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false } } })).violations).toEqual([]);
  });

  it("shows nothing when no shop has been closed that long", async () => {
    const { container } = render(<ClosedShops load={async () => ({ status: 200, body: { shops: [] } })} />);
    await Promise.resolve();
    expect(container.textContent).toBe("");
  });
});
