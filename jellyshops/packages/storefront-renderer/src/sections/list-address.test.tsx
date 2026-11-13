import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ListAddress, PublicProduct } from "../types";
import { readListAddress, writeListAddress } from "./list-address";
import { ProductListBrowser } from "./product-list-browser";

const none = { inStock: false, min: "", max: "", colours: [], values: {} };

describe("list choices in the page address", () => {
  it("reads sort, stock, prices and filter values, ignoring anything malformed", () => {
    expect(readListAddress("?sort=price-asc&stock=1&min=200&max=900.50&f.Size=King&f.size=Double&f.size=King&q=bed")).toEqual({
      sort: "price-asc",
      filters: { inStock: true, min: "200", max: "900.50", colours: [], values: { size: ["King", "Double"] } },
    });
    expect(readListAddress("?sort=cheapest&min=abc&stock=yes&f.=x")).toEqual({ sort: "featured", filters: none });
  });

  it("writes the choices and keeps the rest of the address", () => {
    expect(writeListAddress("?q=bed&lang=fr&sort=name-asc", "price-desc", { ...none, inStock: true, values: { size: ["King"], fabric: ["Velvet", "Linen"] } }))
      .toBe("?q=bed&lang=fr&sort=price-desc&stock=1&f.size=King&f.fabric=Velvet&f.fabric=Linen");
    expect(writeListAddress("?sort=price-asc&f.size=King", "featured", none)).toBe("");
    // The older Colour list joins the colour filter.
    expect(writeListAddress("", "featured", { ...none, colours: ["Ink"] })).toBe("?f.colour=Ink");
  });

  it("leaves the address untouched when the list's choices already match", () => {
    expect(writeListAddress("?q=hello%20world&f.size=King", "featured", { ...none, values: { size: ["King"] } })).toBe("?q=hello%20world&f.size=King");
    expect(writeListAddress("?q=hello%20world", "featured", none)).toBe("?q=hello%20world");
  });

  it("round-trips", () => {
    const state = { sort: "name-asc" as const, filters: { inStock: true, min: "10", max: "", colours: [], values: { "bed size": ["Super king"] } } };
    expect(readListAddress(writeListAddress("", state.sort, state.filters))).toEqual(state);
  });
});

describe("ProductListBrowser with the page address", () => {
  const product = (id: string, name: string, priceMinor: number, filters: PublicProduct["filters"]): PublicProduct => ({ id, name, href: `/p/${id}`, imageUrl: "", price: `£${priceMinor / 100}`, priceMinor, available: true, filters });
  const beds = [
    product("cleo", "Cleo bed", 34900, [{ name: "Size", values: ["King"] }, { name: "Fabric", values: ["Velvet"] }]),
    product("bowen", "Bowen bed", 19900, [{ name: "Size", values: ["Double"] }, { name: "Fabric", values: ["Boucle"] }]),
    product("ascot", "Ascot bed", 28900, [{ name: "Size", values: ["King"] }, { name: "Fabric", values: ["Velvet"] }]),
  ];
  const address = (search: string) => {
    const state = { search, writes: [] as string[] };
    const value: ListAddress = { search, update: (next) => { const updated = next(state.search); if (updated !== state.search) { state.search = updated; state.writes.push(updated); } } };
    return { value, state };
  };

  it("opens with the address's sort and filters already applied (also on the server)", () => {
    const { value, state } = address("?f.size=King&sort=price-asc&q=bed");
    const { container } = render(<ProductListBrowser products={beds} columns={3} pageSize={12} showSort showFilters emptyMessage="None" address={value} />);
    expect(screen.getByRole("status")).toHaveTextContent("2 products");
    expect([...container.querySelectorAll(".jelly-product-card h3")].map((item) => item.textContent)).toEqual(["Ascot bed", "Cleo bed"]);
    expect(screen.getByRole("combobox", { name: /Sort/ })).toHaveValue("price-asc");
    expect(state.writes).toEqual([]);
  });

  it("writes every change back to the address", () => {
    const { value, state } = address("?q=bed");
    render(<ProductListBrowser products={beds} columns={3} pageSize={12} showSort showFilters emptyMessage="None" address={value} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Filters" })).getByRole("checkbox", { name: /^Velvet/ }));
    fireEvent.change(screen.getByRole("combobox", { name: /Sort/ }), { target: { value: "name-asc" } });
    expect(state.search).toBe("?q=bed&sort=name-asc&f.fabric=Velvet");
  });
});
