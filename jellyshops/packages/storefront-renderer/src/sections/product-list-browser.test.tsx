import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
    render(<ProductListBrowser products={products} columns={4} limit={24} showSort showFilters emptyMessage="Nothing here" />);
    expect(screen.getByRole("status")).toHaveTextContent("3 products");
    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), { target: { value: "price-desc" } });
    const names = () => screen.getAllByRole("link").map((link) => link.textContent);
    expect(names()[0]).toContain("Lounge sofa");
    const filters = screen.getByRole("group", { name: "Filters" });
    fireEvent.click(within(filters).getByRole("checkbox", { name: "In stock only" }));
    expect(screen.getByRole("status")).toHaveTextContent("2 products");
    expect(screen.getByRole("button", { name: /Filter \(1\)/ })).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(within(filters).getByRole("checkbox", { name: "Ink" }));
    expect(screen.getByRole("status")).toHaveTextContent("1 product");
    fireEvent.change(within(filters).getByRole("spinbutton", { name: "From" }), { target: { value: "5000" } });
    expect(screen.getByText("No products match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("status")).toHaveTextContent("3 products");
  });

  it("leaves out filters and sorting the section does not ask for", () => {
    render(<ProductListBrowser products={products} columns={3} limit={2} showSort={false} showFilters={false} emptyMessage="Nothing here" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("group", { name: "Filters" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("2 products");
  });
});
