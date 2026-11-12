import { validateSectionAgainstRegistry, type V4StarterPack } from "@jelly/storefront-registry";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";
import layoutHistory from "./themes/jelly-resthaven/layout-history.json" with { type: "json" };
import { currentLayoutRevision, detectLayoutRevision, layoutRevisions, planLayoutUpgrade, type LayoutDraft, type LayoutPlacement } from "./layout-revisions";
import { createStarterPack, getStarterPack } from "./starter-packs";
import { discoveredThemes } from "./themes/index.generated";

const THEME = "jelly-resthaven";
const rekeyBlocks = (blocks: BlockNode[], prefix: string): BlockNode[] => blocks.map((block) => ({ ...block, id: `${prefix}:${block.id}`, ...(block.blocks ? { blocks: rekeyBlocks(block.blocks, prefix) } : {}) }));
const rekey = (section: SectionNode, prefix: string): SectionNode => ({ ...structuredClone(section), id: `${prefix}:${section.id}`, blocks: rekeyBlocks(structuredClone(section.blocks), prefix) });

function packFor(revision: number): V4StarterPack {
  const theme = discoveredThemes.find((entry) => entry.manifest.id === THEME)!;
  const old = (layoutHistory.revisions as unknown as Array<{ revision: number; globalSections: never; templates: never }>).find((entry) => entry.revision === revision);
  return old ? createStarterPack({ manifest: theme.manifest, starter: { globalSections: old.globalSections, templates: old.templates } })! : getStarterPack(THEME);
}

/** What the starter installation service writes, as a draft. */
function install(pack: V4StarterPack, prefix = "install-1"): LayoutDraft {
  return {
    globals: pack.globalSections.map((entry) => ({ id: `${prefix}:${entry.section.id}`, section: rekey(entry.section, prefix) })),
    templates: pack.templates.map((template) => ({
      id: `${prefix}:${template.key}`, type: template.type, handle: "default",
      layout: { sections: (template.layout.sections as LayoutPlacement[]).map((placement) => placement.kind === "global" ? { kind: "global" as const, globalSectionId: `${prefix}:${placement.globalSectionId}` } : { kind: "inline" as const, section: rekey(placement.section, prefix) }) },
    })),
  };
}

const home = (draft: LayoutDraft) => draft.templates.find((template) => template.type === "home")!.layout.sections;
const inline = (placements: LayoutPlacement[]) => placements.flatMap((placement) => placement.kind === "inline" ? [placement.section] : []);

