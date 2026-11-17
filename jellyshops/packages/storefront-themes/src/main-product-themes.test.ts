import { validateSectionAgainstRegistry, type V4StarterPack } from "@jelly/storefront-registry";
import type { BlockNode, SectionNode } from "@jelly/storefront-schema";
import { describe, expect, it } from "vitest";
import { currentLayoutRevision, detectLayoutRevision, planLayoutUpgrade, type LayoutDraft, type LayoutPlacement } from "./layout-revisions";
import { builtInLayoutHistory } from "./builtin-layouts/index";
import { createStarterPack, getStarterPack } from "./starter-packs";
import { discoveredThemes } from "./themes/index.generated";
import { discoveredStarters } from "./themes/starters.generated";

/**
 * Theme plan T5 part 2: themes whose product page moved from separate product sections to Main product. A store on
 * the old layout must upgrade to the new one (parts carry the old sections' settings and blocks), and the new starter
 * must be valid. Add a theme here when its product page moves.
 */
const MOVED: Array<{ theme: string; from: number; parts: string[] }> = [
  { theme: "jelly-diode", from: 1, parts: ["part-product-information", "part-product-options", "part-product-purchase", "delivery-estimate", "part-trust-strip"] },
  { theme: "jelly-halo", from: 1, parts: ["part-product-information", "part-product-options", "part-product-purchase", "delivery-estimate", "part-trust-strip"] },
  { theme: "jelly-signature", from: 1, parts: ["part-product-information", "part-product-options", "part-product-purchase", "part-product-description"] },
  { theme: "jelly-harbour", from: 1, parts: ["part-product-information", "part-product-options", "part-product-purchase", "part-product-description"] },
  { theme: "jelly-avenue", from: 1, parts: ["part-product-information", "part-product-options", "part-product-purchase", "part-product-stock-counter", "part-product-description", "part-product-tabs", "part-trust-strip"] },
  { theme: "jelly-forma", from: 1, parts: ["part-product-information", "part-product-options", "part-product-purchase", "part-product-description", "part-product-specifications", "part-product-tabs"] },
];

const rekeyBlocks = (blocks: BlockNode[], prefix: string): BlockNode[] => blocks.map((block) => ({ ...block, id: `${prefix}:${block.id}`, ...(block.blocks ? { blocks: rekeyBlocks(block.blocks, prefix) } : {}) }));
const rekey = (section: SectionNode, prefix: string): SectionNode => ({ ...structuredClone(section), id: `${prefix}:${section.id}`, blocks: rekeyBlocks(structuredClone(section.blocks), prefix) });

function packFor(theme: string, revision: number): V4StarterPack {
  const builtIn = builtInLayoutHistory[theme]?.revisions.find((entry) => entry.revision === revision);
  if (builtIn) return { ...getStarterPack(theme), globalSections: structuredClone(builtIn.globalSections), templates: structuredClone(builtIn.templates) };
  const manifest = discoveredThemes.find((entry) => entry.manifest.id === theme)!.manifest;
  const history = (discoveredStarters[theme].layoutHistory as unknown as { revisions: Array<{ revision: number; globalSections: never; templates: never }> }).revisions;
  const old = history.find((entry) => entry.revision === revision);
  return old ? createStarterPack({ manifest, starter: { globalSections: old.globalSections, templates: old.templates } })! : getStarterPack(theme);
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

const productSections = (pack: V4StarterPack) => (pack.templates.find((template) => template.type === "product")!.layout.sections as LayoutPlacement[])
  .flatMap((placement) => placement.kind === "inline" ? [placement.section] : []);

describe.each(MOVED)("$theme product page on Main product", ({ theme, from, parts }) => {
  it("starts new stores on Main product with a valid buying column", () => {
    const pack = getStarterPack(theme);
    const main = productSections(pack).find((section) => section.type === "main-product")!;
    expect(main.blocks.map((block) => block.type)).toEqual(parts);
    expect(productSections(pack).map((section) => section.type)).not.toContain("product-gallery");
    expect(validateSectionAgainstRegistry(main, "product", theme)).toEqual([]);
    expect(currentLayoutRevision(theme)).toBe(from + 1);
  });

  it("upgrades a store on the old layout, carrying the merchant's changes into the parts", () => {
    const draft = install(packFor(theme, from));
    expect(detectLayoutRevision(theme, draft)).toBe(from);
    // The merchant renamed the Add to cart button before the upgrade.
    const product = draft.templates.find((template) => template.type === "product")!;
    const purchase = (product.layout.sections as LayoutPlacement[]).find((placement) => placement.kind === "inline" && placement.section.type === "product-purchase") as { section: SectionNode };
    purchase.section.settings = { ...purchase.section.settings, label: "Buy it now" };

    const plan = planLayoutUpgrade(theme, draft, from, "upgrade-1");
    const upgraded = plan.draft.templates.find((template) => template.type === "product")!;
    const sections = (upgraded.layout.sections as LayoutPlacement[]).flatMap((placement) => placement.kind === "inline" ? [placement.section] : []);
    const main = sections.find((section) => section.type === "main-product")!;
    expect(main.blocks.map((block) => block.type)).toEqual(parts);
    expect(main.blocks.find((block) => block.type === "part-product-purchase")!.settings.label).toBe("Buy it now");
    expect(sections.map((section) => section.type)).not.toContain("product-purchase");
    expect(validateSectionAgainstRegistry(main, "product", theme)).toEqual([]);
  });
});
