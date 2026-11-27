import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import { expectNoRawCodes } from "@/test/raw-codes";
import type { DiscountList, MerchantDiscount } from "@/features/discounts/api";
import DiscountsPage from "./page";
import DiscountPage from "./[id]/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push }), useParams: () => ({ shop: "store-a", id: "d1" }), usePathname: () => "/admin/s/store-a/discounts", useSearchParams: () => new URLSearchParams() }));
const api = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn(), bulk: vi.fn(), duplicate: vi.fn(), canManage: true }));
vi.mock("@/features/discounts/api", async (original) => ({
  ...(await original<typeof import("@/features/discounts/api")>()),
  useDiscountsApi: () => ({ ...api, create: vi.fn(), update: vi.fn(), remove: vi.fn(), codeCheck: vi.fn(), generateCode: vi.fn(), ready: true, storeId: "store-a", currency: "GBP" }),
}));
afterEach(cleanup);
beforeEach(() => { vi.resetAllMocks(); api.canManage = true; });

const base: MerchantDiscount = {
  id: "d1", title: "Summer sale", method: "code", code: "SUMMER20", type: "product_amount", valueType: "percent", value: 20,
  appliesTo: { scope: "collections", productIds: [], collectionIds: ["c1"] }, appliesOncePerOrder: false,
  minimum: { type: "amount", amountMinor: 5000 }, eligibility: { scope: "everyone" }, combinesWith: { product: false, order: false, shipping: true },
  maxShippingMinor: null, buyXGetY: null, usageLimit: 100, oncePerCustomer: false,
  startsAt: "2026-12-01T00:00:00Z", endsAt: "2027-01-01T00:00:00Z", active: true,
  createdAt: "2026-11-20T10:00:00Z", updatedAt: "2026-11-20T10:00:00Z", status: "active", uses: 12, codeCount: 1, paidOrders: 10, salesMinor: 64000, givenMinor: 9000,
};
const freeShipping: MerchantDiscount = { ...base, id: "d2", title: "Free delivery over £30", method: "automatic", code: null, type: "free_shipping", valueType: null, value: 0, appliesTo: { scope: "all", productIds: [], collectionIds: [] }, minimum: { type: "amount", amountMinor: 3000 }, usageLimit: null, startsAt: null, endsAt: null, status: "disabled", active: false, uses: 0, codeCount: 0, paidOrders: 0, salesMinor: 0, givenMinor: 0 };
const usedUp: MerchantDiscount = { ...base, id: "d3", title: "Flash", code: "FLASH", status: "used_up", uses: 100, usageLimit: 100 };
const listing = (discounts: MerchantDiscount[]): DiscountList => ({ discounts, timeZone: "Europe/London", totals: { active: 1, uses: 112, paidOrders: 10, salesMinor: 64000, givenMinor: 9000 } });
const page = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>);

