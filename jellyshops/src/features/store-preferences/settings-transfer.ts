import { validateStorePreferences, type PreferenceProblem, type StorePreferences } from "@jelly/storefront-schema";

/**
 * Export and import of store preferences as a small JSON file, so a second store (or a backup) can start from the same
 * settings. Photos are never exported: a photo only exists in the store it was uploaded to, so the sharing image and
 * browser icon stay as they are in the store that imports.
 */
export const EXPORT_FORMAT = "jellyshop-store-preferences";
export const MAX_IMPORT_BYTES = 200_000;

export type SectionKey = "seo" | "business" | "social" | "policies" | "tracking" | "privacy" | "spam";
export const SECTION_LABELS: Record<SectionKey, string> = {
  seo: "Search and sharing (titles, description, visibility)", business: "Business details", social: "Social media links",
  policies: "Policy page choices", tracking: "Tracking IDs", privacy: "Cookie banner", spam: "Spam protection",
};
/** Things the owner should think about before copying them to another store. */
export const SECTION_WARNINGS: Partial<Record<SectionKey, string>> = {
  tracking: "These IDs belong to the store you exported from. Only copy them if both stores should report to the same account.",
  policies: "This only copies which page holds each policy. The pages themselves aren't copied, so choose or create them here.",
};
const SECTIONS = Object.keys(SECTION_LABELS) as SectionKey[];

export function exportFile(preferences: StorePreferences, now = new Date()): string {
  const withoutPhotos: StorePreferences = { ...preferences, seo: { ...preferences.seo, socialImage: null, favicon: null } };
  return `${JSON.stringify({ format: EXPORT_FORMAT, version: 1, exportedAt: now.toISOString(), preferences: withoutPhotos }, null, 2)}\n`;
}

export function exportFileName(storeSlug: string, now = new Date()): string {
  return `${storeSlug || "store"}-preferences-${now.toISOString().slice(0, 10)}.json`;
}

export type ParsedImport = { ok: true; preferences: StorePreferences } | { ok: false; message: string; problems: PreferenceProblem[] };

/** Reads an exported file. Everything is checked with the same strict rules as saving; nothing is fixed silently. */
export function parseImport(text: string): ParsedImport {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, message: "That file is too large to be a preferences export.", problems: [] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, message: "That isn't a preferences file. Choose a .json file you exported from Jellyshop.", problems: [] }; }
  const body = raw as { format?: unknown; preferences?: unknown } | null;
  if (!body || typeof body !== "object" || body.format !== EXPORT_FORMAT || typeof body.preferences !== "object" || body.preferences === null) {
    return { ok: false, message: "That file wasn't exported from Site preferences, so it can't be imported.", problems: [] };
  }
  const incoming = structuredClone(body.preferences) as { seo?: { socialImage?: unknown; favicon?: unknown } };
  if (incoming.seo && typeof incoming.seo === "object") { incoming.seo.socialImage = null; incoming.seo.favicon = null; }
  const checked = validateStorePreferences(incoming);
  if (!checked.ok) return { ok: false, message: "Some settings in the file aren't valid, so nothing was imported.", problems: checked.problems };
  return { ok: true, preferences: checked.value };
}

/** Which sections of `incoming` differ from `current` (photos are ignored: they are never imported). */
export function differingSections(current: StorePreferences, incoming: StorePreferences): SectionKey[] {
  const strip = (p: StorePreferences) => ({ ...p, seo: { ...p.seo, socialImage: null, favicon: null } });
  const a = strip(current), b = strip(incoming);
  return SECTIONS.filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]));
}

/** `current` with the chosen sections replaced; the store's own photos always stay. */
export function applySections(current: StorePreferences, incoming: StorePreferences, sections: SectionKey[]): StorePreferences {
  const next = structuredClone(current);
  for (const key of sections) {
    if (key === "seo") next.seo = { ...structuredClone(incoming.seo), socialImage: current.seo.socialImage, favicon: current.seo.favicon };
    else (next as unknown as Record<string, unknown>)[key] = structuredClone(incoming[key]);
  }
  return next;
}
