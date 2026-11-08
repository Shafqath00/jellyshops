import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "./runtime-context";
import { HeaderSection, headerLayout } from "./sections/header";

const item = (id: string, label: string) => ({ id, label, target: { kind: "external" as const, url: `/pages/${id}` }, children: [] });
const context: StorefrontRuntimeContext = {
  mode: "published",
  storeSlug: "demo",
  commerce: { getProducts: async () => [] },
  menus: { m: { id: "m", handle: "main", items: [item("new", "New in"), item("women", "Women"), item("men", "Men"), item("sale", "Sale")] } },
} as StorefrontRuntimeContext;
const header = (settings: Record<string, unknown>): SectionNode => ({ id: "header", type: "header", enabled: true, settings: { storeName: "Demo", ...settings }, blocks: [{ id: "menu", type: "menu", enabled: true, settings: { handle: "main" } }] });
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => violation.id);

describe("header layouts", () => {
  it("falls back to the classic layout for unknown values", () => {
    expect(headerLayout(undefined)).toBe("classic");
    expect(headerLayout("sideways")).toBe("classic");
    expect(headerLayout("split")).toBe("split");
  });

  it("split: half of the menu on each side of the logo", async () => {
    const { container } = render(<HeaderSection section={header({ layout: "split" })} context={context} />);
    const element = container.querySelector(".jelly-header") as HTMLElement;
    expect(element).toHaveAttribute("data-header-layout", "split");
    expect(element).toHaveAttribute("data-logo-position", "center");
    expect(within(screen.getByRole("navigation", { name: "Primary navigation" })).getAllByRole("link").map((link) => link.textContent)).toEqual(["New in", "Women"]);
    expect(within(screen.getByRole("navigation", { name: "More navigation" })).getAllByRole("link").map((link) => link.textContent)).toEqual(["Men", "Sale"]);
    // Menu, logo, menu, in that order in the page.
    const first = container.querySelector(".jelly-header-menu-first")!;
    const brand = container.querySelector(".jelly-header-brand")!;
    expect(first.compareDocumentPosition(brand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await noViolations(container)).toEqual([]);
  });

  it("minimal: no menu bar, the menu lives behind the menu button", async () => {
    const { container } = render(<HeaderSection section={header({ layout: "minimal" })} context={context} />);
    expect(screen.queryByRole("navigation", { name: "Primary navigation" })).toBeNull();
    expect(screen.getByRole("navigation", { name: "Mobile navigation", hidden: true })).toBeTruthy();
    expect(await noViolations(container)).toEqual([]);
  });

  it("category bar: a search box and the menu on its own row, no search icon", async () => {
    const { container } = render(<HeaderSection section={header({ layout: "category-bar", showSearch: true })} context={context} />);
    expect(screen.getByRole("search")).toHaveAttribute("action", "/demo/search");
    expect(container.querySelector('[data-tool="search"]')).toBeNull();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeTruthy();
    expect(await noViolations(container)).toEqual([]);
  });

  it("search first: delivery note, search box and a departments row", async () => {
    const { container } = render(<HeaderSection section={header({ layout: "search-first", deliveryNote: "Delivery today from 6pm" })} context={context} />);
    expect(screen.getByText("Delivery today from 6pm")).toBeTruthy();
    expect(screen.getByRole("search")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Departments" })).toBeTruthy();
    expect(await noViolations(container)).toEqual([]);
  });

  it("only shows the delivery note in the search-first layout", () => {
    render(<HeaderSection section={header({ layout: "category-bar", deliveryNote: "Delivery today" })} context={context} />);
    expect(screen.queryByText("Delivery today")).toBeNull();
  });
});
