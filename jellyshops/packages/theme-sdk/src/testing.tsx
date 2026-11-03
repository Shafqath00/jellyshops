import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { RegistrySectionRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import { samplePageContext as pageContext } from "./sample-data";
import { listSectionDefinitionsForPage } from "@jelly/storefront-registry";
import type { PageType, RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import { getStarterPack, getThemeDefinition, resolveStorefrontThemeTokens, resolveTheme, validateStarterPack, validateThemeManifest, validateThemeProject, validateThemeSettings, type ThemeManifest } from "@jelly/storefront-themes";

type Region = "header" | "template" | "footer";
type Entry = { region: Region; section: SectionNode };

const commerce: CommerceDataProvider = { initialProducts: [], async getProducts() { return []; } };
const AXE_OPTIONS = { runOnly: { type: "tag" as const, values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"] }, rules: { "color-contrast": { enabled: false }, region: { enabled: false }, "landmark-one-main": { enabled: false }, "page-has-heading-one": { enabled: false } } };

/** A theme's starter templates with their shared sections resolved, ready to draw. */
function entriesFor(packId: string, type: PageType): Entry[] {
  const pack = getStarterPack(packId);
  const layout = pack.templates.find((template) => template.type === type)?.layout.sections ?? [];
  return layout.flatMap((placement): Entry[] => {
    if (placement.kind === "inline") return [{ region: "template", section: placement.section }];
    const global = pack.globalSections.find((entry) => entry.section.id === placement.globalSectionId);
    if (!global) return [];
    return [{ region: global.key === "footer" ? "footer" : "header", section: { ...global.section, settings: { storeName: "Conformance Store", ...global.section.settings } } as SectionNode }];
  });
}

function menusFor(packId: string): Record<string, RuntimeMenuV4> {
  return Object.fromEntries(getStarterPack(packId).menus.map((menu) => [menu.handle, { id: menu.key, handle: menu.handle, items: menu.items }])) as Record<string, RuntimeMenuV4>;
}

function Page({ themeId, packId, type, mode = "preview" }: { themeId: string; packId: string; type: PageType; mode?: "preview" | "published" }) {
  const menus = menusFor(packId);
  const entries = entriesFor(packId, type);
  const draw = ({ region, section }: Entry) => <RegistrySectionRenderer key={section.id} section={section} mode={mode} commerce={commerce} region={region} themeId={themeId} page={pageContext(type)} menus={menus} storeSlug="conformance" />;
  return <div className="jelly-storefront">
    {entries.filter((entry) => entry.region === "header").map(draw)}
    <main>{entries.filter((entry) => entry.region === "template").map(draw)}</main>
    {entries.filter((entry) => entry.region === "footer").map(draw)}
  </div>;
}

function manifestOf(themeId: string): ThemeManifest {
  return validateThemeManifest(getThemeDefinition(themeId).manifest);
}

/**
 * The checks every theme must pass. Call it from a test file:
 *
 *   describeThemeConformance("my-theme");
 *
 * `packId` defaults to the theme id (a starter pack carries the id of its theme).
 */
export function describeThemeConformance(themeId: string, packId = themeId): void {
  const pack = getStarterPack(packId);
  const pageTypes = [...new Set(pack.templates.map((template) => template.type))];

  describe(`theme conformance: ${themeId}`, () => {
    describe("manifest and settings", () => {
      it("has a manifest the platform accepts, with no errors from the project validator", () => {
        const manifest = manifestOf(themeId);
        expect(manifest.id).toBe(themeId);
        const errors = validateThemeProject({ manifest: getThemeDefinition(themeId).manifest }).filter((issue) => issue.level === "error");
        expect(errors).toEqual([]);
      });
      it("is declarative: no scripts", () => {
        expect(manifestOf(themeId).assets.scripts).toEqual([]);
      });
      it("passes its own settings validation with the defaults", () => {
        expect(validateThemeSettings(themeId, resolveTheme(themeId).settings)).toEqual([]);
      });
    });

    describe("starter pack", () => {
      it("is accepted by the starter pack validator", () => {
        expect(validateStarterPack(pack)).toEqual([]);
      });
      it("covers the core page types", () => {
        for (const type of ["home", "product", "collection", "cart", "search", "page", "not-found"] as PageType[]) expect(pageTypes, type).toContain(type);
      });
      it("only uses sections that are allowed on their page", () => {
        for (const type of pageTypes) {
          const allowed = new Set(listSectionDefinitionsForPage(type).map((section) => section.type));
          for (const { region, section } of entriesFor(packId, type)) if (region === "template") expect(allowed.has(section.type), `${type}: ${section.type}`).toBe(true);
        }
      });
    });

    describe("rendering", () => {
      it.each(["preview", "published"] as const)("draws every starter template in %s mode", (mode) => {
        for (const type of pageTypes) {
          const view = render(<Page themeId={themeId} packId={packId} type={type} mode={mode} />);
          expect(view.container.textContent?.length ?? 0, type).toBeGreaterThan(0);
          expect(view.queryByText(/Unsupported section/), type).toBeNull();
          view.unmount();
        }
      });
      it("draws every section used by the starter with empty settings and no blocks", () => {
        const types = new Set(pageTypes.flatMap((type) => entriesFor(packId, type).map((entry) => entry.section.type)));
        for (const type of types) {
          const empty: SectionNode = { id: `empty-${type}`, type, enabled: true, settings: {}, blocks: [] };
          expect(() => render(<RegistrySectionRenderer section={empty} mode="preview" commerce={commerce} themeId={themeId} page={pageContext("home")} menus={menusFor(packId)} storeSlug="conformance" />).unmount(), type).not.toThrow();
        }
      });
    });

    describe("settings reach the output", () => {
      it("a colour setting changes the theme tokens", () => {
        const settings = resolveTheme(themeId).settings;
        const base = resolveStorefrontThemeTokens(themeId, settings);
        const changed = resolveStorefrontThemeTokens(themeId, { ...settings, colors: { ...(settings.colors as object), primary: "#123456", accent: "#654321" } });
        expect(JSON.stringify(changed)).not.toEqual(JSON.stringify(base));
        expect(JSON.stringify(changed).toLowerCase()).toContain("#123456");
      });
    });

    describe("safety", () => {
      it("does not draw links to scripts from menus or button blocks", () => {
        const menus: Record<string, RuntimeMenuV4> = { main: { id: "m", handle: "main", items: [{ id: "bad", label: "Bad", target: { kind: "external", url: "javascript:alert(1)" }, children: [] }] } };
        const header: SectionNode = { id: "h", type: "header", enabled: true, settings: { storeName: "X" }, blocks: [{ id: "menu", type: "menu", enabled: true, settings: { handle: "main" } }] };
        const custom: SectionNode = { id: "c", type: "custom-content", enabled: true, settings: {}, blocks: [{ id: "b", type: "button", enabled: true, settings: { label: "Go", href: "javascript:alert(1)" } }] };
        const view = render(<>{[header, custom].map((section) => <RegistrySectionRenderer key={section.id} section={section} mode="published" commerce={commerce} themeId={themeId} menus={menus} storeSlug="conformance" />)}</>);
        expect(view.container.querySelector('[href^="javascript:" i]')).toBeNull();
      });
    });

    describe("accessibility (axe)", () => {
      it.each(pageTypes)("has no WCAG A/AA violations on the %s template", async (type) => {
        const view = render(<Page themeId={themeId} packId={packId} type={type} />);
        const results = await axe.run(view.container, AXE_OPTIONS);
        expect(results.violations.map((violation) => `${violation.id}: ${violation.nodes.slice(0, 2).map((node) => node.html.slice(0, 80)).join(" | ")}`)).toEqual([]);
        view.unmount();
      });
    });
  });
}
