import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe, { type AxeResults } from "axe-core";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AdminPage, Banner, Button, Combobox, ConfirmDialog, EmptyState, Field, HelpTip, IndexTable, Picker, ResourceForm, StatusBadge, TableSkeleton, Tabs, ToastProvider,
  humanizeCode, statusLabel, statusOptions, useToast, type IndexColumn,
} from "./index";

async function violations(container: HTMLElement): Promise<string[]> {
  const results: AxeResults = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, rules: { "color-contrast": { enabled: false }, region: { enabled: false }, "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } } });
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`);
}

type Row = { id: string; name: string; status: string };
const rows: Row[] = [{ id: "a", name: "Alpha", status: "PENDING_PAYMENT" }, { id: "b", name: "Beta", status: "DELIVERED" }];
const columns: IndexColumn<Row>[] = [
  { id: "name", header: "Name", mobile: "primary", cell: (row) => <a href={`/rows/${row.id}`}>{row.name}</a> },
  { id: "status", header: "Status", cell: (row) => <StatusBadge kind="order" value={row.status} /> },
];

describe("status labels", () => {
  it("turns API codes into merchant words and falls back to sentence case", () => {
    expect(statusLabel("order", "PENDING_PAYMENT")).toBe("Waiting for payment");
    expect(statusLabel("payment", "paid")).toBe("Paid");
    expect(statusLabel("fulfilment", "OUT_FOR_DELIVERY")).toBe("Out for delivery");
    expect(statusLabel("order", "ON_HOLD")).toBe("On hold");
    expect(statusLabel("order", null)).toBe("None");
    expect(humanizeCode("PARTIALLY_RECEIVED")).toBe("Partially received");
    expect(statusOptions("payment", ["PENDING", "FAILED"])).toEqual([{ value: "PENDING", label: "Payment pending" }, { value: "FAILED", label: "Payment failed" }]);
  });
});

describe("AdminPage", () => {
  it("shows title, description and actions; More actions closes with Escape", async () => {
    const user = userEvent.setup();
    const archive = vi.fn();
    const { container } = render(<AdminPage title="Order JS-1" description="One order." back={{ href: "/admin/orders", label: "Orders" }} badges={<StatusBadge kind="payment" value="PAID" />}
      primaryAction={{ label: "Fulfil items", onAction: vi.fn() }} secondaryActions={[{ label: "Print", onAction: vi.fn() }]} moreActions={[{ label: "Archive", onAction: archive }]}><p>Body</p></AdminPage>);
    expect(screen.getByRole("heading", { level: 1, name: "Order JS-1" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Back to Orders" })).toHaveAttribute("href", "/admin/orders");
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(archive).toHaveBeenCalledOnce();
    expect(await violations(container)).toEqual([]);
  });
});

describe("IndexTable", () => {
  it("selects rows, runs a bulk action with their ids and clears the selection", async () => {
    const user = userEvent.setup();
    const exportRows = vi.fn();
    const onTab = vi.fn();
    const { container } = render(<IndexTable label="Orders" rows={rows} rowKey={(row) => row.id} rowLabel={(row) => row.name} columns={columns}
      tabs={[{ id: "", label: "All", count: 2 }, { id: "open", label: "Open" }]} activeTab="" onTabChange={onTab}
      search={{ value: "", onChange: vi.fn(), label: "Search orders", placeholder: "Search" }}
      bulkActions={[{ label: "Export", onAction: exportRows }]} emptyState={<p>None</p>} pagination={{ summary: "2 orders", hasPrevious: false, hasNext: true, onPrevious: vi.fn(), onNext: vi.fn() }} />);
    expect(screen.getByText("Waiting for payment")).toBeVisible();
    expect(screen.queryByText("PENDING_PAYMENT")).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Open" }));
    expect(onTab).toHaveBeenCalledWith("open");
    await user.click(screen.getByRole("checkbox", { name: "Select all orders on this page" }));
    expect(screen.getByText("2 selected")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(exportRows).toHaveBeenCalledWith(["a", "b"]);
    await waitFor(() => expect(screen.queryByText("2 selected")).toBeNull());
    await user.click(screen.getByRole("checkbox", { name: "Select Beta" }));
    expect((screen.getByRole("checkbox", { name: "Select all orders on this page" }) as HTMLInputElement).indeterminate).toBe(true);
    // Cells carry their column name so phones can show them as labelled card rows.
    expect(container.querySelector("td[data-label='Status']")).not.toBeNull();
    expect(container.querySelector("td[data-mobile='primary']")).not.toBeNull();
    expect(await violations(container)).toEqual([]);
  });

  it("opens a row's link when the row is clicked but not when a checkbox is", async () => {
    const user = userEvent.setup();
    const clicks: string[] = [];
    const { container } = render(<IndexTable label="Orders" rows={rows} rowKey={(row) => row.id} rowLabel={(row) => row.name} columns={columns} bulkActions={[{ label: "Export", onAction: vi.fn() }]} emptyState={<p>None</p>} />);
    container.querySelectorAll("a").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); clicks.push(link.getAttribute("href") ?? ""); }));
    await user.click(screen.getByText("Delivered"));
    expect(clicks).toEqual(["/rows/b"]);
    await user.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    expect(clicks).toEqual(["/rows/b"]);
  });

  it("shows a skeleton while loading, the empty state, and an error with Try again", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const props = { label: "Orders", rowKey: (row: Row) => row.id, rowLabel: (row: Row) => row.name, columns, emptyState: <EmptyState title="No orders yet" description="Orders appear here." /> };
    const view = render(<IndexTable {...props} rows={[]} loading />);
    expect(screen.getByRole("status", { name: "Loading orders" })).toBeInTheDocument();
    view.rerender(<IndexTable {...props} rows={[]} />);
    expect(screen.getByRole("heading", { name: "No orders yet" })).toBeVisible();
    view.rerender(<IndexTable {...props} rows={[]} error="Network down" onRetry={retry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load orders");
    expect(screen.queryByRole("heading", { name: "No orders yet" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("keeps the selection when a bulk action fails and says why", async () => {
    const user = userEvent.setup();
    render(<IndexTable label="Products" rows={rows} rowKey={(row) => row.id} rowLabel={(row) => row.name} columns={columns} bulkActions={[{ label: "Archive", onAction: () => Promise.reject(new Error("1 of 2 products could not be changed.")) }]} emptyState={<p>None</p>} />);
    await user.click(screen.getByRole("checkbox", { name: "Select Alpha" }));
    await user.click(screen.getByRole("button", { name: "Archive" }));
    expect(await screen.findByText("1 of 2 products could not be changed.")).toBeVisible();
    expect(screen.getByText("1 selected")).toBeVisible();
  });
});

function DemoForm({ submit }: { submit: () => Promise<void> }) {
  const [name, setName] = useState("Tee");
  const [saved, setSaved] = useState("Tee");
  return <ResourceForm dirty={name !== saved} onDiscard={() => setName(saved)} onSubmit={async () => { await submit(); setSaved(name); }}>
    <label htmlFor="name">Name</label><input id="name" value={name} onChange={(event) => setName(event.target.value)} />
  </ResourceForm>;
}

describe("ResourceForm", () => {
  it("shows the save bar only with unsaved changes, keeps edits after a failed save, and discards", async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValueOnce(new Error("Price must be above zero.")).mockResolvedValue(undefined);
    const { container } = render(<DemoForm submit={submit} />);
    expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull();
    await user.type(screen.getByLabelText("Name"), "s");
    expect(screen.getByRole("region", { name: "Unsaved changes" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Price must be above zero.");
    expect(screen.getByLabelText("Name")).toHaveValue("Tees");
    expect(await violations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Unsaved changes" })).toBeNull());
    await user.type(screen.getByLabelText("Name"), "!");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Tees");
  });
});

describe("dialogs", () => {
  it("ConfirmDialog stays open with the error when the action fails", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} title="Delete Linen Tote?" description="This cannot be undone." confirmLabel="Delete product" destructive onConfirm={() => Promise.reject(new Error("Product is in an open order."))} />);
    const dialog = screen.getByRole("dialog", { name: "Delete Linen Tote?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete product" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Product is in an open order.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(await violations(dialog)).toEqual([]);
  });

  it("Picker searches, selects and returns the chosen items", async () => {
    const user = userEvent.setup();
    const load = vi.fn(async (query: string) => [{ id: "p1", label: "Linen Tote" }, { id: "p2", label: "Crew Tee" }].filter((item) => item.label.toLowerCase().includes(query.toLowerCase())));
    const onDone = vi.fn();
    render(<Picker open onOpenChange={vi.fn()} title="Add products" searchLabel="Search products" load={load} onDone={onDone} />);
    expect(await screen.findByText("Linen Tote")).toBeVisible();
    await user.type(screen.getByRole("searchbox", { name: "Search products" }), "crew");
    await waitFor(() => expect(screen.queryByText("Linen Tote")).toBeNull());
    await user.click(screen.getByRole("checkbox", { name: /Crew Tee/ }));
    expect(screen.getByText("1 selected")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalledWith([{ id: "p2", label: "Crew Tee" }]);
    expect(await violations(screen.getByRole("dialog"))).toEqual([]);
  });
});

function ToastButton() {
  const toast = useToast();
  return <button type="button" onClick={() => toast("Product saved")}>Save</button>;
}

describe("feedback", () => {
  it("toast announces the result and hides after five seconds", async () => {
    vi.useFakeTimers();
    try {
      render(<ToastProvider><ToastButton /></ToastProvider>);
      act(() => screen.getByRole("button", { name: "Save" }).click());
      expect(screen.getByText("Product saved")).toBeInTheDocument();
      act(() => { vi.advanceTimersByTime(5100); });
      expect(screen.queryByText("Product saved")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("useToast does nothing without a provider", () => {
    render(<ToastButton />);
    expect(() => screen.getByRole("button", { name: "Save" }).click()).not.toThrow();
  });

  it("banners, empty states, help tips and skeletons are accessible", async () => {
    const { container } = render(<div>
      <Banner tone="critical" title="Payment failed">The card was declined.</Banner>
      <Banner tone="success">Saved</Banner>
      <EmptyState title="No customers yet" description="Customers appear after their first order." action={<button type="button">Add customer</button>} />
      <label>Compare-at price <HelpTip>The price before your discount. Shoppers see it crossed out.</HelpTip></label>
      <TableSkeleton label="Loading customers" />
    </div>);
    expect(screen.getByRole("alert")).toHaveTextContent("Payment failed");
    expect(screen.getByRole("button", { name: "More information" })).toBeInTheDocument();
    expect(await violations(container)).toEqual([]);
  });
});

describe("Button", () => {
  it("cannot be pressed while loading and tells screen readers it is busy", async () => {
    const user = userEvent.setup();
    const save = vi.fn();
    const view = render(<Button variant="primary" onClick={save}>Save product</Button>);
    await user.click(screen.getByRole("button", { name: "Save product" }));
    expect(save).toHaveBeenCalledOnce();
    view.rerender(<Button variant="primary" loading loadingLabel="Saving…" onClick={save}>Save product</Button>);
    const busy = screen.getByRole("button", { name: "Saving…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    await user.click(busy);
    expect(save).toHaveBeenCalledOnce();
    expect(await violations(view.container)).toEqual([]);
  });

  it("maps variants and sizes to kit classes and defaults to type=button", () => {
    render(<><Button variant="destructive" size="small">Delete product</Button><Button variant="quiet">Clear</Button></>);
    expect(screen.getByRole("button", { name: "Delete product" })).toHaveClass("jk-button", "jk-button-critical-solid", "jk-button-sm");
    expect(screen.getByRole("button", { name: "Delete product" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Clear" })).toHaveClass("jk-button-plain");
  });
});

describe("Tabs", () => {
  it("moves between tabs with the arrow keys and chooses with Enter", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<Tabs label="Order views" tabs={[{ id: "", label: "All" }, { id: "open", label: "Open" }, { id: "done", label: "Done" }]} active="" onChange={onChange} />);
    await user.tab();
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Open" })).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledWith("open");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Done" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}{Home}");
    expect(screen.getByRole("tab", { name: "All" })).toHaveFocus();
    expect(await violations(container)).toEqual([]);
  });
});

describe("IndexTable sorting", () => {
  it("sorts from a column heading and says which way the rows are sorted", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const sortable: IndexColumn<Row>[] = [{ ...columns[0], sortKey: "name" }, columns[1]];
    const props = { label: "Orders", rows, rowKey: (row: Row) => row.id, rowLabel: (row: Row) => row.name, columns: sortable, emptyState: <p>None</p> };
    const view = render(<IndexTable {...props} sort={{ key: "name", direction: "asc", onChange }} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: "Status" })).not.toHaveAttribute("aria-sort");
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onChange).toHaveBeenCalledWith("name", "desc");
    view.rerender(<IndexTable {...props} sort={{ key: "other", direction: "desc", onChange }} />);
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("aria-sort", "none");
    await user.click(screen.getByRole("button", { name: "Name" }));
    expect(onChange).toHaveBeenLastCalledWith("name", "asc");
    expect(await violations(view.container)).toEqual([]);
  });
});

describe("Field", () => {
  it("marks required fields and ties help and error text to the control", async () => {
    const { container } = render(<Field id="price" label="Price" required help="Like 499 or 499.50." error="Enter a price."><input id="price" defaultValue="" /></Field>);
    const input = screen.getByLabelText(/Price/);
    expect(input).toHaveAttribute("aria-required", "true");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Like 499 or 499.50. Enter a price.");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a price.");
    expect(await violations(container)).toEqual([]);
  });

  it("leaves a control alone when it has no help, error or required mark", () => {
    render(<Field id="name" label="Name"><input id="name" /></Field>);
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveAttribute("aria-required");
  });
});

const COUNTRY_OPTIONS = [{ value: "GB", label: "United Kingdom" }, { value: "IN", label: "India" }, { value: "IE", label: "Ireland" }];
function DemoCombobox({ allowCustom = false, onValue }: { allowCustom?: boolean; onValue: (value: string) => void }) {
  const [value, setValue] = useState("GB");
  return <Field id="country" label="Country" help="Type to search."><Combobox id="country" value={value} options={COUNTRY_OPTIONS} allowCustom={allowCustom} onChange={(next) => { setValue(next); onValue(next); }} /></Field>;
}

describe("Combobox", () => {
  it("shows the current choice, narrows as you type and picks with the keyboard", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    const { container } = render(<DemoCombobox onValue={onValue} />);
    const input = screen.getByRole("combobox", { name: "Country" });
    expect(input).toHaveValue("United Kingdom");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.click(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(await violations(container)).toEqual([]);
    await user.clear(input);
    await user.type(input, "i");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["United Kingdom", "India", "Ireland"]);
    await user.type(input, "r");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Ireland"]);
    await user.keyboard("{Enter}");
    expect(onValue).toHaveBeenLastCalledWith("IE");
    expect(input).toHaveValue("Ireland");
    expect(input).toHaveAttribute("aria-expanded", "false");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(onValue).toHaveBeenLastCalledWith("IN");
  });

  it("keeps the old choice when Escape is pressed or nothing matches", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<DemoCombobox onValue={onValue} />);
    const input = screen.getByRole("combobox", { name: "Country" });
    await user.clear(input);
    await user.type(input, "zzz");
    expect(screen.getByRole("status")).toHaveTextContent("No matches");
    await user.keyboard("{Escape}");
    expect(input).toHaveValue("United Kingdom");
    await user.type(input, "zzz");
    await user.tab();
    expect(input).toHaveValue("United Kingdom");
    expect(onValue).not.toHaveBeenCalledWith("zzz");
  });

  it("with allowCustom keeps a typed value that is not in the list", async () => {
    const user = userEvent.setup();
    const onValue = vi.fn();
    render(<DemoCombobox allowCustom onValue={onValue} />);
    const input = screen.getByRole("combobox", { name: "Country" });
    await user.clear(input);
    await user.type(input, "Wales");
    expect(screen.getByRole("option", { name: 'Use "Wales"' })).toBeVisible();
    await user.click(screen.getByRole("option", { name: 'Use "Wales"' }));
    expect(onValue).toHaveBeenLastCalledWith("Wales");
    expect(input).toHaveValue("Wales");
  });
});
