import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { expectNoRawCodes } from "@/test/raw-codes";
import { discountState, type MerchantDiscount } from "@/features/admin/api/discounts-api";
import DiscountsPage from "./page";

const api = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() }));
vi.mock("@/features/admin/api/discounts-api", async (original) => ({
  ...(await original<typeof import("@/features/admin/api/discounts-api")>()),
  useAdminDiscounts: () => ({ ...api, ready: true, storeId: "store-a", currency: "GBP" }),
}));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); });

const code: MerchantDiscount = { id: "d1", code: "SPRING10", kind: "percent", value: 10, minimumSubtotalMinor: 5000, usageLimit: 20, oncePerCustomer: true, startsAt: null, endsAt: null, active: true, uses: 3, createdAt: "2026-11-01T10:00:00Z" };

describe("discounts page", () => {
  it("lists codes in plain words", async () => {
    api.list.mockResolvedValue([code, { ...code, id: "d2", code: "SHIPFREE", kind: "free_shipping", value: 0, minimumSubtotalMinor: null, usageLimit: null, oncePerCustomer: false, active: false, uses: 0 }]);
    render(<DiscountsPage />);
    const table = await screen.findByRole("table");
    expect(within(table).getByText("10% off · orders over £50.00, once per customer")).toBeVisible();
    expect(within(table).getByText("3 of 20")).toBeVisible();
    expect(within(table).getByText("Free delivery")).toBeVisible();
    expect(within(table).getByText("Switched off")).toBeVisible();
    expectNoRawCodes();
  });

  it("creates a code from what the merchant types, in minor units", async () => {
    api.list.mockResolvedValue([]);
    api.create.mockResolvedValue({ ...code, id: "d9", code: "TAKE5", kind: "fixed", value: 500 });
    const user = userEvent.setup();
    render(<DiscountsPage />);
    await user.click((await screen.findAllByRole("button", { name: "Create discount" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Create discount" });
    await user.type(within(dialog).getByRole("textbox", { name: "Code" }), "take 5");
    await user.click(within(dialog).getByRole("radio", { name: "Amount off" }));
    await user.type(within(dialog).getByRole("textbox", { name: /Amount off the products/ }), "5");
    await user.type(within(dialog).getByRole("textbox", { name: /Minimum order/ }), "40.50");
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ code: "TAKE5", kind: "fixed", value: 500, minimumSubtotalMinor: 4050, usageLimit: null, active: true })));
  });

  it("explains mistakes next to the field and sends nothing", async () => {
    api.list.mockResolvedValue([]);
    const user = userEvent.setup();
    render(<DiscountsPage />);
    await user.click((await screen.findAllByRole("button", { name: "Create discount" }))[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Create discount" });
    await user.clear(within(dialog).getByRole("textbox", { name: "Percentage off the products" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Percentage off the products" }), "150");
    await user.click(within(dialog).getByRole("button", { name: "Create discount" }));
    expect(await within(dialog).findByText("Use 2 to 40 letters, numbers, dashes or underscores, with no spaces.")).toBeVisible();
    expect(within(dialog).getByText("Enter a whole number from 1 to 100.")).toBeVisible();
    expect(api.create).not.toHaveBeenCalled();
  });

  it("keeps a used code's name and asks before deleting", async () => {
    api.list.mockResolvedValue([code]);
    api.remove.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DiscountsPage />);
    await user.click(within(await screen.findByRole("table")).getByRole("button", { name: "Edit" }));
    expect(within(await screen.findByRole("dialog", { name: "Edit SPRING10" })).getByRole("textbox", { name: "Code" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Delete code SPRING10" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete SPRING10?" });
    await user.click(within(confirm).getByRole("button", { name: "Delete code" }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith("d1"));
  });

  it("works out where a code stands today", () => {
    const now = new Date("2026-11-18T12:00:00Z");
    expect(discountState(code, now)).toBe("active");
    expect(discountState({ ...code, startsAt: "2026-12-01T00:00:00Z" }, now)).toBe("scheduled");
    expect(discountState({ ...code, endsAt: "2026-11-10T00:00:00Z" }, now)).toBe("expired");
    expect(discountState({ ...code, uses: 20 }, now)).toBe("used-up");
    expect(discountState({ ...code, active: false }, now)).toBe("off");
  });
});
