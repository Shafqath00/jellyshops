import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import type { MerchantDiscount } from "./api";
import type { DiscountFormData } from "./use-form-data";
import { NewDiscount } from "./new-discount";
import { DiscountDetail } from "./discount-detail";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push }), useParams: () => ({ shop: "store-a" }), usePathname: () => "/admin/s/store-a/discounts/new" }));
const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), get: vi.fn(), list: vi.fn(), bulk: vi.fn(), duplicate: vi.fn(), codeCheck: vi.fn(), generateCode: vi.fn() }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  useDiscountsApi: () => ({ ...api, remove: vi.fn(), ready: true, storeId: "store-a", currency: "GBP", canManage: true }),
}));
const formData: DiscountFormData = {
  loading: false, timeZone: "Europe/London",
  names: { products: { mug: { title: "Stoneware mug", active: true }, old: { title: "Old vase", active: false } }, collections: { summer: { title: "Summer", count: 4 } } },
  customers: [{ email: "sam@example.test", name: "Sam" }], customerTags: ["vip"], discounts: [],
};
vi.mock("./use-form-data", () => ({ useDiscountFormData: () => formData }));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.codeCheck.mockResolvedValue({ code: "X", available: true, message: null });
  api.list.mockResolvedValue({ discounts: [], timeZone: "Europe/London", totals: { active: 0, uses: 0, paidOrders: 0, salesMinor: 0, givenMinor: 0 } });
});
const page = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>);
const saved = (extra: Partial<MerchantDiscount> = {}) => ({ id: "new1", title: "Saved", status: "active", uses: 0, ...extra }) as MerchantDiscount;
const axeClean = async (node: Element) => (await axe.run(node, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`);

describe("discount form", () => {
  it("saves a template as it comes and opens the new discount", async () => {
    api.create.mockResolvedValue(saved({ title: "10% off your first order" }));
    const user = userEvent.setup();
    page(<NewDiscount type={null} method={null} template="first-order-10" />);
    expect(screen.getByRole("heading", { name: "10% off a first order" })).toBeVisible();
    expect(screen.getByText(/10% off the whole order, for first orders only, from \d+ \w+ \d{4}, one use per customer, with code WELCOME10/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save discount" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![0]).toMatchObject({ method: "code", code: "WELCOME10", type: "order_amount", valueType: "percent", value: 10, eligibility: { scope: "first_order" }, oncePerCustomer: true });
    expect(push).toHaveBeenCalledWith("/admin/s/store-a/discounts/new1");
  });

  it("shows what's wrong under each field and doesn't send anything", async () => {
    const user = userEvent.setup();
    page(<NewDiscount type="product_amount" method="automatic" template={null} />);
    await user.clear(screen.getByRole("textbox", { name: "Percentage off" }));
    await user.type(screen.getByRole("textbox", { name: "Percentage off" }), "150");
    await user.click(screen.getByRole("button", { name: "Save discount" }));
    expect(await screen.findByText("Some details need a look. They're marked below.")).toBeVisible();
    expect(screen.getByText("Give the discount a title. Customers see it in their bag and at checkout.")).toBeVisible();
    expect(screen.getByText("Enter a whole percentage from 1 to 100.")).toBeVisible();
    expect(screen.getByText("Choose at least one collection.")).toBeVisible();
    expect(api.create).not.toHaveBeenCalled();
    // Problems clear as they're fixed.
    await user.type(screen.getByRole("textbox", { name: /Title/ }), "Summer sale");
    expect(screen.queryByText("Give the discount a title. Customers see it in their bag and at checkout.")).not.toBeInTheDocument();
  });

  it("says when a code is already used, and generates a fresh one", async () => {
    api.codeCheck.mockResolvedValue({ code: "TAKEN", available: false, message: "You already have a discount with that code. Try another." });
    api.generateCode.mockResolvedValue("K7MPQ2XB");
    const user = userEvent.setup();
    page(<NewDiscount type="order_amount" method="code" template={null} />);
    await user.type(screen.getByRole("textbox", { name: /Discount code/ }), "taken");
    expect(await screen.findByText("Another discount already uses this code. Choose a different one.", { selector: ".jk-banner *, .jk-banner" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Generate code/ }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Discount code/ })).toHaveValue("K7MPQ2XB"));
  });

  it("builds buy X get Y from chosen products", async () => {
    api.create.mockResolvedValue(saved());
    // Radix leaves the page unclickable for a moment after a dialog closes; jsdom never finishes that moment.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    page(<NewDiscount type="buy_x_get_y" method="code" template={null} />);
    await user.type(screen.getByRole("textbox", { name: /Discount code/ }), "MUGS");
    const buys = screen.getByRole("group", { name: "From" });
    await user.click(within(buys).getByRole("button", { name: "Choose products" }));
    const picker = await screen.findByRole("dialog", { name: "Choose products" });
    await user.click(await within(picker).findByText("Stoneware mug"));
    await user.click(within(picker).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const gets = screen.getByRole("group", { name: "Which items" });
    await user.click(within(gets).getByRole("button", { name: "Choose products" }));
    const picker2 = await screen.findByRole("dialog", { name: "Choose products" });
    await user.click(await within(picker2).findByText("Stoneware mug"));
    await user.click(within(picker2).getByRole("button", { name: "Done" }));
    expect(screen.getByText(/Buy 1 Stoneware mug, get 1 more free/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save discount" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![0]).toMatchObject({ type: "buy_x_get_y", buyXGetY: { buysItems: { scope: "products", productIds: ["mug"] }, getsItems: { productIds: ["mug"] }, getsValue: { type: "free" }, maxUsesPerOrder: 1 } });
  });

  it("warns about chosen products that aren't on sale", async () => {
    const user = userEvent.setup();
    page(<NewDiscount type="product_amount" method="code" template={null} />);
    await user.click(screen.getByRole("radio", { name: "Specific products" }));
    await user.click(screen.getByRole("button", { name: "Choose products" }));
    await user.click(await screen.findByText("Old vase"));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByText("None of the chosen products are on sale, so this discount can't apply to anything yet.")).toBeVisible();
  });

  it("passes the accessibility checks", async () => {
    const { container } = page(<NewDiscount type="buy_x_get_y" method="code" template={null} />);
    expect(await axeClean(container)).toEqual([]);
    cleanup();
    const second = page(<NewDiscount type="product_amount" method="automatic" template={null} />);
    expect(await axeClean(second.container)).toEqual([]);
  });

  it("edits a saved discount and keeps its code once used", async () => {
    const discount = {
      id: "d1", title: "Spring", method: "code", code: "SPRING", type: "order_amount", valueType: "percent", value: 15,
      appliesTo: { scope: "all", productIds: [], collectionIds: [] }, appliesOncePerOrder: false, minimum: { type: "none" }, eligibility: { scope: "everyone" },
      combinesWith: { product: false, order: false, shipping: true }, maxShippingMinor: null, buyXGetY: null, usageLimit: null, oncePerCustomer: false,
      startsAt: "2026-11-01T09:00:00Z", endsAt: null, active: true, createdAt: "2026-11-01T09:00:00Z", updatedAt: "2026-11-01T09:00:00Z",
      status: "active", uses: 3, codeCount: 1, paidOrders: 3, salesMinor: 9000, givenMinor: 1350,
    } as MerchantDiscount;
    api.get.mockResolvedValue(discount);
    api.update.mockResolvedValue({ ...discount, value: 20, updatedAt: "2026-11-02T00:00:00Z" });
    const user = userEvent.setup();
    page(<DiscountDetail id="d1" />);
    const code = await screen.findByRole("textbox", { name: /Discount code/ });
    expect(code).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Percentage off" }));
    await user.type(screen.getByRole("textbox", { name: "Percentage off" }), "20");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith("d1", expect.objectContaining({ code: "SPRING", value: 20, startsAt: "2026-11-01T09:00:00.000Z" })));
    expect(await screen.findByText("Discount saved")).toBeInTheDocument();
    expect(screen.getByText("£30.00")).toBeVisible(); // average order in Results
  });
});
