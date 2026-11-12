import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_SCHEMES } from "@jelly/storefront-themes";

const css = readFileSync(path.join(__dirname, "storefront-base.css"), "utf8");
const start = css.indexOf(":where([data-section-frame]) > :where(.jelly-section) { padding-block");
const rhythm = css.slice(start, css.indexOf("padding-top: 0; }", start));

describe("Section rhythm (storefront-base.css)", () => {
  it("pads every section from the one section scale", () => {
    expect(start).toBeGreaterThan(-1);
    expect(rhythm).toContain("padding-block: var(--section-space, var(--j-section-md))");
  });

  it("lets two neighbours share one gap for every theme colour scheme, never own colours", () => {
    for (const scheme of CONTRACT_SCHEMES.filter((item) => item !== "custom")) {
      expect(rhythm).toContain(`[data-scheme="${scheme}"]`);
    }
    expect(rhythm).not.toContain('[data-scheme="custom"]');
    expect(rhythm).toContain("[data-section-frame]:not([data-scheme])");
  });

  it("never joins sections over a photo, thin strips or the header and footer", () => {
    for (const type of ["hero", "slideshow", "image-banner", "video", "collection-header", "trust-strip", "header", "footer"]) {
      expect(rhythm).toContain(`[data-section-type="${type}"]`);
    }
  });

  it("comes before exact padding, so a section's own px always wins", () => {
    expect(start).toBeLessThan(css.indexOf(':where([data-section-style~="pad-top"]) > :where(*)'));
  });
});
