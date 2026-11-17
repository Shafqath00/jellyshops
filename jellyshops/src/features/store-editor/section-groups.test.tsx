import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getSectionDefinition, listSectionDefinitionsForGroup, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { deriveSectionGroups, readSectionGroups, type RuntimeStorefrontSnapshotV4, type RuntimeTemplateV4 } from "@jelly/storefront-schema";
import { expandRawRuntimeLayout } from "@/features/storefront/resource-loader";
import { TemplateHierarchy } from "./components/template-hierarchy";
import { addToGroup, moveInGroup, removeFromGroup } from "./section-group-editing";

/** Theme plan T6, part 1: shared header and footer groups. */
const section = (id: string, type: string) => ({ id, section: { id: `${id}-s`, type, enabled: true, settings: {}, blocks: [] } });
const globalSections = Object.fromEntries([section("g-ann", "announcement-bar"), section("g-header", "header"), section("g-footer", "footer"), section("g-promise", "rich-text")].map((entry) => [entry.id, entry])) as RuntimeStorefrontSnapshotV4["globalSections"];
const template = { layout: { sections: [
  { kind: "global", globalSectionId: "g-ann" },
  { kind: "global", globalSectionId: "g-header" },
  { kind: "inline", section: { id: "hero", type: "hero", enabled: true, settings: {}, blocks: [] } },
  { kind: "global", globalSectionId: "g-footer" },
] } } as Pick<RuntimeTemplateV4, "layout">;
const typeOf = (id: string) => (globalSections[id]?.section as { type?: string } | undefined)?.type;

describe("section groups", () => {
  it("works the groups out from a template's shared sections", () => {
    expect(deriveSectionGroups([{ type: "home", handle: "default", layout: template.layout }], typeOf)).toEqual({ header: ["g-ann", "g-header"], footer: ["g-footer"], overlay: [] });
    expect(readSectionGroups({ header: ["a"], footer: [] })).toEqual({ header: ["a"], footer: [], overlay: [] });
    expect(readSectionGroups({ header: "a" })).toBeUndefined();
  });

  it("draws exactly as before without saved groups", () => {
    const layout = expandRawRuntimeLayout({ globalSections }, template);
    expect(layout.announcement.map((item) => item.type)).toEqual(["announcement-bar"]);
    expect(layout.header.map((item) => item.type)).toEqual(["header"]);
    expect(layout.template.map((item) => item.type)).toEqual(["hero"]);
    expect(layout.footer.map((item) => item.type)).toEqual(["footer"]);
  });

  it("draws the saved groups on every page and leaves out the template's own header and footer", () => {
    const sectionGroups = { header: ["g-ann", "g-header"], footer: ["g-promise", "g-footer"], overlay: [] };
    const layout = expandRawRuntimeLayout({ globalSections, sectionGroups }, template);
    expect(layout.announcement.map((item) => item.type)).toEqual(["announcement-bar"]);
    expect(layout.header.map((item) => item.type)).toEqual(["header"]);
    expect(layout.template.map((item) => item.type)).toEqual(["hero"]);
    expect(layout.footer.map((item) => item.type)).toEqual(["rich-text", "footer"]);
    // A page with no header placement (a checkout-like template) still gets the groups.
    expect(expandRawRuntimeLayout({ globalSections, sectionGroups }, { layout: { sections: [] } }).footer).toHaveLength(2);
  });

  it("lets content sections into the footer, never page sections", () => {
    const footer = listSectionDefinitionsForGroup("footer").map((definition) => definition.type);
    expect(footer).toEqual(expect.arrayContaining(["footer", "rich-text", "newsletter", "custom-content"]));
    expect(footer).not.toContain("collection-product-grid");
    expect(listSectionDefinitionsForGroup("header").map((definition) => definition.type)).not.toContain("newsletter");
    const text = { id: "t", type: "rich-text", enabled: true, settings: {}, blocks: [] };
    expect(validateSectionAgainstRegistry(text, { group: "footer" }).map((issue) => issue.code)).toEqual([]);
    expect(validateSectionAgainstRegistry({ ...text, type: "collection-product-grid" }, { group: "footer" }).map((issue) => issue.code)).toContain("SECTION_NOT_ALLOWED_IN_GROUP");
    expect(getSectionDefinition("header")?.groups).toEqual(["header"]);
  });

  it("places, moves and removes shared sections in a group", () => {
    const groups = { header: ["g-header"], footer: ["g-footer"], overlay: [] };
    expect(addToGroup(groups, "footer", "g-promise", "rich-text", typeOf).footer).toEqual(["g-promise", "g-footer"]);
    expect(addToGroup(groups, "header", "g-ann", "announcement-bar", typeOf).header).toEqual(["g-ann", "g-header"]);
    expect(addToGroup(groups, "header", "g-promise", "rich-text", typeOf).header).toEqual(["g-header", "g-promise"]);
    expect(moveInGroup({ ...groups, footer: ["g-promise", "g-footer"] }, "footer", "g-promise", "down")?.footer).toEqual(["g-footer", "g-promise"]);
    expect(moveInGroup(groups, "footer", "g-footer", "down")).toBeNull();
    expect(removeFromGroup(groups, "footer", "g-footer", "footer")).toBeNull();
    expect(removeFromGroup({ ...groups, footer: ["g-promise", "g-footer"] }, "footer", "g-promise", "rich-text")?.footer).toEqual(["g-footer"]);
  });

  it("lists the groups in the page tree with their own actions", async () => {
    const labels = Object.fromEntries(Object.values(globalSections).map((entry) => [entry.id, { id: entry.id, name: `Shared ${(entry.section as { type: string }).type}`, sectionType: (entry.section as { type: string }).type, sectionId: `${entry.id}-s` }]));
    const onGroupRemove = vi.fn();
    const onGroupMove = vi.fn();
    render(<TemplateHierarchy template={{ id: "home", name: "Home", layout: template.layout } as never} globalSections={labels} selection={null} onSelect={vi.fn()}
      sectionGroups={{ header: ["g-ann", "g-header"], footer: ["g-promise", "g-footer"] }} onGroupMove={onGroupMove} onGroupRemove={onGroupRemove} />);
    const footer = screen.getByRole("heading", { name: /Footer/ }).closest("section")!;
    expect(within(footer).getByText("On every page")).toBeInTheDocument();
    expect(within(footer).getByRole("button", { name: "Shared rich-text" })).toBeInTheDocument();
    const page = screen.getByRole("heading", { name: "Template" }).closest("section")!;
    expect(within(page).queryByRole("button", { name: "Shared footer" })).toBeNull();
    await userEvent.click(within(footer).getByRole("button", { name: "Remove Shared rich-text from the footer" }));
    expect(onGroupRemove).toHaveBeenCalledWith("footer", "g-promise");
    expect(within(footer).queryByRole("button", { name: "Remove Shared footer from the footer" })).toBeNull();
    await userEvent.click(within(footer).getByRole("button", { name: "Move Shared rich-text down" }));
    expect(onGroupMove).toHaveBeenCalledWith("footer", "g-promise", "down");
  });
});
