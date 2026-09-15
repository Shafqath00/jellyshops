import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TemplateHierarchy } from "./template-hierarchy";

const template = {
  id: "product-featured",
  type: "product" as const,
  handle: "featured",
  name: "Featured product",
  layout: {
    sections: [
      { kind: "global", globalSectionId: "global-header" },
      {
        kind: "inline",
        section: {
          id: "hero-1",
          type: "hero",
          enabled: true,
          settings: {},
          blocks: [],
        },
      },
      { kind: "global", globalSectionId: "global-promo" },
      { kind: "global", globalSectionId: "global-footer" },
    ],
  },
};

const globalSections = {
  "global-header": { id: "global-header", name: "Main header", sectionType: "header" },
  "global-promo": { id: "global-promo", name: "Summer promo", sectionType: "announcement-bar" },
  "global-footer": { id: "global-footer", name: "Main footer", sectionType: "footer" },
};

describe("TemplateHierarchy", () => {
  it("groups active template placements into Header, Template, and Footer", () => {
    render(
      <TemplateHierarchy
        template={template}
        globalSections={globalSections}
        selection={null}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Header" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Template" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Footer" })).toBeVisible();
    expect(screen.getByText("Main header")).toBeVisible();
    expect(screen.getByText("Hero")).toBeVisible();
    expect(screen.getByText("Summer promo")).toBeVisible();
    expect(screen.getByText("Main footer")).toBeVisible();
    expect(screen.getAllByText("Global")).toHaveLength(3);
  });

  it("selects a section from the active template without page-level mutation", async () => {
    const onSelect = vi.fn();
    render(
      <TemplateHierarchy
        template={template}
        globalSections={globalSections}
        selection={null}
        onSelect={onSelect}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Hero" }));

    expect(onSelect).toHaveBeenCalledWith({ kind: "section", region: "template", sectionId: "hero-1" });
  });

  it("shows section blocks and exposes add-section and add-block actions", async () => {
    const onSelect = vi.fn();
    const onAddSection = vi.fn();
    const onAddBlock = vi.fn();
    const templateWithBlocks = structuredClone(template);
    const heroPlacement = templateWithBlocks.layout.sections[1] as { kind: "inline"; section: { blocks: unknown[] } };
    heroPlacement.section.blocks = [
      { id: "heading-1", type: "heading", enabled: true, settings: { text: "Welcome" } },
      { id: "button-1", type: "button", enabled: true, settings: { label: "Shop" } },
    ];

    render(
      <TemplateHierarchy
        template={templateWithBlocks}
        globalSections={globalSections}
        selection={{ kind: "section", region: "template", sectionId: "hero-1" }}
        onSelect={onSelect}
        onAddSection={onAddSection}
        onAddBlock={onAddBlock}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Heading block" }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "block", region: "template", sectionId: "hero-1", blockId: "heading-1" });

    await userEvent.click(screen.getByRole("button", { name: "Add block to Hero" }));
    expect(onAddBlock).toHaveBeenCalledWith("hero-1");

    await userEvent.click(screen.getByRole("button", { name: "Add section to Template" }));
    expect(onAddSection).toHaveBeenCalledWith("template");
  });
});
