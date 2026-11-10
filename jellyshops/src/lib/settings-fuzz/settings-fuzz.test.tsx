import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getSectionDefinition, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { PageType } from "@jelly/storefront-schema";
import { jellyMinimalPreview } from "@/features/theme-preview/configs";
import { BASELINE_GROUPS, BaselineSections, baselineSections, fuzzedBaselineSections } from "@/features/theme-preview/section-baseline";
import { FUZZ_TEXTS, fuzzSection, seededRandom } from "./generate";

/**
 * Settings fuzz, first layer: random but valid settings for every section (each preset) must be something the
 * editor can save, and every section must draw with them. The browser layer (e2e/settings-fuzz.spec.ts) then checks
 * the layout of the same pages inside every theme.
 */
afterEach(cleanup);
const photos = ["/theme-preview/messy/square.webp", "/theme-preview/messy/tall-phone.webp", "/theme-preview/messy/wide-banner.webp"];
const SEEDS = Array.from({ length: 10 }, (_, index) => index + 1);
/** The first page type a section may be used on (blog sections sit on the Page group of the baseline). */
const pageFor = (type: string): PageType => (getSectionDefinition(type)?.supportedPages[0] ?? "home") as PageType;

describe("settings generator", () => {
  it("is repeatable: the same seed gives the same settings", () => {
    const [entry] = baselineSections(photos).filter((item) => item.section.type === "hero");
    expect(fuzzSection(entry.section, seededRandom(7), photos)).toEqual(fuzzSection(entry.section, seededRandom(7), photos));
    expect(fuzzSection(entry.section, seededRandom(7), photos)).not.toEqual(fuzzSection(entry.section, seededRandom(8), photos));
  });

  it("changes most of a section's settings, texts included", () => {
    const entry = baselineSections(photos).find((item) => item.section.type === "custom-content")!;
    const fuzzed = fuzzSection(entry.section, seededRandom(3), photos);
    const changed = Object.keys(fuzzed.settings).filter((key) => JSON.stringify(fuzzed.settings[key]) !== JSON.stringify(entry.section.settings[key]));
    expect(changed.length).toBeGreaterThan(10);
    expect(FUZZ_TEXTS).toContain(fuzzed.blocks.find((block) => block.type === "heading")?.settings.text);
  });
});

describe.each(SEEDS)("seed %i", (seed) => {
  const entries = fuzzedBaselineSections(baselineSections(photos), seed, photos);

  it("gives every section settings the editor could save", () => {
    const problems = entries.flatMap((entry) => validateSectionAgainstRegistry(entry.section, pageFor(entry.section.type)).map((issue) => `${entry.label}: ${issue.message}`));
    expect(problems).toEqual([]);
  });

  it("draws every section on every page", () => {
    for (const [group] of BASELINE_GROUPS) {
      const { container } = render(<BaselineSections group={group} config={jellyMinimalPreview} seed={seed} />);
      const failed = [...container.querySelectorAll("[data-render-error]")].map((node) => node.textContent);
      expect(failed, group).toEqual([]);
      cleanup();
    }
  });
});
