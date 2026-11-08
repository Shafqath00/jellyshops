import { describe, expect, it } from "vitest";
import { getV4StarterPack } from "./v4-starter-packs";
import { validateV4StarterPack } from "./v4-starter-packs-validation";

describe("validateV4StarterPack", () => {
  it.each(["fresh-market", "artisan-boutique"] as const)("accepts complete %s", (id) => {
    expect(validateV4StarterPack(getV4StarterPack(id))).toEqual([]);
  });

  it("rejects a missing required page template", () => {
    const pack = getV4StarterPack("fresh-market");
    pack.templates = pack.templates.filter(({ type }) => type !== "article");

    expect(validateV4StarterPack(pack).map(({ code }) => code)).toContain("MISSING_DEFAULT_TEMPLATE");
  });

  it("rejects duplicate default templates and pack-local keys", () => {
    const pack = getV4StarterPack("fresh-market");
    pack.templates.push(structuredClone(pack.templates[0]!));

    expect(validateV4StarterPack(pack).map(({ code }) => code)).toEqual(expect.arrayContaining(["DUPLICATE_DEFAULT_TEMPLATE", "DUPLICATE_KEY"]));
  });

  it("rejects unregistered or page-incompatible sections and unsupported blocks", () => {
    const unregistered = getV4StarterPack("fresh-market");
    const home = unregistered.templates.find(({ type }) => type === "home")!;
    home.layout.sections = [{ kind: "inline", section: { id: "bad-section", type: "not-registered", enabled: true, settings: {}, blocks: [] } }];
    expect(validateV4StarterPack(unregistered).map(({ code }) => code)).toContain("INVALID_SECTION");

    const badBlock = getV4StarterPack("fresh-market");
    const badHome = badBlock.templates.find(({ type }) => type === "home")!;
    const hero = badHome.layout.sections.find((placement) => placement.kind === "inline")!;
    if (hero.kind === "inline") hero.section.blocks.push({ id: "bad-block", type: "not-allowed", enabled: true, settings: {} });
    expect(validateV4StarterPack(badBlock).map(({ code }) => code)).toContain("INVALID_SECTION");

    const wrongPage = getV4StarterPack("fresh-market");
    const page = wrongPage.templates.find(({ type }) => type === "page")!;
    page.layout.sections = [{ kind: "inline", section: { id: "home-only", type: "hero", enabled: true, settings: {}, blocks: [] } }];
    expect(validateV4StarterPack(wrongPage).map(({ code }) => code)).toContain("INVALID_SECTION");
  });

  it("rejects missing globals and invalid menu targets", () => {
    const noHeader = getV4StarterPack("fresh-market");
    noHeader.globalSections = noHeader.globalSections.filter(({ key }) => key !== "header");
    expect(validateV4StarterPack(noHeader).map(({ code }) => code)).toContain("MISSING_GLOBAL_SECTION");

    const badMenu = getV4StarterPack("fresh-market");
    badMenu.menus[0]!.items[0]!.target = { kind: "product", resourceId: "missing" } as never;
    expect(validateV4StarterPack(badMenu).map(({ code }) => code)).toContain("INVALID_MENU_TARGET");
  });

  it("rejects unsupported theme identity, unsafe URLs, and non-optional resource references", () => {
    const badTheme = getV4StarterPack("fresh-market");
    badTheme.theme.themeId = "missing-theme";
    expect(validateV4StarterPack(badTheme).map(({ code }) => code)).toContain("INVALID_THEME");

    const unsafe = getV4StarterPack("fresh-market");
    const hero = unsafe.templates.find(({ type }) => type === "home")!.layout.sections.find((placement) => placement.kind === "inline")!;
    if (hero.kind === "inline") hero.section.settings.image = { url: "javascript:alert(1)", alt: "unsafe" };
    expect(validateV4StarterPack(unsafe).map(({ code }) => code)).toContain("UNSAFE_URL");

    const requiredResource = getV4StarterPack("fresh-market");
    requiredResource.resourceReferences = [{ key: "featured", resourceType: "collection", required: true, initialResourceId: "fake" } as never];
    expect(validateV4StarterPack(requiredResource).map(({ code }) => code)).toContain("INVALID_RESOURCE_REFERENCE");
  });

  it("requires the shared header and footer placements on every template", () => {
    const missingChrome = getV4StarterPack("artisan-boutique");
    const product = missingChrome.templates.find(({ type }) => type === "product")!;
    product.layout.sections = product.layout.sections.filter((placement) => placement.kind !== "global");

    expect(validateV4StarterPack(missingChrome).map(({ code }) => code)).toContain("MISSING_GLOBAL_PLACEMENT");
  });

  it("reports malformed section nodes rather than throwing", () => {
    const malformed = getV4StarterPack("artisan-boutique");
    const home = malformed.templates.find(({ type }) => type === "home")!;
    home.layout.sections = [{ kind: "inline", section: { id: "broken", type: "hero", enabled: true, settings: {} } as never }];

    expect(() => validateV4StarterPack(malformed)).not.toThrow();
    expect(validateV4StarterPack(malformed).map(({ code }) => code)).toContain("INVALID_SECTION");
  });
});
