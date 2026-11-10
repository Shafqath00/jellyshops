import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { createStorefrontRuntimeContext } from "./runtime-context";
import { HeaderSection } from "./sections/header";
import { PredictiveSearch } from "./sections/predictive-search";
import type { PublicProduct } from "./types";

/** Search suggestions while typing and the bag count on the header (Shopify's predictive search and cart bubble). */
const product = (id: string, name: string): PublicProduct => ({ id, name, href: `/demo/products/${id}`, imageUrl: "", price: "£10.00" });
const catalogue = [product("a", "Linen shirt"), product("b", "Linen trousers"), product("c", "Wool coat")];
const suggest = (query: string, limit: number) => catalogue.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
const flush = () => act(async () => { await Promise.resolve(); });

describe("predictive search", () => {
  it("lists matching products as options and moves through them with the arrow keys", async () => {
    render(<PredictiveSearch action="/demo/search" suggest={suggest} icon={null} />);
    const box = screen.getByRole("combobox", { name: "Search products" });
    fireEvent.change(box, { target: { value: "linen" } });
    await flush();
    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Linen shirt£10.00", "Linen trousers£10.00", "Search for “linen”"]);
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2 suggestions");
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box.getAttribute("aria-activedescendant")).toBe(options[0].id);
    fireEvent.keyDown(box, { key: "ArrowUp" });
    expect(box.getAttribute("aria-activedescendant")).toBe(options[2].id);
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(box).toHaveAttribute("aria-expanded", "false");
  });

  it("links the last option to the full search page", async () => {
    render(<PredictiveSearch action="/demo/search" suggest={suggest} icon={null} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "zzz" } });
    await flush();
    expect(screen.getByRole("status")).toHaveTextContent("No suggestions");
    expect(screen.getByRole("link", { name: "Search for “zzz”" })).toHaveAttribute("href", "/demo/search?q=zzz");
  });

  it("is a plain search form without suggestions", () => {
    render(<PredictiveSearch action="/demo/search" icon={null} />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });
});

describe("header", () => {
  const header = (settings: Record<string, unknown>): SectionNode => ({ id: "header-1", type: "header", enabled: true, settings: { storeName: "Demo", ...settings }, blocks: [] });
  const context = (commerce: Record<string, unknown>, mode: "published" | "editor" = "published") => createStorefrontRuntimeContext({ mode, region: "header", commerce: { async getProducts() { return []; }, ...commerce }, storeSlug: "demo" });

  it("shows how many items are in the bag, and says it to screen readers", () => {
    const { container } = render(<HeaderSection section={header({})} context={context({ bagCount: 3 })} />);
    expect(container.querySelector('[data-tool="bag"]')).toHaveAttribute("aria-label", "Bag, 3 items");
    expect(container.querySelector(".jelly-header-count")).toHaveTextContent("3");
  });

  it("shows no count for an empty bag", () => {
    const { container } = render(<HeaderSection section={header({})} context={context({ bagCount: 0 })} />);
    expect(container.querySelector(".jelly-header-count")).toBeNull();
  });

  it("opens a search panel with suggestions from the search icon, and Escape closes it", async () => {
    const { container } = render(<HeaderSection section={header({})} context={context({ suggestProducts: suggest })} />);
    const icon = container.querySelector('[data-tool="search"]') as HTMLElement;
    expect(icon).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(icon);
    const box = screen.getByRole("combobox");
    fireEvent.change(box, { target: { value: "wool" } });
    await flush();
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("Wool coat");
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(container.querySelector(".jelly-header-search-panel")).toBeNull();
    expect(document.activeElement).toBe(icon);
  });

  it("keeps the search icon a plain link in the editor", () => {
    const { container } = render(<HeaderSection section={header({})} context={context({ suggestProducts: suggest }, "editor")} />);
    expect(container.querySelector('[data-tool="search"]')).not.toHaveAttribute("aria-expanded");
  });
});
