import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CardCompareContext, ProductCard, type PublicProduct } from "@jelly/storefront-renderer";
import { createCompareAccess, MAX_COMPARE } from "./compare-list";
import { compareRows, type CompareItem } from "./compare-table";
import { ComparePageView, CompareTrayView } from "./components/compare-view";

const item = (id: string, extra: Partial<CompareItem> = {}): CompareItem => ({ id, name: `Product ${id}`, href: `/s/products/${id}`, imageUrl: "", price: "£10.00", available: true, ...extra });

describe("compare list", () => {
  beforeEach(() => { try { window.localStorage.clear(); } catch { /* storage blocked */ } });

  it("adds and removes products, keeps them per store and tells listeners", () => {
    const access = createCompareAccess("north");
    const listener = vi.fn();
    const stop = access.subscribe(listener);
    expect(access.toggle("a")).toEqual({ ok: true });
    expect(access.toggle("b")).toEqual({ ok: true });
    expect(access.ids()).toEqual(["a", "b"]);
    expect(createCompareAccess("north").ids()).toEqual(["a", "b"]);
    expect(createCompareAccess("south").ids()).toEqual([]);
    access.toggle("a");
    expect(access.ids()).toEqual(["b"]);
    expect(listener).toHaveBeenCalledTimes(3);
    stop();
    access.clear();
    expect(listener).toHaveBeenCalledTimes(3);
    expect(access.ids()).toEqual([]);
  });

  it(`refuses a product beyond ${MAX_COMPARE} with a plain message`, () => {
    const access = createCompareAccess("full");
    for (const id of ["a", "b", "c", "d"]) access.toggle(id);
    expect(access.toggle("e")).toEqual({ ok: false, message: "You can compare up to 4 products. Remove one first." });
    expect(access.ids()).toHaveLength(4);
  });

  it("returns the same list object until it changes, as React's store hook needs", () => {
    const access = createCompareAccess("stable");
    access.toggle("a");
    const first = access.ids();
    expect(access.ids()).toBe(first);
    access.toggle("b");
    expect(access.ids()).not.toBe(first);
  });

  it("ignores broken saved data", () => {
    window.localStorage.setItem("jelly-compare:broken", "{not json");
    expect(createCompareAccess("broken").ids()).toEqual([]);
    window.localStorage.setItem("jelly-compare:odd", JSON.stringify(["a", 3, "", "b"]));
    expect(createCompareAccess("odd").ids()).toEqual(["a", "b"]);
  });
});

describe("compare rows", () => {
  it("lists price, brand, stock, then every specification with dashes for gaps, marking rows that differ", () => {
    const rows = compareRows([
      item("a", { price: "£229.00", vendor: "Diode", specifications: { "Battery life": "40 hours", Weight: "254 g", Warranty: "2 years" } }),
      item("b", { price: "£129.00", vendor: "Diode", available: false, specifications: { weight: "5 g", Warranty: "2 Years", "Water resistance": "IPX4" } }),
    ]);
    expect(rows.map((row) => [row.label, row.values, row.differs])).toEqual([
      ["Price", ["£229.00", "£129.00"], true],
      ["Brand", ["Diode", "Diode"], false],
      ["Availability", ["In stock", "Sold out"], true],
      ["Battery life", ["40 hours", "–"], true],
      ["Weight", ["254 g", "5 g"], true],
      ["Warranty", ["2 years", "2 Years"], false],
      ["Water resistance", ["–", "IPX4"], true],
    ]);
  });

  it("leaves out the brand row when no product has a brand", () => {
    expect(compareRows([item("a"), item("b")]).map((row) => row.label)).toEqual(["Price", "Availability"]);
  });
});

describe("compare views", () => {
  it("tray lists the ticked products, removes one, and opens the page from two products up", () => {
    const remove = vi.fn();
    const { rerender } = render(<CompareTrayView items={[item("a")]} max={4} compareHref="/s/compare" onRemove={remove} onClear={() => undefined} />);
    const tray = screen.getByRole("region", { name: "Products to compare" });
    expect(within(tray).getByText("Tick one more to compare")).toBeInTheDocument();
    fireEvent.click(within(tray).getByRole("button", { name: "Remove Product a from compare" }));
    expect(remove).toHaveBeenCalledWith("a");
    rerender(<CompareTrayView items={[item("a"), item("b")]} max={4} compareHref="/s/compare" onRemove={remove} onClear={() => undefined} />);
    expect(screen.getByRole("link", { name: "Compare now" })).toHaveAttribute("href", "/s/compare");
    rerender(<CompareTrayView items={[]} max={4} compareHref="/s/compare" onRemove={remove} onClear={() => undefined} />);
    expect(screen.queryByRole("region", { name: "Products to compare" })).toBeNull();
  });

  it("page shows a table with row headers and can show only the differences", () => {
    render(<ComparePageView items={[item("a", { specifications: { Weight: "1 kg", Colour: "Black" } }), item("b", { specifications: { Weight: "2 kg", Colour: "black" } })]} max={4} shopHref="/s/shop" onRemove={() => undefined} />);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Price", "Availability", "Weight (differs)", "Colour"]);
    fireEvent.click(screen.getByLabelText("Show only differences"));
    expect(within(table).getAllByRole("rowheader").map((cell) => cell.textContent)).toEqual(["Weight (differs)"]);
  });

  it("page invites the shopper to tick products when the list is empty", () => {
    render(<ComparePageView items={[]} max={4} shopHref="/s/shop" onRemove={() => undefined} />);
    expect(screen.getByText("Tick Compare on up to 4 products to see them side by side.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse products" })).toHaveAttribute("href", "/s/shop");
  });
});

describe("compare tick on product cards", () => {
  const product: PublicProduct = { id: "p1", name: "Arc headphones", href: "/s/products/arc", imageUrl: "", price: "£229.00" };

  it("is absent unless the store lets shoppers compare", () => {
    render(<ProductCard product={product} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("ticks and unticks the product, and explains when the list is full", () => {
    try { window.localStorage.clear(); } catch { /* storage blocked */ }
    const access = createCompareAccess("cards");
    for (const id of ["a", "b", "c"]) access.toggle(id);
    render(<CardCompareContext.Provider value={access}><ProductCard product={product} /></CardCompareContext.Provider>);
    const tick = screen.getByRole("checkbox", { name: "Compare Arc headphones" });
    fireEvent.click(tick);
    expect(tick).toBeChecked();
    expect(access.ids()).toContain("p1");
    fireEvent.click(tick);
    expect(tick).not.toBeChecked();
    access.toggle("d");
    fireEvent.click(tick);
    expect(screen.getByRole("alert")).toHaveTextContent("You can compare up to 4 products.");
  });
});

describe("compare accessibility (axe)", () => {
  it("tray, compare page and card tick have no WCAG A/AA problems", async () => {
    const { default: axe } = await import("axe-core");
    const access = createCompareAccess("axe");
    const { container } = render(<>
      <CardCompareContext.Provider value={access}><ProductCard product={{ id: "p1", name: "Arc headphones", href: "#", imageUrl: "", price: "£229.00" }} /></CardCompareContext.Provider>
      <ComparePageView items={[item("a", { specifications: { Weight: "1 kg" } }), item("b")]} max={4} shopHref="#" onRemove={() => undefined} />
      <CompareTrayView items={[item("a"), item("b")]} max={4} compareHref="#" onRemove={() => undefined} onClear={() => undefined} />
    </>);
    const results = await axe.run(container, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, rules: { "color-contrast": { enabled: false }, region: { enabled: false }, "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } } });
    expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`)).toEqual([]);
  });
});
