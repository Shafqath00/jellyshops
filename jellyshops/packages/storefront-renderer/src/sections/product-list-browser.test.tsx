import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogQuery } from "@jelly/storefront-schema";
import type { CatalogBrowsePage } from "../types";
import type { PublicProduct } from "../types";
import { browseProducts, ProductListBrowser, productPriceMinor } from "./product-list-browser";

const product = (id: string, name: string, price: string, extra: Partial<PublicProduct> = {}): PublicProduct => ({ id, name, href: `/products/${id}`, imageUrl: "", price, ...extra });
const products = [
  product("stool", "Timber stool", "£149.00", { available: true, swatches: [{ label: "Natural", color: "#c9a97c" }, { label: "Ink", color: "#171717" }] }),
  product("sofa", "Lounge sofa", "£1,197.00", { available: true }),
  product("lamp", "Arc lamp", "£429.00", { available: false, priceMinor: 42900 }),
];
const none = { inStock: false, min: "", max: "", colours: [] };

describe("productPriceMinor", () => {
  it("prefers the exact amount and otherwise reads the shown price in either number style", () => {
    expect(productPriceMinor(product("a", "A", "£9.99", { priceMinor: 1234 }))).toBe(1234);
    expect(productPriceMinor(product("a", "A", "£1,197.00"))).toBe(119700);
    expect(productPriceMinor(product("a", "A", "1.197,00 €"))).toBe(119700);
    expect(productPriceMinor(product("a", "A", "£899"))).toBe(89900);
  });
});

describe("browseProducts", () => {
  it("keeps the merchant's order for Featured and sorts by price or name", () => {
    expect(browseProducts(products, "featured", none).map((item) => item.id)).toEqual(["stool", "sofa", "lamp"]);
    expect(browseProducts(products, "price-asc", none).map((item) => item.id)).toEqual(["stool", "lamp", "sofa"]);
    expect(browseProducts(products, "price-desc", none).map((item) => item.id)).toEqual(["sofa", "lamp", "stool"]);
    expect(browseProducts(products, "name-asc", none).map((item) => item.id)).toEqual(["lamp", "sofa", "stool"]);
  });

  it("filters by availability, price range and colour", () => {
    expect(browseProducts(products, "featured", { ...none, inStock: true }).map((item) => item.id)).toEqual(["stool", "sofa"]);
    expect(browseProducts(products, "featured", { ...none, min: "200", max: "500" }).map((item) => item.id)).toEqual(["lamp"]);
    expect(browseProducts(products, "featured", { ...none, colours: ["Ink"] }).map((item) => item.id)).toEqual(["stool"]);
  });
});

