import { describe, expect, it } from "vitest";
import { compareThemeVersions, jellyEngineRangeSchema, supportsJellyVersion, themeVersionSchema } from "./versioning.js";
import { validateThemeProject } from "./validate-theme-project.js";
import example from "../../../../docs/examples/jelly-studio/theme.json";
import { buildSchemaFiles } from "./schema-export.js";

describe("theme version contract", () => {
  it("orders numeric versions, prereleases and build metadata by SemVer", () => {
    const ordered = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0", "1.9.0", "1.10.0", "2.0.0"];
    ordered.slice(1).forEach((version, index) => expect(compareThemeVersions(ordered[index], version)).toBeLessThan(0));
    expect(compareThemeVersions("1.0.0+build.1", "1.0.0+build.2")).toBe(0);
  });

  it.each(["01.0.0", "1.0", "1.0.0-01", "1.0.0-", "1.0.0+", "1.0.0-a+b+c", "9007199254740992.0.0"])("rejects invalid version %s", (version) => {
    expect(themeVersionSchema.safeParse(version).success).toBe(false);
    expect(() => compareThemeVersions(version, "1.0.0")).toThrow();
  });

  it.each([">=1 <2", ">=1.0.0 <2.0.0", "1", "1.0", "=1.0.0", ">0.9 <=1.0.0"])("accepts compatible range %s", (range) => {
    expect(jellyEngineRangeSchema.safeParse(range).success).toBe(true);
    expect(supportsJellyVersion(range)).toBe(true);
  });

  it.each([">=2 <3", "<1", ">1.0.0", "1.1", ">=2 <1"])("refuses incompatible range %s", (range) => {
    expect(supportsJellyVersion(range)).toBe(false);
  });

  it.each(["", " ", "*", "^1", "~1.0", "1 || 2", ">=1 garbage", ">=01 <2", "1.0.0-beta"])("reports unsupported range %s", (range) => {
    expect(jellyEngineRangeSchema.safeParse(range).success).toBe(false);
    expect(supportsJellyVersion(range)).toBe(false);
  });

  it("keeps legacy projects valid and gives a plain incompatible-engine diagnostic", () => {
    expect(validateThemeProject({ manifest: example }).filter((issue) => issue.level === "error")).toEqual([]);
    expect(validateThemeProject({ manifest: { ...example, engines: { jelly: ">=2 <3" } } })).toContainEqual(expect.objectContaining({ code: "ENGINE_INCOMPATIBLE", path: "engines.jelly", message: expect.stringContaining("1.0.0") }));
  });

  it("reports malformed versions as diagnostics even when migrations exist", () => {
    expect(() => validateThemeProject({ manifest: { ...example, version: "01.0.0", migrations: [{ from: "bad", to: "2.0.0", operations: [] }] } })).not.toThrow();
    expect(validateThemeProject({ manifest: { ...example, version: "01.0.0" } })).toContainEqual(expect.objectContaining({ code: "MANIFEST_INVALID", path: "version" }));
  });

  it("exports the version and engine grammar in JSON Schema for third-party validators", () => {
    const schema = JSON.parse(buildSchemaFiles()["theme.schema.json"]);
    expect(new RegExp(schema.properties.version.pattern).test("garbage")).toBe(false);
    expect(schema.properties.version.pattern).toBeDefined();
    expect(schema.properties.engines.properties.jelly.pattern).toBeDefined();
    expect(new RegExp(schema.properties.engines.properties.jelly.pattern).test("^1")).toBe(false);
  });
});
