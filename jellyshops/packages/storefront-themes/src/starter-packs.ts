import { getV4StarterPack, isV4StarterPackId, listV4StarterPacks, validateV4StarterPack, type V4StarterPack } from "@jelly/storefront-registry";
import { discoveredThemes } from "./themes/index.generated.js";
import { isManuallyRegistered, registerFolderTheme, setFolderThemeComplete } from "./theme-registry.js";
import type { SectionNode } from "@jelly/storefront-schema";
import type { DiscoveredTheme } from "./types.js";
import { compareThemeVersions } from "@jelly/storefront-schema";

const TEMPLATE_NAMES: Record<string, string> = { home: "Home page", product: "Product page", collection: "Collection page", cart: "Cart", search: "Search", page: "Information page", "not-found": "Page not found" };
const GLOBAL_NAMES = { announcement: "Announcement bar", header: "Header", footer: "Footer" } as const;

/** Turns a theme folder (theme.json + starter.json) into the pack a new store installs. */
const node = (id: string, type: string): SectionNode => ({ id, type, enabled: true, settings: {}, blocks: [] });

export function createStarterPack({ manifest, starter }: DiscoveredTheme): V4StarterPack | null {
  if (!starter) return null;
  // Placements name a shared section by its key (announcement, header, footer); packs refer to its id.
  const idOf = (key: string) => starter.globalSections[key]?.id ?? key;
  const templates = Object.entries(starter.templates).map(([key, template]) => ({
    key, type: template.type, handle: "default" as const, name: TEMPLATE_NAMES[key] ?? key,
    layout: { sections: template.sections.map((placement) => placement.kind === "global" ? { kind: "global" as const, globalSectionId: idOf(placement.globalSectionId) } : placement) },
  }));
  const frame = ["announcement", "header", "footer"].filter((key) => starter.globalSections[key]);
  const around = (middle: SectionNode[]) => [
    ...frame.filter((key) => key !== "footer").map((key) => ({ kind: "global" as const, globalSectionId: idOf(key) })),
    ...middle.map((section) => ({ kind: "inline" as const, section })),
    ...frame.filter((key) => key === "footer").map((key) => ({ kind: "global" as const, globalSectionId: idOf(key) })),
  ];
  // Blog pages are required for every pack; a theme that does not design them gets the plain ones.
  if (!templates.some((template) => template.type === "blog")) templates.push({ key: "blog", type: "blog", handle: "default", name: "Blog", layout: { sections: around([node(`${manifest.id}-blog-header`, "blog-header"), node(`${manifest.id}-article-list`, "article-list")]) } });
  if (!templates.some((template) => template.type === "article")) templates.push({ key: "article", type: "article", handle: "default", name: "Article", layout: { sections: around([node(`${manifest.id}-article-header`, "article-header"), node(`${manifest.id}-article-content`, "article-content")]) } });
  const preview = manifest.assets?.preview?.path ?? manifest.previewAsset ?? "";
  return {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description ?? manifest.name,
    summary: manifest.description ?? manifest.name,
    tags: [],
    previewAsset: preview,
    theme: { themeId: manifest.id, settings: {} },
    globalSections: (Object.keys(GLOBAL_NAMES) as Array<keyof typeof GLOBAL_NAMES>)
      .filter((key) => starter.globalSections[key])
      .map((key) => ({ key, name: GLOBAL_NAMES[key], section: starter.globalSections[key] })),
    menus: starter.menus ? structuredClone(starter.menus) : [{ key: "main", name: "Main menu", handle: "main", items: [
      { id: `${manifest.id}-menu-home`, label: "Home", target: { kind: "home" }, children: [] },
      { id: `${manifest.id}-menu-search`, label: "Search", target: { kind: "search" }, children: [] },
    ] }],
    templates,
    resourceReferences: [],
  };
}

/** A pack with its own header and footer draws the whole store chrome itself. */
const hasOwnChrome = (pack: V4StarterPack | null): boolean => Boolean(pack && pack.globalSections.some((entry) => entry.key === "header") && pack.globalSections.some((entry) => entry.key === "footer"));

const discoveredPacks: V4StarterPack[] = discoveredThemes
  .filter((entry) => !isManuallyRegistered(entry.manifest.id))
  .map(createStarterPack)
  .filter((pack): pack is V4StarterPack => pack !== null);

for (const pack of discoveredPacks) setFolderThemeComplete(pack.id, hasOwnChrome(pack), pack.version);

/** Ids of starter packs that come from theme folders (not the built-in ones). */
export const DISCOVERED_STARTER_PACK_IDS: string[] = discoveredPacks.map((pack) => pack.id);

export function listStarterPacks(): V4StarterPack[] {
  const newest = new Map<string, V4StarterPack>();
  for (const pack of discoveredPacks) if (!newest.has(pack.id) || compareThemeVersions(pack.version, newest.get(pack.id)!.version) >= 0) newest.set(pack.id, pack);
  return [...listV4StarterPacks(), ...structuredClone([...newest.values()])];
}
export function isStarterPackId(value: unknown): value is string {
  return isV4StarterPackId(value) || (typeof value === "string" && DISCOVERED_STARTER_PACK_IDS.includes(value));
}
export function getStarterPack(id: string, version?: string | null): V4StarterPack {
  const pack = isV4StarterPackId(id) ? getV4StarterPack(id) : version ? discoveredPacks.find((candidate) => candidate.id === id && candidate.version === version) : listStarterPacks().find((candidate) => candidate.id === id);
  if (pack && version && pack.version !== version) throw new Error(`Unknown starter pack: ${id}@${version}`);
  if (!pack) throw new Error(`Unknown starter pack: ${id}`);
  return structuredClone(pack);
}
/** Checks a pack the same way for built-in and discovered ones. */
export function validateStarterPack(value: unknown) {
  return validateV4StarterPack(value, DISCOVERED_STARTER_PACK_IDS);
}

/**
 * Registers a theme folder (theme.json + optional starter.json) at run time: the theme, and its
 * starter pack when it has one. Registering the same id again replaces it, so a dev server can
 * reload edits. Returns the pack (or null when the folder has no starter).
 */
export function registerThemeProject(source: DiscoveredTheme): V4StarterPack | null {
  const entry = structuredClone(source);
  registerFolderTheme(entry.manifest);
  const pack = createStarterPack(entry);
  setFolderThemeComplete(entry.manifest.id, hasOwnChrome(pack), entry.manifest.version);
  const index = discoveredPacks.findIndex((candidate) => candidate.id === entry.manifest.id && candidate.version === entry.manifest.version);
  if (!pack) {
    if (index !== -1) discoveredPacks.splice(index, 1);
    if (!discoveredPacks.some((candidate) => candidate.id === entry.manifest.id)) { const idIndex = DISCOVERED_STARTER_PACK_IDS.indexOf(entry.manifest.id); if (idIndex !== -1) DISCOVERED_STARTER_PACK_IDS.splice(idIndex, 1); }
    return null;
  }
  if (index === -1) { discoveredPacks.push(pack); if (!DISCOVERED_STARTER_PACK_IDS.includes(pack.id)) DISCOVERED_STARTER_PACK_IDS.push(pack.id); } else discoveredPacks[index] = pack;
  return structuredClone(pack);
}
