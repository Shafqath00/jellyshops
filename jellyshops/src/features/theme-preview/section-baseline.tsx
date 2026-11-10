"use client";

import { Component, useEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { RegistrySectionRenderer, type CommerceDataProvider, type StorefrontPageContext } from "@jelly/storefront-renderer";
import { createPresetSection, createSectionFromDefinition, getBlockDefinition, listSectionDefinitions, listSectionPresets } from "@jelly/storefront-registry";
import type { BlockNode, RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import { resolveStorefrontThemeTokens, resolveTheme } from "@jelly/storefront-themes";
import { StorefrontPreviewFrame } from "@/features/store-editor/components/storefront-preview-frame";
import { jellyMinimalPreview, themePreviewEntries, type ThemePreviewConfig } from "./configs";
import { fuzzSection, seededRandom } from "@/lib/settings-fuzz/generate";
import { messyPreviewConfig } from "./messy-data";
import { sampleReviews } from "./sample-reviews";
import { previewPages, useCartContext, useProductContext, usePreviewCart, withPreviewQuickAdd, type PreviewTemplate } from "./template-preview";

/**
 * Section baseline: every section the platform offers, drawn with the platform's own CSS only (storefront-base.css
 * and the shared tokens) and no theme rules. The root's `data-jelly-theme` names no theme, so no theme stylesheet,
 * theme kit or legacy storefront rule applies. A section that lays out correctly here lays out correctly in every
 * theme; a theme may change how it looks, never whether it works. The design lint measures this page at three
 * widths (e2e/design-lint.spec.ts).
 */
export const BASELINE_THEME_ATTRIBUTE = "platform-baseline";

/** Pages of the baseline, each with the sections first offered on that kind of page. */
export const BASELINE_GROUPS = [
  ["home", "Home"],
  ["product", "Product"],
  ["collection", "Collection"],
  ["cart", "Cart"],
  ["search", "Search"],
  ["page", "Page"],
  ["not-found", "404"],
] as const;
export type BaselineGroup = (typeof BASELINE_GROUPS)[number][0];

const pageOrder = ["home", "product", "collection", "cart", "search", "not-found", "page", "blog", "article"] as const;
const groupOf = (supported: readonly string[]): BaselineGroup => {
  const first = pageOrder.find((page) => supported.includes(page)) ?? "page";
  return first === "blog" || first === "article" ? "page" : first;
};

let counter = 0;
const nextId = () => `baseline-${++counter}`;

/** Fills every empty photo setting with a sample photo, so sections are judged with photos in them. */
function withPhotos<T extends { type: string; settings: Record<string, unknown> }>(node: T, controls: ReadonlyArray<{ type: string; key: string }>, photo: () => string): T {
  const settings = { ...node.settings };
  for (const control of controls) {
    if (control.type !== "image") continue;
    const current = settings[control.key] as { url?: string } | undefined;
    if (!current?.url) settings[control.key] = { url: photo(), alt: "" };
  }
  return { ...node, settings };
}
function blockWithPhotos(block: BlockNode, photo: () => string): BlockNode {
  const definition = getBlockDefinition(block.type);
  const filled = withPhotos(block, definition?.controls ?? [], photo);
  return { ...filled, ...(block.blocks ? { blocks: block.blocks.map((child) => blockWithPhotos(child, photo)) } : {}) };
}

export interface BaselineEntry { label: string; group: BaselineGroup; section: SectionNode; region: "header" | "template" | "footer" }

/** Every section, once per preset (a section without presets once, with its defaults), with sample photos. */
export function baselineSections(photos: readonly string[]): BaselineEntry[] {
  let index = 0;
  const photo = () => photos[index++ % photos.length] ?? "";
  const presets = listSectionPresets();
  return listSectionDefinitions().filter((definition) => !definition.themes?.length).flatMap((definition) => {
    const regions = definition.allowedRegions ?? ["template"];
    const region = regions.includes("template") ? "template" : regions[0] === "footer" ? "footer" : "header";
    const own = presets.filter((preset) => preset.sectionType === definition.type);
    const made = own.length
      ? own.map((preset) => ({ label: `${definition.type} · ${preset.label}`, section: createPresetSection(preset.id, nextId) }))
      : [{ label: definition.type, section: createSectionFromDefinition(definition.type, nextId) }];
    return made.map(({ label, section }) => {
      const filled = region === "template" ? withPhotos(section, definition.controls, photo) : section;
      const withStore = region === "template" ? filled : { ...filled, settings: { storeName: "Baseline store", ...filled.settings } };
      return { label, group: region === "template" ? groupOf(definition.supportedPages) : "home", region, section: { ...withStore, blocks: region === "template" ? withStore.blocks.map((block) => blockWithPhotos(block, photo)) : withStore.blocks } as SectionNode };
    });
  });
}

/** Every section with random but valid settings (settings fuzz, phase 6); the same seed gives the same page. */
export function fuzzedBaselineSections(entries: readonly BaselineEntry[], seed: number, photos: readonly string[]): BaselineEntry[] {
  return entries.map((entry, index) => ({ ...entry, section: fuzzSection(entry.section, seededRandom(seed * 1000 + index), photos) }));
}

/** Catches a section that fails to draw, so the page keeps going and the failure is marked for the checks. */
class SectionGuard extends Component<{ label: string; children: ReactNode }, { failed: string | null }> {
  state = { failed: null as string | null };
  static getDerivedStateFromError(error: unknown) { return { failed: error instanceof Error ? error.message : String(error) }; }
  render() {
    return this.state.failed ? <p data-render-error={this.props.label} role="alert" style={{ margin: 0, padding: 8, background: "#fde8e8", color: "#7f1d1d" }}>{this.props.label} failed to draw: {this.state.failed}</p> : this.props.children;
  }
}

const menus: Record<string, RuntimeMenuV4> = {
  main: { id: "baseline-main", handle: "main", items: [
    { id: "home", label: "Home", target: { kind: "home" }, children: [] },
    { id: "shop", label: "Shop all", target: { kind: "search" }, children: [{ id: "new", label: "New arrivals", target: { kind: "search" }, children: [] }] },
    { id: "about", label: "About", target: { kind: "home" }, children: [] },
  ] },
};

export function BaselineSections({ group, config, seed, themeId, legacyOff = true }: { group: BaselineGroup; config: ThemePreviewConfig; seed?: number; themeId?: string; legacyOff?: boolean }) {
  const productPage = useProductContext(config);
  const cartPage = useCartContext(config);
  const pages = previewPages(config, productPage, cartPage);
  const page: StorefrontPageContext = pages[group as PreviewTemplate];
  const cart = usePreviewCart();
  const products = withPreviewQuickAdd(config.products);
  const commerce: CommerceDataProvider = { initialProducts: products, cart, ratings: config.ratings, reviews: sampleReviews, async getProducts(input) { return products.slice(0, input?.limit ?? products.length); } };
  const photos = [config.product.media.map((item) => item.url), config.products.map((item) => item.imageUrl)].flat().filter(Boolean);
  const [entries] = useState(() => seed ? fuzzedBaselineSections(baselineSections(photos), seed, photos) : baselineSections(photos));
  const shown = entries.filter((entry) => entry.group === group);
  const render = (entry: BaselineEntry) => <div key={entry.section.id} data-baseline-section={entry.label}>
    <p style={{ margin: 0, padding: "4px 8px", font: "12px/1.4 ui-monospace, monospace", background: "#eef0f3", color: "#3b4250" }}>{entry.label}</p>
    <SectionGuard label={entry.label}><RegistrySectionRenderer section={entry.section} mode="preview" commerce={commerce} region={entry.region} page={page} menus={menus} storeSlug="baseline" themeId={themeId} /></SectionGuard>
  </div>;
  // Old default storefront rules (globals.css) are off, as for every new theme: only the platform layer applies.
  return <div className="jelly-storefront" data-jelly-legacy-styles={legacyOff ? "off" : undefined}>
    {shown.filter((entry) => entry.region === "header").map(render)}
    <main>{shown.filter((entry) => entry.region === "template").map(render)}</main>
    {shown.filter((entry) => entry.region === "footer").map(render)}
  </div>;
}

const widths = { desktop: 1280, tablet: 768, mobile: 390 } as const;
type Device = keyof typeof widths;
function subscribeNoop() { return () => {}; }

export function SectionBaselinePage() {
  const [device, setDevice] = useState<Device>("desktop");
  const [group, setGroup] = useState<BaselineGroup>("home");
  const [data, setData] = useState<"tidy" | "messy">("tidy");
  const ready = useSyncExternalStore(subscribeNoop, () => true, () => false);
  // ?theme=<preview path> draws the sections inside that theme; ?seed=<n> gives every section random valid settings.
  const [options, setOptions] = useState<{ theme?: string; seed?: number }>({});
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get("seed"));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the address after the page mounts
    setOptions({ theme: params.get("theme") ?? undefined, seed: Number.isInteger(seed) && seed > 0 ? seed : undefined });
  }, []);
  const themeEntry = options.theme ? themePreviewEntries().find((entry) => entry.path === options.theme) : undefined;
  const baseConfig = themeEntry?.config ?? jellyMinimalPreview;
  const config = data === "messy" ? messyPreviewConfig(baseConfig) : baseConfig;
  // Without a theme: shared token values only (the platform defaults); the root names no theme, so no theme CSS applies.
  const theme = resolveTheme(baseConfig.themeId);
  const style = resolveStorefrontThemeTokens(theme.id, theme.settings) as CSSProperties;
  const toggle = (active: boolean): CSSProperties => ({ padding: "6px 12px", borderRadius: 6, fontSize: 13, background: active ? "#1c1b19" : "transparent", color: active ? "white" : "#1c1b19" });
  return <main style={{ minHeight: "100vh", background: "#e4e6ea", padding: 16, display: "grid", gap: 16, gridTemplateRows: "auto 1fr" }}>
    <header style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <strong style={{ fontSize: 14 }}>Section baseline · {themeEntry ? themeEntry.config.name : "platform styles only, no theme"}{options.seed ? ` · random settings, seed ${options.seed}` : ""}</strong>
      <div role="group" aria-label="Page" style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4, background: "white", borderRadius: 8 }}>
        {BASELINE_GROUPS.map(([key, label]) => <button key={key} type="button" aria-pressed={group === key} onClick={() => setGroup(key)} style={toggle(group === key)}>{label}</button>)}
      </div>
      <div role="group" aria-label="Sample data" style={{ display: "flex", gap: 4, padding: 4, background: "white", borderRadius: 8 }}>
        {([["tidy", "Tidy data"], ["messy", "Messy data"]] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={data === key} onClick={() => setData(key)} style={toggle(data === key)}>{label}</button>)}
      </div>
      <div role="group" aria-label="Preview width" style={{ display: "flex", gap: 4, padding: 4, background: "white", borderRadius: 8 }}>
        {(Object.keys(widths) as Device[]).map((key) => <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)} style={toggle(device === key)}>{key[0].toUpperCase() + key.slice(1)} · {widths[key]}px</button>)}
      </div>
    </header>
    <div style={{ width: widths[device], maxWidth: "100%", margin: "0 auto", minHeight: "80vh", background: "white" }}>
      {ready && <StorefrontPreviewFrame key={themeEntry?.path ?? "platform"} title="Section baseline" themeId={themeEntry ? baseConfig.themeId : BASELINE_THEME_ATTRIBUTE} style={style} className="block h-[80vh] w-full border-0">
        <BaselineSections key={`${group}:${data}:${options.seed ?? 0}`} group={group} config={config} seed={options.seed} themeId={themeEntry ? baseConfig.themeId : undefined} legacyOff={!themeEntry} />
      </StorefrontPreviewFrame>}
    </div>
  </main>;
}
