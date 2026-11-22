import { render, screen, waitFor, within } from "@testing-library/react";
import { expectNoRawCodes } from "@/test/raw-codes";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import CustomersPage from "./page";
import NewCustomerPage from "./new/page";
import CustomerDetailPage from "./[id]/page";
import { customersCsv } from "@/features/admin/customers/customers-csv";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useParams: () => ({ id: "email%3Aasha%40example.com" }), usePathname: () => "/admin/customers" }));
vi.mock("@/features/auth/providers/auth-provider", () => {
  const activeStore = { id: "store-a", currency: "GBP" };
  const session = { access_token: "token" };
  return { useAuth: () => ({ activeStore, session }), authApiOrigin: () => "http://api.local" };
});
afterEach(() => { vi.unstubAllGlobals(); push.mockReset(); });

const asha = { id: "email:asha@example.com", name: "Asha Rao", email: "asha@example.com", firstName: "Asha", lastName: "Rao", phone: "", note: "", tags: ["VIP"], address: null, location: "London, GB", acceptsEmailMarketing: true, orderCount: 2, lifetimeSpendMinor: 12000, latestOrderAt: "2026-11-01T10:00:00.000Z", createdAt: null, revision: 0 };
const sam = { ...asha, id: "email:sam@example.com", name: "Sam Lee", email: "sam@example.com", firstName: "Sam", lastName: "Lee", tags: [], location: null, acceptsEmailMarketing: false, orderCount: 0, lifetimeSpendMinor: 0, latestOrderAt: null };
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("customer pages", () => {
  it("lists customers with views and search", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ customers: [asha, sam] })));
    const user = userEvent.setup();
    const { container } = render(<CustomersPage />);
    expect(await screen.findByText("Asha Rao")).toBeVisible();
    expectNoRawCodes();
    expect(screen.getByRole("tab", { name: /Never ordered/ })).toHaveTextContent("1");
    await user.click(screen.getByRole("tab", { name: /Email subscribers/ }));
    expect(screen.queryByText("Sam Lee")).toBeNull();
    await user.click(screen.getByRole("tab", { name: /^All/ }));
    await user.type(screen.getByRole("searchbox", { name: "Search customers" }), "vip");
    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.queryByText("Sam Lee")).toBeNull();
    const results = await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  it("filters by tag and place, sorts, and pages through long lists", async () => {
    const lou = { ...asha, id: "email:lou@example.com", name: "Lou Park", email: "lou@example.com", tags: ["Trade"], location: "Leeds, GB", orderCount: 9, lifetimeSpendMinor: 90000 };
    const crowd = Array.from({ length: 60 }, (_, index) => ({ ...sam, id: `email:c${index}@example.com`, name: `Customer ${String(index).padStart(2, "0")}`, email: `c${index}@example.com` }));
    vi.stubGlobal("fetch", vi.fn(() => json({ customers: [asha, sam, lou, ...crowd] })));
    const user = userEvent.setup();
    render(<CustomersPage />);
    expect(await screen.findByText("Asha Rao")).toBeVisible();
    expect(screen.getByText("63 customers · Page 1 of 2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Sam Lee")).toBeVisible();
    expect(screen.queryByText("Asha Rao")).toBeNull();
    // A filter goes back to the first page and narrows the list.
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by tag" }), "Trade");
    expect(screen.getByText("1 customer")).toBeVisible();
    expect(screen.getByText("Lou Park")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by place" }), "London, GB");
    expect(screen.getByText("Asha Rao")).toBeVisible();
    expect(screen.queryByText("Lou Park")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Sort customers" }), "spent");
    const names = screen.getAllByRole("row").slice(1, 3).map((row) => row.textContent);
    expect(names[0]).toContain("Lou Park");
    expect(names[1]).toContain("Asha Rao");
  });

  it("adds a customer and opens them", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => init?.method === "POST" ? json({ customer: { ...sam, orders: [] } }, 201) : json({}));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<NewCustomerPage />);
    await user.type(screen.getByLabelText("First name"), "Sam");
    await user.type(screen.getByLabelText("Email"), "sam@example.com");
    await user.type(screen.getByLabelText(/Town or city/), "Leeds");
    await user.type(screen.getByLabelText("Tags"), "wholesale{Enter}");
    await user.click(screen.getByRole("button", { name: "Save customer" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/customers/email%3Asam%40example.com"));
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body));
    expect(body).toMatchObject({ email: "sam@example.com", firstName: "Sam", tags: ["wholesale"], address: { city: "Leeds" }, acceptsEmailMarketing: false });
  });

  it("edits a customer with their revision and shows their orders", async () => {
    const detail = { ...asha, orders: [{ id: "o1", number: "JS-1", status: "DELIVERED", totalMinor: 12000, currency: "GBP", createdAt: "2026-10-01T10:00:00.000Z" }] };
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => init?.method === "PATCH" ? json({ customer: { ...detail, note: "Morning delivery", revision: 1 } }) : json({ customer: detail }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<CustomerDetailPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Asha Rao" })).toBeVisible();
    expect(screen.getByText("Delivered")).toBeVisible();
    expect(screen.getByLabelText("Email")).toHaveAttribute("readonly");
    await user.type(screen.getByLabelText("Note"), "Morning delivery");
    await user.click(screen.getByRole("checkbox", { name: /agreed to receive marketing emails/ }));
    await user.click(within(screen.getByRole("region", { name: "Unsaved changes" })).getByRole("button", { name: "Save customer" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/customers/email%3Aasha%40example.com"), expect.objectContaining({ method: "PATCH" })));
    const body = JSON.parse(String(fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")![1]!.body));
    expect(body).toMatchObject({ note: "Morning delivery", acceptsEmailMarketing: false, revision: 0, tags: ["VIP"] });
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull());
  });

  it("exports readable CSV", () => {
    expect(customersCsv([asha]).split("\r\n")[1]).toBe('"Asha","Rao","Asha Rao","asha@example.com","","Yes","London, GB","2","120.00","VIP",""');
  });
});