describe("ProductListBrowser", () => {
  it("shows a count, sorts, filters and clears", () => {
    render(<ProductListBrowser products={products} columns={4} pageSize={24} showSort showFilters emptyMessage="Nothing here" />);
    expect(screen.getByRole("status")).toHaveTextContent("3 products");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), { target: { value: "price-desc" } });
    const names = () => screen.getAllByRole("link").map((link) => link.textContent);
    expect(names()[0]).toContain("Lounge sofa");
    const filters = screen.getByRole("group", { name: "Filters" });
    fireEvent.click(within(filters).getByRole("checkbox", { name: "In stock only" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 products");
    expect(screen.getByRole("button", { name: /Filter \(1\)/ })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(within(filters).getByRole("checkbox", { name: /^Ink/ }));
    expect(screen.getByRole("status")).toHaveTextContent("1 product");
    fireEvent.change(within(filters).getByRole("spinbutton", { name: "From" }), { target: { value: "5000" } });
    expect(screen.getByText("No products match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("status")).toHaveTextContent("3 products");
  });

  it("leaves out filters and sorting the section does not ask for", () => {
    render(<ProductListBrowser products={products} columns={3} pageSize={2} showSort={false} showFilters={false} emptyMessage="Nothing here" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("group", { name: "Filters" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Showing 2 of 3 products");
  });

  it("shows a page of products at a time and starts again from the first page after a new sort", () => {
    const { container } = render(<ProductListBrowser products={products} columns={3} pageSize={2} showSort showFilters={false} emptyMessage="Nothing here" />);
    const cards = () => container.querySelectorAll(".jelly-product-card").length;
    expect(cards()).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: "Show more products" }));
    expect(cards()).toBe(3);
    expect(screen.getByRole("status")).toHaveTextContent("3 products");
    expect(screen.queryByRole("button", { name: "Show more products" })).toBeNull();
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "price-asc" } });
    expect(cards()).toBe(2);
  });
});

describe("filters from product options and tags", () => {
  const beds = [
    product("ascot", "Ascot bed", "£289.00", { priceMinor: 28900, available: true, filters: [{ name: "Size", values: ["Double", "King"] }, { name: "Fabric", values: ["Velvet"] }] }),
    product("bowen", "Bowen bed", "£199.00", { priceMinor: 19900, available: true, filters: [{ name: "Size", values: ["Double"] }, { name: "Fabric", values: ["Boucle"] }] }),
    product("cleo", "Cleo bed", "£349.00", { priceMinor: 34900, available: true, filters: [{ name: "Size", values: ["King", "Super king"] }, { name: "Fabric", values: ["Velvet"] }] }),
  ];

  it("offers every filter with counts and narrows the list", () => {
    render(<ProductListBrowser products={beds} columns={3} pageSize={12} showSort showFilters emptyMessage="None" />);
    const filters = screen.getByRole("group", { name: "Filters" });
    expect(within(filters).getByRole("group", { name: "Size" })).toBeInTheDocument();
    const king = within(filters).getByRole("checkbox", { name: /^King/ });
    expect(king.closest("label")).toHaveTextContent("King(2)");
    fireEvent.click(king);
    expect(screen.getByRole("status")).toHaveTextContent("2 products");
    // Values with nothing left under the other choices are switched off.
    expect(within(filters).getByRole("checkbox", { name: /^Boucle/ })).toBeDisabled();
    fireEvent.click(within(filters).getByRole("checkbox", { name: /^Super king/ }));
    expect(screen.getByRole("status")).toHaveTextContent("2 products");
  });

  it("shows only the filters the merchant listed", () => {
    render(<ProductListBrowser products={beds} columns={3} pageSize={12} showSort={false} showFilters emptyMessage="None" filterNames={["Fabric"]} />);
    const filters = screen.getByRole("group", { name: "Filters" });
    expect(within(filters).queryByRole("group", { name: "Size" })).toBeNull();
    expect(within(filters).getByRole("group", { name: "Fabric" })).toBeInTheDocument();
  });

  it("asks the store for pages on the live store and appends Show more", async () => {
    const page = (offset: number): CatalogBrowsePage => ({ products: offset === 0 ? [beds[2]] : [beds[0]], total: 2, facets: [{ key: "size", label: "Size", values: [{ value: "King", count: 2, selected: false }] }], price: null, filtered: false });
    const remote = vi.fn(async (query: CatalogQuery) => page(query.offset ?? 0));
    render(<ProductListBrowser products={beds} columns={3} pageSize={1} showSort showFilters emptyMessage="None" remote={remote} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 2 products");
    expect(remote).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 0, limit: 1, sort: "featured" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Show more products" })); });
    expect(remote).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 1 }));
    expect(screen.getByRole("status")).toHaveTextContent("2 products");
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/products/cleo", "/products/ascot"]);
  });

  it("keeps the products it already has when the store cannot be reached", async () => {
    const remote = vi.fn(async () => { throw new Error("offline"); });
    render(<ProductListBrowser products={beds} columns={3} pageSize={12} showSort={false} showFilters={false} emptyMessage="None" remote={remote} />);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(screen.getByRole("status")).toHaveTextContent("3 products");
  });
});