describe("discounts list", () => {
  it("shows each discount in plain words, with results", async () => {
    api.list.mockResolvedValue(listing([base, freeShipping]));
    page(<DiscountsPage />);
    const table = await screen.findByRole("table");
    const row = within(table).getByRole("link", { name: "Summer sale" }).closest("tr")!;
    expect(within(row).getByText("SUMMER20")).toBeVisible();
    expect(within(row).getByText(/^20% off products in 1 collection, when the customer spends at least £50.00 on those items, from 1 Dec to 31 Dec 2026, limited to 100 uses/)).toBeVisible();
    expect(within(row).getByText("Amount off products")).toBeVisible();
    expect(within(row).getByText("12 of 100")).toBeVisible();
    expect(within(row).getByText("£640.00")).toBeVisible();
    expect(within(row).getByText("1 Dec – 31 Dec 2026")).toBeVisible();
    const other = within(table).getByRole("link", { name: "Free delivery over £30" }).closest("tr")!;
    expect(within(other).getByText("Automatic")).toBeVisible();
    expect(within(other).getByText("Switched off")).toBeVisible();
    expect(within(other).getByText("None yet")).toBeVisible();
    expect(screen.getByText("£90.00")).toBeVisible(); // given away
    expectNoRawCodes();
  });

  it("filters by tab, type and method, and searches by code", async () => {
    api.list.mockResolvedValue(listing([base, freeShipping, usedUp]));
    const user = userEvent.setup();
    page(<DiscountsPage />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("tab", { name: /Expired/ }));
    expect(screen.getByRole("link", { name: "Flash" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Summer sale" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /All/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Method" }), "automatic");
    expect(screen.getAllByRole("link", { name: /sale|Free|Flash/ }).map((link) => link.textContent)).toEqual(["Free delivery over £30"]);
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.type(screen.getByRole("searchbox", { name: "Search by title or code" }), "flash");
    expect(screen.getAllByRole("link", { name: /sale|Free|Flash/ }).map((link) => link.textContent)).toEqual(["Flash"]);
  });

  it("switches several discounts off at once", async () => {
    api.list.mockResolvedValue(listing([base, usedUp]));
    api.bulk.mockResolvedValue(2);
    const user = userEvent.setup();
    page(<DiscountsPage />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("checkbox", { name: /Select all/ }));
    await user.click(screen.getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(api.bulk).toHaveBeenCalledWith(["d1", "d3"], "disable"));
    expect(await screen.findByText("2 discounts switched off")).toBeInTheDocument();
  });

  it("asks before deleting and says how many", async () => {
    api.list.mockResolvedValue(listing([base, usedUp]));
    api.bulk.mockResolvedValue(2);
    const user = userEvent.setup();
    page(<DiscountsPage />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("checkbox", { name: /Select all/ }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete 2 discounts?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete discounts" }));
    await waitFor(() => expect(api.bulk).toHaveBeenCalledWith(["d1", "d3"], "delete"));
  });

  it("starts with a helpful empty state, the type picker and templates", async () => {
    api.list.mockResolvedValue(listing([]));
    const user = userEvent.setup();
    const { container } = page(<DiscountsPage />);
    expect(await screen.findByRole("heading", { name: "Create your first discount" })).toBeVisible();
    expect(screen.getByRole("link", { name: "10% off a first order" })).toBeVisible();
    await user.click(screen.getAllByRole("button", { name: "Create discount" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Create discount" });
    expect(within(dialog).getByRole("radio", { name: /Amount off products/ })).toBeChecked();
    expect(within(dialog).getByText(/For example: £10 off orders over £50/)).toBeInTheDocument();
    const results = await axe.run(document.body, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    await user.click(within(dialog).getByRole("radio", { name: /Buy X get Y/ }));
    await user.click(within(dialog).getByRole("radio", { name: /Automatic/ }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenCalledWith("/admin/s/store-a/discounts/new?type=buy_x_get_y&method=automatic");
    void container;
  });

  it("opens a template straight from the picker", async () => {
    api.list.mockResolvedValue(listing([base]));
    const user = userEvent.setup();
    page(<DiscountsPage />);
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Create discount" }));
    await user.click(await screen.findByRole("button", { name: /Free shipping over £50/ }));
    expect(push).toHaveBeenCalledWith("/admin/s/store-a/discounts/new?template=free-shipping-50");
  });

  it("passes the accessibility checks with discounts listed", async () => {
    api.list.mockResolvedValue(listing([base, freeShipping]));
    const { container } = page(<DiscountsPage />);
    await screen.findByRole("table");
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("lets staff who can't change discounts only look", async () => {
    api.canManage = false;
    api.list.mockResolvedValue(listing([base]));
    page(<DiscountsPage />);
    await screen.findByRole("table");
    expect(screen.queryByRole("button", { name: "Create discount" })).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Select all/ })).not.toBeInTheDocument();
  });
});

describe("discount page", () => {
  it("explains the discount and its results, and can switch it off or duplicate it", async () => {
    api.get.mockResolvedValue(base);
    api.list.mockResolvedValue(listing([base]));
    api.bulk.mockResolvedValue(1);
    api.duplicate.mockResolvedValue({ ...base, id: "d9", title: "Copy of Summer sale", active: false });
    const user = userEvent.setup();
    const { container } = page(<DiscountPage />);
    expect(await screen.findByRole("heading", { name: "Summer sale" })).toBeVisible();
    expect(screen.getByText(/^20% off products in 1 collection/)).toBeVisible();
    expect(screen.getByText("£64.00")).toBeVisible(); // average order: £640 over 10 orders
    expect(screen.getByText("Europe/London time", { exact: false })).toBeVisible();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Switch off" }));
    await waitFor(() => expect(api.bulk).toHaveBeenCalledWith(["d1"], "disable"));
    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/s/store-a/discounts/d9"));
  });

  it("says plainly when a discount no longer exists", async () => {
    const { DiscountRequestError } = await import("@/features/discounts/api");
    api.get.mockRejectedValue(new DiscountRequestError("That discount no longer exists.", 404, "DISCOUNT_NOT_FOUND"));
    api.list.mockResolvedValue(listing([]));
    page(<DiscountPage />);
    expect(await screen.findByText("That discount no longer exists.")).toBeVisible();
  });
});
