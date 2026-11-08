import { expect, it } from "vitest";
import { DEFAULT_THEME_ID, getThemeAsset, resolveTheme, resolveThemePreview, validateThemeManifest, validateThemeSettings } from "./theme-resolver";

it("resolves declared previews and namespaced optional assets", () => {
  expect(resolveTheme("example-boutique").previewAsset).toBe("/themes/example-boutique/preview.svg");
  expect(getThemeAsset("example-boutique", "monogram")).toBe("/themes/example-boutique/monogram.svg");
});

it("returns a safe fallback when a theme has no available preview", () => {
  expect(resolveThemePreview("minimal").path).toBe("/themes/minimal/preview.svg");
  expect(resolveThemePreview("missing-theme").fallback).toBe(true);
});

it("rejects remote and traversal asset paths", () => {
  expect(() => validateThemeManifest({ id: "unsafe", name: "Unsafe", version: "1.0.0", description: "Unsafe", assetPrefix: "/themes/unsafe/", enabled: true, layout: "standard", settingsDefaults: {}, assets: { stylesheets: [{ id: "x", path: "/themes/unsafe/../../x.css" }], scripts: [], fonts: [], icons: [], assets: [] } })).toThrow();
});

it("resolves a registered theme with manifest defaults", () => {
  const resolved = resolveTheme("example-boutique", { colors: { accent: "#123456" } });

  expect(resolved.id).toBe("example-boutique");
  expect(resolved.version).toBe("1.0.0");
  expect(resolved.settings).toMatchObject({ colors: { accent: "#123456" } });
  expect(resolved.fallbackReason).toBeUndefined();
});

it("falls back safely when the requested theme is unavailable", () => {
  const resolved = resolveTheme("deleted-theme", {});

  expect(resolved.id).toBe(DEFAULT_THEME_ID);
  expect(resolved.fallbackReason).toBe("theme-unavailable");
});

it("merges manifest defaults and validates known merchant overrides without discarding unknown settings", () => {
  const settings = {
    colors: { accent: "#123456" },
    layout: { containerWidth: "wide" },
    legacyExtension: { keepsWorking: true },
  };
  const resolved = resolveTheme("example-boutique", settings);

  expect(resolved.settings).toMatchObject({
    colors: { accent: "#123456" },
    layout: { containerWidth: "wide" },
    legacyExtension: { keepsWorking: true },
  });
  expect(validateThemeSettings("example-boutique", settings)).toEqual([]);
  expect(validateThemeSettings("example-boutique", { layout: { containerWidth: "unsupported" } })[0]?.path).toBe("layout.containerWidth");
});
