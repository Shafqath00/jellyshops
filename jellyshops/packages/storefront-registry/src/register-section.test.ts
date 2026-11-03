import { describe, expect, it } from "vitest";
import { z } from "zod";
import { getSectionDefinition, registerSection, validateSectionAgainstRegistry } from "./registry";
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
