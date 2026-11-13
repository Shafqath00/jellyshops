import { describe, expect, it } from "vitest";
import { essentialSectionsProblem, validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import type { PageType, SectionNode } from "@jelly/storefront-schema";
import { FONT_OPTIONS, getStarterPack, listStarterPacks } from "@jelly/storefront-themes";
import { snapshotFromStarterPack } from "@/features/theme-preview/preview-fixtures";
import { merchantEditedSettings, merchantEditedSnapshot } from "./merchant-edits";

const inline = (layout: unknown) => ((layout as { sections?: Array<{ kind: string; section?: SectionNode }> }).sections ?? []).filter((item) => item.kind === "inline" && item.section).map((item) => item.section as SectionNode);
const packs = listStarterPacks().filter((pack) => ["jelly-resthaven", "jelly-signature", "jelly-avenue", "jelly-forma"].includes(pack.theme.themeId)).map((pack) => getStarterPack(pack.id)!);

describe("merchant edits (Phase 6 fuzz)", () => {
  it.each(packs.map((pack) => [pack.id, pack] as const))("%s: every edit is one the editor would save", (_id, pack) => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const snapshot = snapshotFromStarterPack(pack, pack.theme.themeId);
      const edited = merchantEditedSnapshot(snapshot, seed);
      for (const template of Object.values(edited.templates)) {
        const pageType = template.type as PageType;
        const sections = inline(template.layout);
        expect(essentialSectionsProblem(pageType, sections), `${pack.id} ${pageType} seed ${seed}`).toBeNull();
        for (const section of sections) {
          expect(validateSectionAgainstRegistry(section, pageType, pack.theme.themeId).map((issue) => `${section.type}: ${issue.message}`), `${pack.id} ${pageType} seed ${seed}`).toEqual([]);
        }
      }
    }
  });

  it("changes the pages (order, schemes or blocks), the same way for the same seed", () => {
    const pack = packs[0];
    const snapshot = snapshotFromStarterPack(pack, pack.theme.themeId);
    const once = merchantEditedSnapshot(snapshot, 7);
    expect(merchantEditedSnapshot(snapshot, 7)).toEqual(once);
    expect(JSON.stringify(once.templates)).not.toEqual(JSON.stringify(snapshot.templates));
    expect(JSON.stringify(merchantEditedSnapshot(snapshot, 8).templates)).not.toEqual(JSON.stringify(once.templates));
    // The original is never changed.
    expect(snapshotFromStarterPack(pack, pack.theme.themeId)).toEqual(snapshot);
  });

  it("picks fonts from the font library", () => {
    const fonts = new Set<string>(FONT_OPTIONS.map((font) => font.value));
    const settings = merchantEditedSettings({ typography: { headingFont: "Fraunces", bodySize: 16 } }, 3) as { typography: Record<string, unknown> };
    expect(fonts.has(settings.typography.headingFont as string)).toBe(true);
    expect(fonts.has(settings.typography.bodyFont as string)).toBe(true);
    expect(settings.typography.bodySize).toBe(16);
  });
});
