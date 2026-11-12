import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "platform-base.css"), "utf8");
const OFF = '[data-jelly-legacy-styles="off"]';

/** Every selector of every rule (inside @media too), comments removed. */
function selectors(source: string): string[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: string[] = [];
  for (const match of text.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const selector = match[1].trim().replace(/^@media[^{]*\{?/, "").trim();
    if (!selector) continue;
    let depth = 0; let current = "";
    for (const char of selector) {
      if (char === "(" || char === "[") depth += 1;
      if (char === ")" || char === "]") depth -= 1;
      if (char === "," && depth === 0) { out.push(current.trim()); current = ""; } else current += char;
    }
    out.push(current.trim());
  }
  return out;
}

describe("Platform base design (platform-base.css)", () => {
  it("only reaches themes on the platform defaults", () => {
    const outside = selectors(css).filter((selector) => !selector.startsWith(OFF));
    expect(outside).toEqual([]);
    expect(selectors(css).length).toBeGreaterThan(300);
  });

  it("loads after the shared base and before every theme file, on the live store and in the CLI preview", () => {
    const layout = readFileSync(path.join(__dirname, "..", "layout.tsx"), "utf8");
    const order = ["./themes/storefront-base.css", "./themes/platform-base.css", "./themes/jelly-minimal.css", "./themes/jelly-resthaven.css"].map((file) => layout.indexOf(file));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const frame = readFileSync(path.join(__dirname, "..", "..", "..", "packages/theme-cli/preview/frame.tsx"), "utf8");
    expect(frame.indexOf("storefront-base.css")).toBeLessThan(frame.indexOf("platform-base.css"));
  });

  it("reads tokens for colours (only two fallback shades are written out)", () => {
    expect(css.match(/#[0-9a-f]{3,6}\b/gi)?.sort()).toEqual(["#10131c", "#10131c", "#fff", "#fff"]);
  });
});
