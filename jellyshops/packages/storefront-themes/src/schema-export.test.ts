import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSchemaFiles } from "./schema-export";

const schemaDirectory = [resolve(process.cwd(), "../docs/schemas"), resolve(process.cwd(), "docs/schemas")].find((path) => existsSync(path)) ?? "";

describe("generated theme schemas (docs/schemas)", () => {
  const generated = buildSchemaFiles();

  it.each(Object.keys(generated))("%s matches the platform's schemas (run `node scripts/generate-schemas.mjs` if this fails)", (name) => {
    expect(existsSync(resolve(schemaDirectory, name)), `${name} is missing`).toBe(true);
    expect(readFileSync(resolve(schemaDirectory, name), "utf8")).toBe(generated[name]);
  });

  it("describes the manifest strictly, with its required fields", () => {
    const schema = JSON.parse(generated["theme.schema.json"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(expect.arrayContaining(["id", "name", "version", "description", "assetPrefix", "layout", "enabled", "settingsDefaults"]));
  });

  it("lists every section and block with settings schemas and the shared style controls once", () => {
    const catalogue = JSON.parse(generated["sections.json"]);
    expect(catalogue.sections.length).toBeGreaterThan(40);
    expect(catalogue.blocks.length).toBeGreaterThan(15);
    expect(catalogue.sections.every((section: { settingsSchema: unknown }) => section.settingsSchema)).toBe(true);
    expect(catalogue.shared.sectionControls.length).toBeGreaterThan(10);
    const hero = catalogue.sections.find((section: { type: string }) => section.type === "hero");
    expect(hero.controls.some((control: { key: string }) => control.key === "styleAlign")).toBe(false);
    expect(Object.keys(catalogue.shared.sectionSettingsSchema.properties)).toContain("styleAlign");
  });
});
