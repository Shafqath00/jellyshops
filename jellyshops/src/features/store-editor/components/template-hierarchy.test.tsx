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
  "global-promo": { id: "global-promo", name: "Summer promo", sectionType: "announcement-bar", sectionId: "announcement-1", blocks: [{ id: "announcement-copy", type: "text" }] },
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
    expect(screen.getByRole("complementary", { name: "Template hierarchy" })).toHaveClass("bg-[var(--white)]");
    expect(screen.getByRole("heading", { name: "Template" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Footer" })).toBeVisible();
    expect(screen.getByText("Main header")).toBeVisible();
    expect(screen.getByText("Hero banner")).toBeVisible();
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

    await userEvent.click(screen.getByRole("button", { name: "Hero banner" }));

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

    await userEvent.click(screen.getByRole("button", { name: /^Heading/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "block", region: "template", sectionId: "hero-1", blockId: "heading-1" });

    await userEvent.click(screen.getByRole("button", { name: "Add block to Hero banner" }));
    expect(onAddBlock).toHaveBeenCalledWith("hero-1");

    await userEvent.click(screen.getByRole("button", { name: "Add section to Template" }));
    expect(onAddSection).toHaveBeenCalledWith("template");
  });

  it("exposes blocks inside shared sections for direct editing", async () => {
    const onSelect = vi.fn();
    render(<TemplateHierarchy template={template} globalSections={globalSections} selection={null} activeGlobalId="global-promo" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole("button", { name: /^Text/ }));
    expect(onSelect).toHaveBeenCalledWith({ kind: "block", region: "template", sectionId: "announcement-1", blockId: "announcement-copy" });
  });
});

it("moves the chosen repeated shared placement within its region", async () => {
  const onReorder = vi.fn();
  const repeated = { ...template, layout: { sections: [{ kind: "global", globalSectionId: "global-promo" }, { kind: "global", globalSectionId: "global-promo" }, { kind: "inline", section: { id: "hero-1", type: "hero", enabled: true, blocks: [], settings: {} } }] } };
  render(<TemplateHierarchy template={repeated} globalSections={globalSections} selection={null} onSelect={vi.fn()} onReorder={onReorder} />);
  await userEvent.click(screen.getAllByRole("button", { name: "Move Summer promo down" })[1]);
  expect(onReorder).toHaveBeenCalledWith(1, 2);
});

it("expands a section independently of opening its settings", async () => {
  const onSelect = vi.fn();
  const expanded = structuredClone(template);
  const hero = expanded.layout.sections[1] as { section: { blocks: unknown[] } };
  hero.section.blocks = [{ id: "heading", type: "heading", settings: { text: "Welcome" } }];
  render(<TemplateHierarchy template={expanded} globalSections={globalSections} selection={null} onSelect={onSelect} />);
  await userEvent.click(screen.getByRole("button", { name: "Expand Hero banner" }));
  expect(screen.getByRole("button", { name: /Heading/ })).toBeVisible();
  expect(onSelect).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Hero banner" }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ sectionId: "hero-1" }));
});

it("keeps expansion separate for repeated shared placements", async () => {
  const repeated = { ...template, layout: { sections: [{ kind: "global", globalSectionId: "global-promo" }, { kind: "global", globalSectionId: "global-promo" }] } };
  render(<TemplateHierarchy template={repeated} globalSections={globalSections} selection={null} onSelect={vi.fn()} />);
  await userEvent.click(screen.getAllByRole("button", { name: "Expand Summer promo" })[1]);
  expect(screen.getAllByRole("button", { name: /Text/ })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: /Summer promo/ }).filter((button) => button.getAttribute("aria-expanded") === "true")).toHaveLength(1);
});

it("shows the blocks inside a group one step in, with their own Add block", async () => {
  const onAddBlock = vi.fn();
  const onSelect = vi.fn();
  const grouped = { ...template, layout: { sections: [{ kind: "inline", section: { id: "custom-1", type: "custom-content", enabled: true, settings: {}, blocks: [
    { id: "g", type: "group", settings: {}, blocks: [{ id: "g1", type: "button", settings: { label: "Book a visit" } }] },
  ] } }] } };
  render(<TemplateHierarchy template={grouped} globalSections={{}} selection={{ kind: "section", region: "template", sectionId: "custom-1" }} onSelect={onSelect} onAddBlock={onAddBlock} />);
  await userEvent.click(screen.getByRole("button", { name: "Button: Book a visit" }));
  expect(onSelect).toHaveBeenCalledWith({ kind: "block", region: "template", sectionId: "custom-1", blockId: "g1" });
  await userEvent.click(screen.getByRole("button", { name: "Add block to Group" }));
  expect(onAddBlock).toHaveBeenCalledWith("custom-1", "g");
});
