import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { IndexTable, SelectList, compareValues, useClientList } from "./index";

type Row = { id: string; title: string; products: number };
const ROWS: Row[] = [
  { id: "a", title: "summer", products: 12 }, { id: "b", title: "Beds", products: 3 }, { id: "c", title: "Gifts", products: 40 },
  { id: "d", title: "Autumn", products: 0 }, { id: "e", title: "Sale 10", products: 7 }, { id: "f", title: "Sale 2", products: 7 },
];

function Demo({ pageSize }: { pageSize: number }) {
  const list = useClientList(ROWS, { text: (row) => row.title, sortBy: { title: (row) => row.title, products: (row) => row.products }, initialSort: { key: "title", direction: "asc" }, pageSize, noun: ["collection", "collections"], searchLabel: "Search collections" });
  return <IndexTable label="Collections" rows={list.rows} rowKey={(row) => row.id} rowLabel={(row) => row.title} search={list.search} sort={list.sort} pagination={list.pagination} emptyState={<p>None</p>}
    columns={[{ id: "title", header: "Collection", sortKey: "title", cell: (row) => row.title }, { id: "products", header: "Products", sortKey: "products", cell: (row) => row.products }]} />;
}
const titles = () => within(screen.getByRole("table")).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("compareValues", () => {
  it("orders numbers by size and words without regard to case, with numbers inside words in order", () => {
    expect([10, 9, 100].sort(compareValues)).toEqual([9, 10, 100]);
    expect(["summer", "Beds", "Sale 10", "Sale 2"].sort(compareValues)).toEqual(["Beds", "Sale 2", "Sale 10", "summer"]);
  });
});

describe("useClientList", () => {
  it("sorts, pages and counts", async () => {
    const user = userEvent.setup();
    render(<Demo pageSize={4} />);
    expect(titles()).toEqual(["Autumn", "Beds", "Gifts", "Sale 2"]);
    expect(screen.getByText("6 collections · Page 1 of 2")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(titles()).toEqual(["Sale 10", "summer"]);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Products" }));
    // Sorting goes back to the first page.
    expect(titles()).toEqual(["Autumn", "Beds", "Sale 10", "Sale 2"]);
    await user.click(screen.getByRole("button", { name: "Products" }));
    expect(titles()[0]).toBe("Gifts");
  });

  it("searches across every page and says how many match", async () => {
    const user = userEvent.setup();
    render(<Demo pageSize={2} />);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByRole("searchbox", { name: "Search collections" }), "SALE");
    expect(titles()).toEqual(["Sale 2", "Sale 10"]);
    expect(screen.getByText("2 collections")).toBeVisible();
    await user.clear(screen.getByRole("searchbox", { name: "Search collections" }));
    await user.type(screen.getByRole("searchbox", { name: "Search collections" }), "gift");
    expect(screen.getByText("1 collection")).toBeVisible();
  });
});

describe("SelectList search", () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, label: index === 3 ? "Delivery and returns" : `Page ${index}` }));
  it("offers a search box only for long lists and keeps the chosen item in view", async () => {
    const user = userEvent.setup();
    const view = render(<SelectList label="Pages" items={items.slice(0, 5)} selectedId="p0" onSelect={() => undefined} />);
    expect(screen.queryByRole("searchbox")).toBeNull();
    view.rerender(<SelectList label="Pages" items={items} selectedId="p0" onSelect={() => undefined} />);
    await user.type(screen.getByRole("searchbox", { name: "Search pages" }), "deliv");
    expect(within(screen.getByRole("list", { name: "Pages" })).getAllByRole("button").map((button) => button.textContent)).toEqual(["Page 0", "Delivery and returns"]);
    const results = await axe.run(view.container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
