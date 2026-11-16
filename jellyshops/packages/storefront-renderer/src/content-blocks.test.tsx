import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { CONTENT_BLOCK_TYPES, getBlockDefinition, getSectionDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import type { CommerceDataProvider } from "./types";

afterEach(cleanup);
const commerce = { getProducts: async () => [], getCollections: async () => [] } as unknown as CommerceDataProvider;
const noViolations = async (container: HTMLElement) => (await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`);

/** A block with its defaults and default children, as the editor creates it. */
function blockOf(type: string, id = type): BlockNode {
  const definition = getBlockDefinition(type)!;
  return { id, type, enabled: true, settings: structuredClone(definition.defaultSettings), ...(definition.defaultBlocks ? { blocks: structuredClone(definition.defaultBlocks) } : {}) };
}
const section = (blocks: BlockNode[]): SectionNode => ({ id: "s", type: "custom-content", enabled: true, settings: { contentAlignment: "left" }, blocks });
const draw = (blocks: BlockNode[], mode: "editor" | "published" = "published") =>
  render(<RegistrySectionRenderer section={section(blocks)} mode={mode} commerce={commerce} page={{ pageType: "home" } as never} />).container;

// Blocks that only go inside their parent are covered through the parent.
const topLevel = CONTENT_BLOCK_TYPES.filter((type) => getBlockDefinition(type)?.sets?.includes("@content"));
const partOf: Record<string, string> = {
  subheading: ".jelly-subheading", "section-header": ".jelly-header-block", "collapsible-text": ".jelly-collapsible", grid: ".jelly-block-grid",
  accordion: ".jelly-accordion", tabs: ".jelly-tabs", divider: ".jelly-block-divider", spacer: ".jelly-block-spacer", icon: ".jelly-block-icon",
  "icon-list": ".jelly-icon-list", "icon-box": ".jelly-icon-box", card: ".jelly-content-card", badge: ".jelly-badge-block", counter: ".jelly-counter",
  "button-group": ".jelly-button-group",
};

describe("shared content blocks", () => {
  it("are all in Custom content and pass the registry with their defaults", () => {
    const allowed = getSectionDefinition("custom-content")!.allowedBlockTypes;
    for (const type of topLevel) expect(allowed).toContain(type);
    expect(validateSectionAgainstRegistry(section(topLevel.map((type) => blockOf(type))), "home")).toEqual([]);
  });

  it.each(topLevel)("%s draws on the live store with its defaults, without accessibility problems", async (type) => {
    const container = draw([blockOf(type)]);
    expect(container.querySelector(partOf[type])).not.toBeNull();
    expect(await noViolations(container)).toEqual([]);
  });

  it("draws every block together, also inside a grid, and marks them for the editor", async () => {
    const grid = { ...blockOf("grid"), blocks: [blockOf("card", "c1"), blockOf("icon-box", "b1"), { ...blockOf("group", "g1"), blocks: [blockOf("badge", "x1"), blockOf("counter", "x2")] }] };
    const container = draw([...topLevel.filter((type) => type !== "grid").map((type) => blockOf(type)), grid], "editor");
    expect(container.querySelectorAll(".jelly-block-grid .jelly-content-card, .jelly-block-grid .jelly-counter")).toHaveLength(2);
    expect(container.querySelector('[data-editor-block-id="grid"]')).not.toBeNull();
    expect(container.querySelector('[data-editor-block-id="x2"]')).not.toBeNull();
    expect(await noViolations(container)).toEqual([]);
  });

  it("tabs follow the arrow keys and show one panel at a time", () => {
    draw([blockOf("tabs")]);
    const [first, second] = screen.getAllByRole("tab");
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("tabpanel", { hidden: true }).filter((panel) => !panel.hidden)).toHaveLength(1);
    fireEvent.keyDown(first, { key: "ArrowRight" });
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(second).toHaveFocus();
    fireEvent.keyDown(second, { key: "Home" });
    expect(first).toHaveAttribute("aria-selected", "true");
  });

  it("accordion rows open and close as native disclosure, first one open by default", () => {
    const container = draw([blockOf("accordion")]);
    const rows = container.querySelectorAll("details.jelly-accordion-row");
    expect(rows).toHaveLength(3);
    expect((rows[0] as HTMLDetailsElement).open).toBe(true);
    expect((rows[1] as HTMLDetailsElement).open).toBe(false);
    const exclusive = draw([{ ...blockOf("accordion", "one"), settings: { oneAtATime: true } }]);
    const names = [...exclusive.querySelectorAll("details.jelly-accordion-row")].map((row) => row.getAttribute("name"));
    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBeTruthy();
  });

  it("keeps merchant links safe and hides empty blocks for shoppers", () => {
    const card = { ...blockOf("card"), settings: { heading: "Card", linkLabel: "Go", link: "javascript:alert(1)" } };
    const container = draw([card, { ...blockOf("subheading", "empty"), settings: { text: "" } }]);
    expect(container.querySelector(".jelly-content-card-link")).toBeNull();
    expect(container.querySelector(".jelly-subheading")).toBeNull();
  });

  it("writes phone and tablet values of a grid as variables", () => {
    const grid = { ...blockOf("grid"), responsive: { mobile: { columns: 2, gap: 8 }, tablet: { columns: 3 } } };
    const element = draw([grid]).querySelector(".jelly-block-grid") as HTMLElement;
    expect(element.style.getPropertyValue("--grid-columns")).toBe("3");
    expect(element.style.getPropertyValue("--grid-columns-m")).toBe("2");
    expect(element.style.getPropertyValue("--grid-gap-m")).toBe("8px");
    expect(element.style.getPropertyValue("--grid-columns-t")).toBe("3");
  });
});
