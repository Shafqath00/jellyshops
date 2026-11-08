import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateThemeProject, type ThemeProjectIssue } from "./validate-theme-project";

const exampleDirectory = [resolve(process.cwd(), "../docs/examples/jelly-studio"), resolve(process.cwd(), "docs/examples/jelly-studio")].find((path) => existsSync(path)) ?? "";
const load = (name: string) => JSON.parse(readFileSync(resolve(exampleDirectory, name), "utf8"));
const manifest = () => load("theme.json");
const starter = () => load("starter.json");
const codes = (issues: ThemeProjectIssue[], level: ThemeProjectIssue["level"] = "error") => issues.filter((issue) => issue.level === level).map((issue) => issue.code);

describe("validateThemeProject", () => {
  it("accepts the example theme with no errors and no warnings", () => {
    expect(validateThemeProject({ manifest: manifest(), starter: starter(), assetExists: (path) => existsSync(resolve(exampleDirectory, "assets", path.replace("/themes/jelly-studio/", ""))) })).toEqual([]);
  });

  describe("manifest and settings", () => {
    it("explains unknown fields, a wrong asset prefix and a bad version", () => {
      const bad = { ...manifest(), flavour: "mint", version: "one", assetPrefix: "/themes/other/" };
      const issues = validateThemeProject({ manifest: bad });
      expect(codes(issues)).toEqual(["MANIFEST_INVALID", "MANIFEST_INVALID", "MANIFEST_INVALID"]);
      expect(issues.map((issue) => issue.message).join(" ")).toMatch(/Unknown field "flavour"/);
    });

    it("catches settings whose defaults disagree, repeat, or fall outside their choices and bounds", () => {
      const bad = manifest();
      bad.settingsSchema.push({ ...bad.settingsSchema[0] });
      bad.settingsSchema.find((s: { id: string }) => s.id === "buttons.radius").default = "triangle";
      bad.settingsSchema.find((s: { id: string }) => s.id === "layout.contentWidth").default = 5000;
      bad.settingsDefaults.layout.contentWidth = 5000;
      bad.settingsSchema.find((s: { id: string }) => s.id === "colors.accent").default = "gold";
      const found = codes(validateThemeProject({ manifest: bad }));
      expect(found).toEqual(expect.arrayContaining(["DUPLICATE_SETTING", "DEFAULT_MISMATCH", "DEFAULT_NOT_AN_OPTION", "DEFAULT_OUT_OF_RANGE", "BAD_COLOUR"]));
    });

    it("flags a setting with no default value, and missing asset files (a missing preview is only a warning)", () => {
      const bad = manifest();
      delete bad.settingsDefaults.branding;
      const issues = validateThemeProject({ manifest: bad, assetExists: (path) => path.endsWith("mark.svg") });
      expect(codes(issues)).toContain("MISSING_DEFAULT");
      expect(codes(issues, "warning")).toContain("ASSET_MISSING");
      expect(codes(issues)).not.toContain("ASSET_MISSING");
    });
  });

  describe("declarative only: nothing executable", () => {
    it("refuses scripts in the manifest's assets", () => {
      const bad = manifest();
      bad.assets.scripts = [{ id: "app", path: "/themes/jelly-studio/app.js" }];
      expect(codes(validateThemeProject({ manifest: bad }))).toContain("SCRIPTS_NOT_ALLOWED");
    });

    it.each([
      ["a script tag", "<script>alert(1)</script>"],
      ["a script link", "javascript:alert(1)"],
      ["an inline handler", "<img src=x onerror=alert(1)>"],
      ["a CSS import", "@import url(https://evil.test/a.css);"],
      ["an iframe", "<iframe src=\"https://evil.test\"></iframe>"],
    ])("refuses %s in section text", (_label, text) => {
      const bad = starter();
      bad.templates.home.sections[2].section.blocks[0].settings.text = text;
      expect(codes(validateThemeProject({ manifest: manifest(), starter: bad }))).toContain("EXECUTABLE_CONTENT");
    });

    it("refuses links that are not local or https", () => {
      for (const href of ["http://insecure.test", "//evil.test/x", "javascript:alert(1)", "data:text/html,hi"]) {
        const bad = starter();
        bad.templates.home.sections[2].section.blocks[2].settings.href = href;
        expect(codes(validateThemeProject({ manifest: manifest(), starter: bad })), href).toContain("UNSAFE_URL");
      }
      const fine = starter();
      fine.templates.home.sections[2].section.blocks[2].settings.href = "mailto:hello@example.com";
      expect(codes(validateThemeProject({ manifest: manifest(), starter: fine }))).toEqual([]);
    });
  });

  describe("starter templates", () => {
    it("catches an unknown section, a section on the wrong page, and a missing shared section", () => {
      const bad = starter();
      bad.templates.home.sections.push({ kind: "inline", section: { id: "x1", type: "does-not-exist", enabled: true, settings: {}, blocks: [] } });
      bad.templates.home.sections.push({ kind: "inline", section: { id: "x2", type: "product-gallery", enabled: true, settings: {}, blocks: [] } });
      bad.templates.home.sections.push({ kind: "global", globalSectionId: "sidebar" });
      const found = codes(validateThemeProject({ manifest: manifest(), starter: bad }));
      expect(found).toEqual(expect.arrayContaining(["SECTION_NOT_REGISTERED", "SECTION_NOT_ALLOWED_ON_PAGE", "MISSING_GLOBAL_SECTION"]));
    });

    it("catches invalid settings, blocks a section does not allow, and a wrong page type", () => {
      const bad = starter();
      bad.templates.home.sections[3].section.settings.columns = 99;
      bad.templates.home.sections[3].section.blocks.push({ id: "stray", type: "heading", enabled: true, settings: { text: "Hi" } });
      bad.templates.cart.type = "basket";
      const found = codes(validateThemeProject({ manifest: manifest(), starter: bad }));
      expect(found).toEqual(expect.arrayContaining(["SETTINGS_INVALID", "BLOCK_NOT_ALLOWED", "UNKNOWN_PAGE_TYPE"]));
    });

    it("requires unique ids across sections and blocks", () => {
      const bad = starter();
      bad.templates.home.sections[3].section.id = "studio-hero";
      bad.templates.home.sections[2].section.blocks[1].id = "studio-hero-title";
      expect(codes(validateThemeProject({ manifest: manifest(), starter: bad })).filter((code) => code === "DUPLICATE_ID")).toHaveLength(2);
    });

    it("warns about missing recommended templates and unused shared sections, without failing", () => {
      const slim = starter();
      delete slim.templates.cart;
      delete slim.templates["not-found"];
      slim.globalSections.extra = { id: "studio-extra", type: "announcement-bar", enabled: true, settings: {}, blocks: [] };
      const issues = validateThemeProject({ manifest: manifest(), starter: slim });
      expect(codes(issues)).toEqual([]);
      expect(codes(issues, "warning")).toEqual(expect.arrayContaining(["MISSING_TEMPLATE", "UNUSED_GLOBAL_SECTION"]));
    });
  });
});

describe("sections that belong to another theme", () => {
  it("refuses a section limited to a different theme in the starter", async () => {
    const { registerSection } = await import("@jelly/storefront-registry");
    const { z } = await import("zod");
    registerSection({ type: "other-theme/banner", category: "content", supportedPages: ["home"], settingsSchema: z.object({}), controls: [], allowedBlockTypes: [], defaultSettings: {}, defaultBlocks: [], responsiveFields: [], themes: ["other-theme"] });
    const bad = starter();
    bad.templates.home.sections.push({ kind: "inline", section: { id: "ob", type: "other-theme/banner", enabled: true, settings: {}, blocks: [] } });
    expect(codes(validateThemeProject({ manifest: manifest(), starter: bad }))).toContain("SECTION_NOT_AVAILABLE_ON_THEME");
  });
});
