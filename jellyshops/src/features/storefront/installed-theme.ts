import { registerThemeProject, type DiscoveredTheme } from "@jelly/storefront-themes";
import { rescopeCustomCss } from "@jelly/storefront-schema";

/**
 * A theme a developer uploaded (see backend `storefront/theme-packages`). A store's draft and
 * published snapshot point at it by version id (`artifactId`); before the page resolves the theme
 * it has to be known to the registry, in the server process and again in the browser.
 */
export interface InstalledTheme {
  versionId: string;
  themeId: string;
  version: string;
  /** The stylesheet, already limited to this theme by the platform. */
  css: string;
  manifest: DiscoveredTheme["manifest"];
  starter: DiscoveredTheme["starter"] | null;
}

const registered = new Set<string>();
const loaded = new Map<string, InstalledTheme>();

/** Makes the theme known to the registry (once per version in this process). */
export function registerInstalledTheme(theme: InstalledTheme): void {
  if (!registered.has(theme.versionId)) {
    registerThemeProject({ manifest: theme.manifest, ...(theme.starter ? { starter: theme.starter } : {}) });
    registered.add(theme.versionId);
  }
  loaded.set(theme.versionId, theme);
}

/** The stylesheet of a version loaded earlier ("" when unknown), for places that draw the theme without a provider. */
export function installedThemeCss(versionId: string | null | undefined): string {
  const theme = versionId ? loaded.get(versionId) : undefined;
  if (!theme) return "";
  const scope = `[data-jelly-theme="${theme.themeId}"]`;
  return rescopeCustomCss(theme.css, scope, `${scope}[data-jelly-theme-version="${theme.version}"]`, theme.css.length) ?? "";
}

/**
 * Fetches a version from the platform and registers it. Returns null when it cannot be loaded, in
 * which case the page falls back to the default theme like for any unavailable theme.
 */
export async function loadInstalledTheme(versionId: string | null | undefined, options: { baseUrl: string; fetch?: typeof fetch }): Promise<InstalledTheme | null> {
  if (!versionId) return null;
  const known = loaded.get(versionId);
  if (known) { registerInstalledTheme(known); return known; }
  try {
    const response = await (options.fetch ?? fetch)(`${options.baseUrl.replace(/\/$/, "")}/api/public/theme-versions/${encodeURIComponent(versionId)}`, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const { version } = await response.json() as { version?: { id: string; themeId: string; version: string; css: string; manifest: InstalledTheme["manifest"]; starter: InstalledTheme["starter"] } };
    if (!version?.manifest || version.id !== versionId || version.manifest.id !== version.themeId || version.manifest.version !== version.version) return null;
    const theme: InstalledTheme = { versionId, themeId: version.themeId, version: version.version, css: version.css ?? "", manifest: version.manifest, starter: version.starter ?? null };
    registerInstalledTheme(theme);
    return theme;
  } catch { return null; }
}
