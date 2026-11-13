import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RegistrySectionRenderer } from "./registry-section-renderer";

const card = { id: "b1", name: "Ascot bed", href: "/p/b1", imageUrl: "", price: "£289", priceMinor: 28900, available: true };
const page = { pageType: "search", data: { query: "lit", state: "results", resultCount: 1, results: [card], searchHref: "/s/search" } };
const section = { id: "search", type: "search-results", enabled: true, settings: { showSort: true, showFilters: true }, blocks: [] };
const commerce = { getProducts: async () => [] };

describe("built-in words follow the shopper's language", () => {
  it("draws the search page in French, and in English for the main language", () => {
    const { unmount } = render(<RegistrySectionRenderer section={section} mode="published" commerce={commerce as never} page={page as never} language="fr" />);
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeInTheDocument();
    expect(screen.getByText("1 résultat pour « lit »")).toBeInTheDocument();
    expect(screen.getByText("Trier par")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 produit");
    unmount();
    render(<RegistrySectionRenderer section={section} mode="published" commerce={commerce as never} page={page as never} />);
    expect(screen.getByText("1 result for “lit”")).toBeInTheDocument();
    expect(screen.getByText("Sort by")).toBeInTheDocument();
  });

  it("keeps the moved English words out of the components (they come from the dictionary)", () => {
    const files = ["sections/product-list-browser.tsx", "sections/product-sections.tsx", "sections/theme-pack-sections.tsx"].map((file) => readFileSync(path.join(__dirname, file), "utf8")).join("\n");
    for (const text of ["\"Add to cart\"", ">Sort by<", "\"Show more products\"", "\"Your bag\"", ">Order summary<", ">Subtotal<", ">Checkout<", "\"What are you looking for?\"", ">Clear all<", "\"You may also like\""]) expect(files).not.toContain(text);
  });
});
