import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateV4StarterPack } from "@jelly/storefront-registry";
import { createStarterPack, getStarterPack, isStarterPackId, listStarterPacks } from "./starter-packs";
import { getThemeDefinition, listThemes } from "./theme-registry";

const example = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((path) => existsSync(path)) ?? "";
const read = (name: string) => JSON.parse(readFileSync(join(example, name), "utf8"));

describe("theme-owned starter packs", () => {
  it("turns a theme folder into a pack the platform validates", () => {
    const pack = createStarterPack({ manifest: read("theme.json"), starter: read("starter.json") })!;
    expect(pack.id).toBe("jelly-studio");
    expect(pack.templates.map((template) => template.key).sort()).toEqual(["article", "blog", "cart", "collection", "home", "not-found", "page", "product", "search"]);
    expect(validateV4StarterPack(pack, [pack.id])).toEqual([]);
  });
  it("returns nothing for a theme without starter content", () => {
    expect(createStarterPack({ manifest: read("theme.json") })).toBeNull();
  });
  it("keeps the four built-in packs available", () => {
    for (const id of ["jelly-avenue", "jelly-signature", "fresh-market", "artisan-boutique"]) {
      expect(isStarterPackId(id)).toBe(true);
      expect(getStarterPack(id).id).toBe(id);
    }
    expect(listStarterPacks().length).toBeGreaterThanOrEqual(4);
    expect(isStarterPackId("nope")).toBe(false);
    expect(() => getStarterPack("nope")).toThrow(/Unknown starter pack/);
  });
  it("lists every registered theme once", () => {
    const ids = listThemes().map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getThemeDefinition("minimal").id).toBe("minimal");
  });
});

describe("theme discovery", () => {
  it("the generated index is up to date", () => {
    expect(() => execFileSync(process.execPath, [script(), "--check"], { stdio: "pipe" })).not.toThrow();
  });
  it("lists folders with a theme.json and their starter files", () => {
    const temp = mkdtempSync(join(tmpdir(), "themes-"));
    mkdirSync(join(temp, "b-theme")); mkdirSync(join(temp, "a-theme")); mkdirSync(join(temp, "empty"));
    writeFileSync(join(temp, "a-theme", "theme.json"), "{}");
    writeFileSync(join(temp, "b-theme", "theme.json"), "{}");
    writeFileSync(join(temp, "b-theme", "starter.json"), "{}");
    const output = execFileSync(process.execPath, [script(), "--dir", temp], { encoding: "utf8" });
    expect(output).toContain("./a-theme/theme.json");
    expect(output).toContain("./b-theme/starter.json");
    expect(output).not.toContain("empty");
    expect(output.indexOf("a-theme")).toBeLessThan(output.indexOf("b-theme"));
  });
});

function script(): string {
  return [resolve(process.cwd(), "../scripts/generate-theme-index.mjs"), resolve(process.cwd(), "scripts/generate-theme-index.mjs")].find((path) => existsSync(path)) ?? "";
}

describe("registerThemeProject", () => {
  it("registers a theme folder at run time, and replaces it when registered again", async () => {
    const { registerThemeProject } = await import("./starter-packs");
    const manifest = read("theme.json");
    const pack = registerThemeProject({ manifest, starter: read("starter.json") })!;
    expect(pack.id).toBe("jelly-studio");
    expect(isStarterPackId("jelly-studio")).toBe(true);
    expect(getThemeDefinition("jelly-studio").label).toBe(manifest.name);
    registerThemeProject({ manifest: { ...manifest, name: "Renamed" }, starter: read("starter.json") });
    expect(getThemeDefinition("jelly-studio").label).toBe("Renamed");
    expect(registerThemeProject({ manifest })).toBeNull();
    expect(isStarterPackId("jelly-studio")).toBe(false);
    expect(() => registerThemeProject({ manifest: { ...manifest, id: "jelly-avenue" } })).toThrow(/built-in/);
  });
});
