import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sectionLabel } from "./labels";
import { getSectionDefinition, listSectionDefinitionsForPage, registerSection, unregisterSection, validateSectionAgainstRegistry } from "./registry";
import type { SectionDefinition } from "./types";

const definition = (type: string): SectionDefinition => ({
  type, category: "content", supportedPages: ["home"], settingsSchema: z.object({ text: z.string().default("") }),
  controls: [{ type: "text", key: "text", label: "Text" } as never], allowedBlockTypes: [], defaultSettings: { text: "" }, defaultBlocks: [], responsiveFields: [],
});

describe("registerSection", () => {
  it("adds a namespaced section with the shared style controls and validates it", () => {
    registerSection(definition("acme/size-guide"));
    const registered = getSectionDefinition("acme/size-guide")!;
    expect(registered.controls.length).toBeGreaterThan(1);
    expect(validateSectionAgainstRegistry({ id: "a", type: "acme/size-guide", enabled: true, settings: { text: "Hi" }, blocks: [] }, "home")).toEqual([]);
    expect(validateSectionAgainstRegistry({ id: "a", type: "acme/size-guide", enabled: true, settings: { text: "Hi" }, blocks: [] }, "cart").map((issue) => issue.code)).toEqual(["SECTION_NOT_ALLOWED_ON_PAGE"]);
  });
  it("refuses names that could shadow a built-in section, and duplicates", () => {
    expect(() => registerSection(definition("hero"))).toThrow(/vendor\/name/);
    expect(() => registerSection(definition("Acme/Thing"))).toThrow(/vendor\/name/);
    registerSection(definition("acme/once"));
    expect(() => registerSection(definition("acme/once"))).toThrow(/already registered/);
  });
});

describe("per-theme section visibility", () => {
  const themed = (type: string, themes: string[]) => ({ ...definition(type), themes });
  it("offers a theme-limited section only on its theme, and refuses it elsewhere", () => {
    registerSection(themed("acme/showroom", ["acme-store"]));
    expect(listSectionDefinitionsForPage("home", "template", "acme-store").map((s) => s.type)).toContain("acme/showroom");
    expect(listSectionDefinitionsForPage("home", "template", "jelly-avenue").map((s) => s.type)).not.toContain("acme/showroom");
    // Without a theme (older callers) nothing is hidden, and built-in sections are open to every theme.
    expect(listSectionDefinitionsForPage("home").map((s) => s.type)).toContain("acme/showroom");
    expect(listSectionDefinitionsForPage("home", "template", "jelly-avenue").map((s) => s.type)).toContain("hero");
    const section = { id: "s", type: "acme/showroom", enabled: true, settings: {}, blocks: [] };
    expect(validateSectionAgainstRegistry(section, "home", "acme-store")).toEqual([]);
    expect(validateSectionAgainstRegistry(section, "home", "jelly-avenue").map((issue) => issue.code)).toEqual(["SECTION_NOT_AVAILABLE_ON_THEME"]);
  });
});

describe("replacing and undoing registrations", () => {
  it("replaces a section on request, undoes it, and removes sections added at run time", () => {
    const undoFirst = registerSection({ ...definition("acme/swap"), label: "Swap v1" });
    expect(sectionLabel("acme/swap")).toBe("Swap v1");
    expect(() => registerSection(definition("acme/swap"))).toThrow(/already registered/);
    const undoSecond = registerSection({ ...definition("acme/swap"), label: "Swap v2", defaultSettings: { text: "two" } }, { replace: true });
    expect(sectionLabel("acme/swap")).toBe("Swap v2");
    expect(getSectionDefinition("acme/swap")?.defaultSettings).toEqual({ text: "two" });
    undoSecond();
    expect(sectionLabel("acme/swap")).toBe("Swap v1");
    undoFirst();
    expect(getSectionDefinition("acme/swap")).toBeUndefined();
    registerSection(definition("acme/gone"));
    unregisterSection("acme/gone");
    expect(getSectionDefinition("acme/gone")).toBeUndefined();
    unregisterSection("hero");
    expect(getSectionDefinition("hero")).toBeDefined();
  });
});
