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
const api = vi.hoisted(() => ({ listCodes: vi.fn(), generateCodes: vi.fn(), downloadCodes: vi.fn(), create: vi.fn(), update: vi.fn(), get: vi.fn(), list: vi.fn(), bulk: vi.fn(), duplicate: vi.fn(), codeCheck: vi.fn(), generateCode: vi.fn() }));
vi.mock("./api", async (original) => ({
  ...(await original<typeof import("./api")>()),
  useDiscountsApi: () => ({ ...api, remove: vi.fn(), ready: true, storeId: "store-a", currency: "GBP", canManage: true }),
}));
const formData: DiscountFormData = {
  loading: false, timeZone: "Europe/London",
  names: { products: { mug: { title: "Stoneware mug", active: true }, old: { title: "Old vase", active: false } }, collections: { summer: { title: "Summer", count: 4 } } },
  customers: [{ email: "sam@example.test", name: "Sam" }], customerTags: ["vip"], discounts: [],
  catalog: [{ id: "mug", title: "Stoneware mug", priceMinor: 1800, collectionIds: ["summer"], active: true }, { id: "old", title: "Old vase", priceMinor: 3000, collectionIds: [], active: false }],
  shippingMinor: 495,
};
vi.mock("./use-form-data", () => ({ useDiscountFormData: () => formData }));
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  api.codeCheck.mockResolvedValue({ code: "X", available: true, message: null });
  api.generateCode.mockResolvedValue("K7MPQ2XB");
  api.listCodes.mockResolvedValue({ codes: [], total: 1 });
  api.downloadCodes.mockResolvedValue(undefined);
  api.list.mockResolvedValue({ discounts: [], timeZone: "Europe/London", totals: { active: 0, uses: 0, paidOrders: 0, salesMinor: 0, givenMinor: 0 } });
});
const page = (node: React.ReactNode) => render(<ToastProvider>{node}</ToastProvider>);
const saved = (extra: Partial<MerchantDiscount> = {}) => ({ id: "new1", title: "Saved", status: "active", uses: 0, ...extra }) as MerchantDiscount;
const axeClean = async (node: Element) => (await axe.run(node, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => `${violation.id}: ${violation.nodes[0]?.html}`);
const discount = (extra: Partial<MerchantDiscount> = {}) => ({
  id: "d1", title: "Spring", method: "code", code: "SPRING", type: "order_amount", valueType: "percent", value: 15,
  appliesTo: { scope: "all", productIds: [], collectionIds: [] }, appliesOncePerOrder: false, minimum: { type: "none" }, eligibility: { scope: "everyone" },
  combinesWith: { product: false, order: false, shipping: true }, maxShippingMinor: null, buyXGetY: null, usageLimit: null, oncePerCustomer: false,
  startsAt: "2026-11-01T09:00:00Z", endsAt: null, active: true, createdAt: "2026-11-01T09:00:00Z", updatedAt: "2026-11-01T09:00:00Z",
  status: "active", uses: 3, codeCount: 1, paidOrders: 3, salesMinor: 9000, givenMinor: 1350, ...extra,
}) as MerchantDiscount;

describe("creating a discount", () => {
  it("is ready to save with a generated code and sensible defaults: type the value, save", async () => {
    api.create.mockResolvedValue(saved());
    const user = userEvent.setup();
    page(<NewDiscount type="product_amount" method="code" template={null} />);
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Discount code/ })).toHaveValue("K7MPQ2XB"));
    expect(screen.getByText("Amount off products")).toBeVisible();
    expect(screen.getByRole("radio", { name: "All products" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "No minimum" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Everyone" })).toBeChecked();
    expect(screen.getAllByText(/Starts now · no end date/)[0]).toBeVisible();
    await user.clear(screen.getByRole("textbox", { name: "Percentage off" }));
    await user.type(screen.getByRole("textbox", { name: "Percentage off" }), "20");
    expect(screen.getByText(/^20% off all products, from \d+ \w+ \d{4}, with code K7MPQ2XB$/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save discount" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![0]).toMatchObject({ method: "code", code: "K7MPQ2XB", type: "product_amount", valueType: "percent", value: 20, appliesTo: { scope: "all" }, endsAt: null });
    expect(push).toHaveBeenCalledWith("/admin/s/store-a/discounts/new1");
  });

  it("keeps advanced settings under More options, and only shows fields for the chosen type", async () => {
    page(<NewDiscount type="free_shipping" method="automatic" template={null} />);
    expect(screen.queryByRole("textbox", { name: "Percentage off" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Applies to" })).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Title/ })).toBeVisible();
    const more = screen.getByText("More options").closest("details")!;
    expect(more).not.toHaveAttribute("open");
  });

  it("checks a field once the merchant leaves it, and everything on save", async () => {
    const user = userEvent.setup();
    page(<NewDiscount type="product_amount" method="automatic" template={null} />);
    const value = screen.getByRole("textbox", { name: "Percentage off" });
    await user.clear(value);
    await user.type(value, "150");
    expect(screen.queryByText("Enter a whole percentage from 1 to 100.")).not.toBeInTheDocument();
    await user.tab();
    expect(screen.getByText("Enter a whole percentage from 1 to 100.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save discount" }));
    expect(await screen.findByText("Some details need a look. They're marked below.")).toBeVisible();
    expect(screen.getByText("Give the discount a title. Customers see it in their bag and at checkout.")).toBeVisible();
    expect(api.create).not.toHaveBeenCalled();
    await user.type(screen.getByRole("textbox", { name: /Title/ }), "Summer sale");
    expect(screen.queryByText("Give the discount a title. Customers see it in their bag and at checkout.")).not.toBeInTheDocument();
  });

  it("says right under the code when it is already used, and makes a new one", async () => {
    api.codeCheck.mockResolvedValue({ code: "TAKEN", available: false, message: "" });
    api.generateCode.mockResolvedValueOnce("FIRST").mockResolvedValueOnce("K7MPQ2XB");
    const user = userEvent.setup();
    page(<NewDiscount type="order_amount" method="code" template={null} />);
    const code = await screen.findByRole("textbox", { name: /Discount code/ });
    await waitFor(() => expect(code).toHaveValue("FIRST"));
    await user.clear(code);
    await user.type(code, "taken");
    expect(await screen.findByText("Another discount already uses this code. Choose a different one.")).toBeVisible();
    expect(code).toHaveAttribute("aria-invalid", "true");
    await user.click(screen.getByRole("button", { name: /New code/ }));
    await waitFor(() => expect(code).toHaveValue("K7MPQ2XB"));
  });

  it("builds buy X get Y from chosen products", async () => {
    api.create.mockResolvedValue(saved());
    // Radix leaves the page unclickable for a moment after a dialog closes; jsdom never finishes that moment.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    page(<NewDiscount type="buy_x_get_y" method="code" template={null} />);
    const summary = screen.getByRole("complementary", { name: "Discount summary" });
    expect(within(summary).getAllByText(/Buy 1 item, get 1 more free/)[0]).toBeVisible();
    const buys = screen.getByRole("group", { name: "From" });
    await user.click(within(buys).getByRole("radio", { name: "Specific products" }));
    await user.click(within(buys).getByRole("button", { name: "Choose products" }));
    const picker = await screen.findByRole("dialog", { name: "Choose products" });
    await user.click(await within(picker).findByText("Stoneware mug"));
    await user.click(within(picker).getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const gets = screen.getByRole("group", { name: "Which items" });
    await user.click(within(gets).getByRole("radio", { name: "Specific products" }));
    await user.click(within(gets).getByRole("button", { name: "Choose products" }));
    const picker2 = await screen.findByRole("dialog", { name: "Choose products" });
    await user.click(await within(picker2).findByText("Stoneware mug"));
    await user.click(within(picker2).getByRole("button", { name: "Done" }));
    expect(within(summary).getAllByText(/Buy 1 Stoneware mug, get 1 more free/)[0]).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save discount" }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0]![0]).toMatchObject({ type: "buy_x_get_y", buyXGetY: { buysItems: { scope: "products", productIds: ["mug"] }, getsItems: { productIds: ["mug"] }, getsValue: { type: "free" }, maxUsesPerOrder: 1 } });
  });

  it("warns next to Applies to about products that aren't on sale", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    page(<NewDiscount type="product_amount" method="code" template={null} />);
    await user.click(screen.getByRole("radio", { name: "Specific products" }));
    await user.click(screen.getByRole("button", { name: "Choose products" }));
    await user.click(await screen.findByText("Old vase"));
    await user.click(screen.getByRole("button", { name: "Done" }));
    const card = screen.getByRole("heading", { name: "Applies to" }).closest(".jk-card") as HTMLElement;
    expect(within(card).getByText("None of the chosen products are on sale, so this discount can't apply to anything yet.")).toBeVisible();
  });

  it("explains who, what and when in the summary, and tests it on a sample bag", async () => {
    const user = userEvent.setup();
    page(<NewDiscount type={null} method={null} template="first-order-10" />);
    const summary = screen.getByRole("complementary", { name: "Discount summary" });
    expect(within(summary).getByText("New customers, on their first order")).toBeVisible();
    expect(within(summary).getByText("10% off the whole order")).toBeVisible();
    expect(within(summary).getByText("one per customer")).toBeVisible();
    await user.click(within(summary).getByText("Test it on a sample bag"));
    await user.selectOptions(within(summary).getByRole("combobox", { name: "Add a product to the sample bag" }), "mug");
    await user.click(within(summary).getByRole("button", { name: "Add" }));
    await user.click(within(summary).getByRole("button", { name: "One more Stoneware mug" }));
    // 2 x £18 = £36, 10% off = £3.60, delivery £4.95.
    expect(within(summary).getByText("−£3.60")).toBeVisible();
    expect(within(summary).getByText("Customer pays").nextSibling).toHaveTextContent("£37.35");
    await user.selectOptions(within(summary).getByRole("combobox", { name: "The customer is" }), "returning");
    expect(within(summary).getByText("This code is for first orders only.")).toBeVisible();
  });

  it("lets the merchant change the type from the form", async () => {
    const user = userEvent.setup();
    page(<NewDiscount type="order_amount" method="code" template={null} />);
    await user.click(screen.getByRole("button", { name: "Change" }));
    const dialog = await screen.findByRole("dialog", { name: "Create discount" });
    expect(within(dialog).getByRole("radio", { name: /Amount off order/ })).toBeChecked();
    await user.click(within(dialog).getByRole("radio", { name: /Free shipping/ }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(push).toHaveBeenCalledWith("/admin/s/store-a/discounts/new?type=free_shipping&method=code");
  });

  it("passes the accessibility checks", async () => {
    const user = userEvent.setup();
    const first = page(<NewDiscount type="buy_x_get_y" method="code" template={null} />);
    await user.click(screen.getByText("More options"));
    expect(await axeClean(first.container)).toEqual([]);
    cleanup();
    const second = page(<NewDiscount type="product_amount" method="automatic" template={null} />);
    await user.click(screen.getByRole("button", { name: "Change dates" }));
    expect(await axeClean(second.container)).toEqual([]);
  });
});

describe("editing a discount", () => {
  it("saves changes, keeps a used code and puts the page actions in one menu", async () => {
    api.get.mockResolvedValue(discount());
    api.update.mockResolvedValue({ ...discount(), value: 20, updatedAt: "2026-11-02T00:00:00Z" });
    api.duplicate.mockResolvedValue(discount({ id: "d9", title: "Copy of Spring", active: false }));
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
    const performance = screen.getByRole("heading", { name: "Performance" }).closest(".jk-card") as HTMLElement;
    expect(within(performance).getByText("£30.00")).toBeVisible(); // average order
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "Disable" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/s/store-a/discounts/d9"));
  });

  it("lists a discount's codes, makes more and downloads them", async () => {
    api.get.mockResolvedValue(discount({ title: "VIP", code: "VIP", uses: 0 }));
    api.listCodes.mockResolvedValue({ codes: [{ code: "VIP", uses: 0, createdAt: "" }], total: 1 });
    api.generateCodes.mockResolvedValue({ created: 50, codes: [] });
    const user = userEvent.setup();
    page(<DiscountDetail id="d1" />);
    const card = (await screen.findByRole("heading", { name: "Codes" })).closest(".jk-card") as HTMLElement;
    expect(await within(card).findByText("Not used")).toBeVisible();
    await user.click(within(card).getByRole("button", { name: "Generate codes" }));
    const dialog = await screen.findByRole("dialog", { name: "Generate codes" });
    await user.type(within(dialog).getByRole("textbox", { name: /Start each code/ }), "vip-");
    await user.type(within(dialog).getByRole("textbox", { name: /How many codes/ }), "{Enter}");
    await waitFor(() => expect(api.generateCodes).toHaveBeenCalledWith("d1", { count: 50, prefix: "VIP-" }));
    // Making codes never saves the discount form around the card.
    expect(api.update).not.toHaveBeenCalled();
    expect(await screen.findByText("50 codes made")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(await screen.findByRole("button", { name: "Download all as CSV" }));
    await waitFor(() => expect(api.downloadCodes).toHaveBeenCalledWith("d1", "vip-codes.csv"));
  });
});
