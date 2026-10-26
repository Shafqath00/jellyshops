import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Theme stylesheets are global CSS, so a rule without the theme's scope would
 * restyle every other storefront and the admin. Each file must scope every
 * selector to its own theme id.
 */
const themes = [
  { file: "jelly-minimal.css", scope: '[data-jelly-theme="jelly-signature"]' },
  { file: "jelly-avenue.css", scope: '[data-jelly-theme="jelly-avenue"]' },
] as const;

/** Selector lists of every style rule, including rules nested in @media. Splits on top-level commas only. */
function selectors(css: string): string[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const found: string[] = [];
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      const prelude = source.slice(start, index).trim();
      if (prelude && !prelude.startsWith("@")) found.push(prelude);
      start = index + 1;
    } else if (char === "}" || char === ";") start = index + 1;
  }
  return found.flatMap((list) => {
    const parts: string[] = [];
    let depth = 0;
    let from = 0;
    for (let index = 0; index < list.length; index += 1) {
      if (list[index] === "(" || list[index] === "[") depth += 1;
      else if (list[index] === ")" || list[index] === "]") depth -= 1;
      else if (list[index] === "," && depth === 0) { parts.push(list.slice(from, index).trim()); from = index + 1; }
    }
    parts.push(list.slice(from).trim());
    return parts;
  });
}

describe.each(themes)("$file", ({ file, scope }) => {
  const css = readFileSync(path.join(__dirname, file), "utf8");

  it("scopes every selector to its theme", () => {
    const all = selectors(css);
    expect(all.length).toBeGreaterThan(100);
    expect(all.filter((selector) => !selector.startsWith(scope))).toEqual([]);
  });

  it("never hard-codes the other theme's scope", () => {
    const other = themes.find((theme) => theme.file !== file)!.scope;
    expect(css).not.toContain(other);
  });
});
