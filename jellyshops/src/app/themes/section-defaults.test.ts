import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listSectionDefinitions } from "@jelly/storefront-registry";
import { baselineSections } from "@/features/theme-preview/section-baseline";

/**
 * Section defaults (section-defaults.css) are the platform layout every theme starts from. They must never beat a
 * theme rule, so every selector sits entirely inside :where() (no specificity) and is limited to storefront pages.
 */
const css = readFileSync(path.join(__dirname, "section-defaults.css"), "utf8");

/** Top-level selector lists of every rule, including rules nested in @media. */
function selectorLists(source: string): string[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "{") {
      const prelude = text.slice(start, index).trim();
      if (prelude && !prelude.startsWith("@")) found.push(prelude);
      start = index + 1;
    } else if (char === "}" || char === ";") start = index + 1;
  }
  return found;
}

/** The selector with its one outer :where(…) taken off, or null when it is not a single :where() (plus a pseudo-element). */
function whereBody(selector: string): string | null {
  if (!selector.startsWith(":where(")) return null;
  let depth = 0;
  for (let index = 6; index < selector.length; index += 1) {
    if (selector[index] === "(") depth += 1;
    if (selector[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        const rest = selector.slice(index + 1);
        return rest === "" || /^::[a-z-]+$/.test(rest) ? selector.slice(7, index) : null;
      }
    }
  }
  return null;
}

describe("section defaults stylesheet", () => {
  const lists = selectorLists(css);

  it("has rules", () => { expect(lists.length).toBeGreaterThan(100); });

  it("wraps every selector in :where() so any theme rule wins", () => {
    expect(lists.filter((selector) => whereBody(selector) === null)).toEqual([]);
  });

  it("limits every rule to storefronts of themes without the old default rules", () => {
    const unscoped = lists.filter((selector) => {
      const body = whereBody(selector) ?? "";
      // Every comma-separated part inside :where() must start at such a storefront root (older themes keep globals.css).
      return body.split(/,(?![^(]*\))/).some((part) => !part.trim().startsWith('[data-jelly-legacy-styles="off"]'));
    });
    expect(unscoped).toEqual([]);
  });

  it("reads colours from tokens, apart from white text over photos", () => {
    const colours = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/#[0-9a-f]{3,8}\b/gi) ?? [];
    expect([...new Set(colours.map((value) => value.toLowerCase()))].sort()).toEqual(["#1c1b19", "#fff"]);
  });

  it("loads before the platform rules and the themes", () => {
    const layout = readFileSync(path.join(__dirname, "..", "layout.tsx"), "utf8");
    const order = ["./themes/section-defaults.css", "./themes/storefront-base.css", "./themes/jelly-minimal.css"].map((file) => layout.indexOf(file));
    expect(order.every((position) => position > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

describe("section baseline page", () => {
  it("draws every section the platform offers", () => {
    const drawn = new Set(baselineSections(["/photo.webp"]).map((entry) => entry.section.type));
    const offered = listSectionDefinitions().filter((definition) => !definition.themes?.length).map((definition) => definition.type);
    expect(offered.filter((type) => !drawn.has(type))).toEqual([]);
  });

  it("fills empty photo settings with sample photos", () => {
    const hero = baselineSections(["/photo.webp"]).find((entry) => entry.section.type === "hero");
    expect((hero?.section.settings.image as { url?: string } | undefined)?.url).toBeTruthy();
  });
});