describe("layout revisions", () => {
  it("knows Resthaven's layouts, oldest first, with the starter as the newest", () => {
    expect(currentLayoutRevision(THEME)).toBe(5);
    expect(layoutRevisions(THEME).map((entry) => entry.revision)).toEqual([1, 2, 3, 4, 5]);
    expect(currentLayoutRevision("jelly-signature")).toBe(1);
  });

  it("recognises which layout a fresh install came from", () => {
    for (const revision of [1, 2, 3, 4, 5]) expect(detectLayoutRevision(THEME, install(packFor(revision)))).toBe(revision);
  });

  it("still recognises the starting layout after merchant edits", () => {
    const draft = install(packFor(2));
    inline(home(draft))[1]!.settings.heading = "My own heading";
    home(draft).splice(3, 1);
    expect(detectLayoutRevision(THEME, draft)).toBe(2);
  });

  describe("upgrading a store built from the 5 November layout", () => {
    const draft = install(packFor(2));
    const hero = inline(home(draft)).find((section) => section.type === "hero")!;
    hero.settings.heading = "Beds by Newbi";
    const own: SectionNode = { id: "merchant-section-1", type: "rich-text", enabled: true, settings: { heading: "Visit our showroom" }, blocks: [] };
    home(draft).splice(home(draft).length - 1, 0, { kind: "inline", section: own });
    const header = draft.globals.find((global) => global.section.type === "header")!;
    header.section.settings.showAccount = false;
    const alternate = { id: "alt-1", type: "product" as const, handle: "bed", layout: { sections: [] as LayoutPlacement[] } };
    draft.templates.push(alternate);
    const plan = planLayoutUpgrade(THEME, draft, 2, "upgrade-1");
    const current = packFor(5);

    it("lays every page out as the current starter does", () => {
      for (const template of current.templates) {
        const result = plan.draft.templates.find((candidate) => candidate.type === template.type && candidate.handle === "default")!;
        const starterTypes = inline(template.layout.sections as LayoutPlacement[]).map((section) => section.type);
        const resultTypes = inline(result.layout.sections).map((section) => section.type).filter((type) => type !== "rich-text" || template.type !== "home");
        expect(resultTypes, template.type).toEqual(starterTypes);
      }
    });

    it("keeps the merchant's edits, own sections and shared-section changes", () => {
      const newHero = inline(home(plan.draft)).find((section) => section.type === "hero")!;
      expect(newHero.settings.heading).toBe("Beds by Newbi");
      expect(newHero.id).toBe(hero.id);
      const placements = home(plan.draft);
      const ownAt = placements.findIndex((placement) => placement.kind === "inline" && placement.section.id === own.id);
      expect(ownAt).toBe(placements.length - 2);
      expect(placements[placements.length - 1]).toEqual({ kind: "global", globalSectionId: draft.globals.find((global) => global.section.type === "footer")!.id });
      expect(plan.draft.globals.find((global) => global.id === header.id)!.section.settings.showAccount).toBe(false);
      expect(plan.pages.find((page) => page.pageType === "home")!.kept.map((entry) => entry.type)).toEqual(["rich-text"]);
      expect(plan.shared.carried.map((entry) => entry.type)).toContain("header");
    });

    it("drops old sections the merchant never touched, and says so", () => {
      const homeChange = plan.pages.find((page) => page.pageType === "home")!;
      expect(homeChange.removed.map((entry) => entry.type)).toContain("jelly-resthaven/categories");
      expect(inline(home(plan.draft)).some((section) => section.type === "jelly-resthaven/categories")).toBe(false);
      expect(homeChange.added.map((entry) => entry.type)).toContain("category-grid");
    });

    it("leaves alternate templates alone and gives a draft every section of which is valid", () => {
      expect(plan.draft.templates.find((template) => template.id === "alt-1")).toEqual(alternate);
      for (const template of plan.draft.templates) {
        for (const section of inline(template.layout.sections)) expect(validateSectionAgainstRegistry(section, template.type, THEME), `${template.type}/${section.type}`).toEqual([]);
      }
      for (const global of plan.draft.globals) expect(validateSectionAgainstRegistry(global.section, "home", THEME).filter((issue) => issue.code !== "SECTION_NOT_ALLOWED_ON_PAGE")).toEqual([]);
    });

    it("is then recognised as the current layout", () => {
      expect(detectLayoutRevision(THEME, plan.draft)).toBe(5);
    });
  });

  it("moves the old product sections into Main product's parts, keeping the merchant's changes", () => {
    const draft = install(packFor(4));
    const product = draft.templates.find((template) => template.type === "product")!;
    const sections = inline(product.layout.sections);
    sections.find((section) => section.type === "product-gallery")!.settings.mediaRatio = "square";
    sections.find((section) => section.type === "product-purchase")!.settings.label = "Buy this bed";
    const trust = sections.find((section) => section.type === "trust-strip")!;
    trust.blocks[0]!.settings.text = "Free delivery in London";
    const removed = sections.find((section) => section.type === "product-specifications")!;
    product.layout.sections = product.layout.sections.filter((placement) => placement.kind !== "inline" || placement.section.id !== removed.id);

    const plan = planLayoutUpgrade(THEME, draft, 4, "install-1");
    const result = inline(plan.draft.templates.find((template) => template.type === "product")!.layout.sections);
    expect(result.map((section) => section.type)).toEqual(["main-product", "product-dimensions", "product-reviews", "related-products", "recently-viewed"]);
    const main = result[0]!;
    expect(main.settings.mediaRatio).toBe("square");
    expect(main.settings.mediaWidth).toBe("wide");
    expect(main.blocks.map((block) => block.type)).toEqual(["part-rating-summary", "part-product-information", "part-product-options", "part-product-purchase", "part-trust-strip", "part-product-description"]);
    expect(main.blocks.find((block) => block.type === "part-product-purchase")!.settings.label).toBe("Buy this bed");
    expect(main.blocks.find((block) => block.type === "part-trust-strip")!.blocks?.[0]?.settings.text).toBe("Free delivery in London");
    expect(main.blocks.every((block) => block.id.startsWith("install-1:"))).toBe(true);
    const page = plan.pages.find((entry) => entry.pageType === "product")!;
    expect(page.carried.map((entry) => entry.type)).toEqual(expect.arrayContaining(["main-product", "product-purchase", "trust-strip"]));
    expect(page.skipped.map((entry) => entry.type)).toEqual(["product-specifications"]);
    expect(page.kept).toEqual([]);
    expect(page.combined.map((entry) => entry.type)).toEqual(["product-gallery", "rating-summary", "product-information", "product-options", "product-purchase", "trust-strip", "product-description"]);
    expect(validateSectionAgainstRegistry(main, "product", THEME)).toEqual([]);
  });

  it("refuses to upgrade a draft that is already current", () => {
    expect(() => planLayoutUpgrade(THEME, install(packFor(5)), 5, "x")).toThrow(/already uses the current layout/);
  });
});
