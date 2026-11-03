import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineBlock, defineSection } from "./define";
import { listBlockDefinitions, listSectionDefinitions } from "./registry";
import type { SectionDefinition } from "./types";

const base = (): SectionDefinition => ({ type: "acme/note", category: "content", supportedPages: ["home"], settingsSchema: z.object({}), controls: [], allowedBlockTypes: ["text"], defaultSettings: {}, defaultBlocks: [], responsiveFields: [] });

describe("defineSection / defineBlock", () => {
  it("returns a valid definition unchanged", () => {
    const definition = base();
    expect(defineSection(definition)).toBe(definition);
  });
  it("refuses repeated control keys, disallowed default blocks and blocks over the limit", () => {
    const control = { type: "checkbox", key: "a", label: "A", group: "content" } as never;
    expect(() => defineSection({ ...base(), controls: [control, control] })).toThrow(/repeats the control key "a"/);
    expect(() => defineSection({ ...base(), defaultBlocks: [{ id: "b", type: "image", enabled: true, settings: {} }] })).toThrow(/does not allow/);
    expect(() => defineSection({ ...base(), maxBlocks: 0, defaultBlocks: [{ id: "b", type: "text", enabled: true, settings: {} }] })).toThrow(/limit of 0/);
  });
  it("accepts every built-in section and block, so they can be declared through the same helpers", () => {
    for (const section of listSectionDefinitions()) expect(() => defineSection(section), section.type).not.toThrow();
    for (const block of listBlockDefinitions()) expect(() => defineBlock(block), block.type).not.toThrow();
  });
});
