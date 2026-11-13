import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { listThemes, recipesOf, themeManifestSchema, uncheckedRecipes } from "./index.js";
import { resolveTheme } from "./runtime.js";
import { discoveredThemes } from "./themes/index.generated.js";

/**
 * Store pages load `@jelly/storefront-themes/runtime` and `@jelly/storefront-registry/runtime` instead of the main
 * entries, so they never download zod or the section definitions (about a quarter of a store page's JavaScript).
 * These tests keep those entries free of both, and check that skipping the manifest check changes nothing.
 */
const packages = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const schemaExports = new Map<string, string>();
for (const match of readFileSync(join(packages, "storefront-schema/src/index.ts"), "utf8").matchAll(/export\s*\{([^}]*)\}\s*from\s*"\.\/([^"]+)\.js"/g)) {
  for (const name of match[1].split(",").map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter(Boolean)) schemaExports.set(name, `storefront-schema/src/${match[2]}.ts`);
}

/** Every source file a module loads at run time (type-only imports are left out), following the shared packages. */
function runtimeGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = readFileSync(join(packages, file), "utf8");
    for (const match of source.matchAll(/^\s*(?:import|export)\s+(?!type\b)([^;]*?)\s+from\s+"([^"]+)"/gms)) {
      const [, names, specifier] = match;
      if (specifier === "zod") { seen.add("zod"); continue; }
      if (specifier.startsWith(".")) {
        const base = join(dirname(file), specifier).split("\\").join("/");
        const ts = base.replace(/\.js$/, ".ts"), tsx = base.replace(/\.js$/, ".tsx");
        if (existsSync(join(packages, ts))) visit(ts); else if (existsSync(join(packages, tsx))) visit(tsx);
      } else if (specifier === "@jelly/storefront-registry") seen.add("@jelly/storefront-registry (main entry)");
      else if (specifier === "@jelly/storefront-themes") seen.add("@jelly/storefront-themes (main entry)");
      else if (specifier === "@jelly/storefront-registry/runtime") visit("storefront-registry/src/runtime.ts");
      else if (specifier === "@jelly/storefront-schema") {
        for (const name of names.replace(/[{}]/g, "").split(",").map((part) => part.trim()).filter((part) => part && !part.startsWith("type "))) {
          const file = schemaExports.get(name.split(/\s+as\s+/)[0]);
          if (file) visit(file);
        }
      }
    }
  };
  visit(entry);
  return seen;
}

describe("store page entries", () => {
  it.each(["storefront-themes/src/runtime.ts", "storefront-registry/src/runtime.ts"])("%s loads neither zod nor a main entry", (entry) => {
    const graph = [...runtimeGraph(entry)];
    expect(graph.filter((file) => file === "zod" || file.includes("main entry"))).toEqual([]);
    expect(graph.length).toBeGreaterThan(5);
  });

  it("resolves every theme exactly as the checked manifest would", () => {
    for (const theme of listThemes()) {
      const checked = themeManifestSchema.parse(theme.manifest);
      const resolved = resolveTheme(theme.id, {}, checked.version);
      expect(resolved, theme.id).toMatchObject({ id: checked.id, version: checked.version, assetPrefix: checked.assetPrefix, layout: checked.layout, assets: checked.assets, settings: checked.settingsDefaults });
      expect(resolved.fallbackReason, theme.id).toBeUndefined();
    }
  });

  it("reads every theme's recipes the same way without checking them", () => {
    const withRecipes = discoveredThemes.filter(({ manifest }) => Array.isArray((manifest as { sections?: unknown }).sections));
    expect(withRecipes.length).toBeGreaterThan(0);
    for (const { manifest } of withRecipes) expect(uncheckedRecipes(manifest), manifest.id).toEqual(recipesOf(manifest));
  });
});
