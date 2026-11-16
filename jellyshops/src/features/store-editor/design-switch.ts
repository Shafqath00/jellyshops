import type { MenuRecord } from "./api/types";

/**
 * What a store keeps when it switches to another design. Products, collections, pages, orders and
 * customers never belong to a design. Installing a design replaces the draft's page layouts, theme
 * settings and menus, so the store's own logo, social links, languages and menus are read before the
 * switch and put back afterwards.
 */
export const CARRIED_SETTING_GROUPS = ["branding", "social", "languages"] as const;

type Settings = Record<string, unknown>;
const record = (value: unknown): Settings => value && typeof value === "object" && !Array.isArray(value) ? value as Settings : {};
const filled = (value: unknown) => value !== undefined && value !== null && !(typeof value === "string" && value.trim() === "");

/** The store's own values in the carried groups (empty values are left out, so the new design's defaults stay). */
export function carriedThemeSettings(settings: Settings | null | undefined): Settings {
  const carried: Settings = {};
  for (const group of CARRIED_SETTING_GROUPS) {
    const values = Object.fromEntries(Object.entries(record(settings?.[group])).filter(([, value]) => filled(value)));
    if (Object.keys(values).length) carried[group] = values;
  }
  return carried;
}

/** The new design's settings with the store's own carried values on top. */
export function withCarriedSettings(settings: Settings, carried: Settings): Settings {
  const next: Settings = { ...settings };
  for (const [group, values] of Object.entries(carried)) next[group] = { ...record(settings[group]), ...record(values) };
  return next;
}

/** Menus kept from before an earlier switch are renamed "previous-…"; they are not the store's current menus. */
export function isCurrentMenu(menu: Pick<MenuRecord, "handle">): boolean {
  return !menu.handle.startsWith("previous-");
}

/** Menu links without their ids (installing a design gives every link a new id). */
function linksOnly(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(linksOnly);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id").map(([key, item]) => [key, linksOnly(item)]));
  return value;
}
const sameLinks = (a: unknown[], b: unknown[]) => JSON.stringify(linksOnly(a)) === JSON.stringify(linksOnly(b));

/**
 * The new design's menus that take back the store's own links: those with the same handle (main, footer…)
 * as a current menu the merchant changed. A menu still exactly as the previous design shipped it
 * (`previousStarterMenus`) is the old design's sample, not the store's content, so the new design keeps its own.
 */
export function menusToRestore(before: MenuRecord[], after: MenuRecord[], previousStarterMenus: Array<{ handle: string; items: unknown[] }> = []): Array<{ menu: MenuRecord; items: unknown[] }> {
  const own = new Map(before.filter(isCurrentMenu).map((menu) => [menu.handle, menu]));
  const shipped = new Map(previousStarterMenus.map((menu) => [menu.handle, menu.items]));
  return after.filter(isCurrentMenu).flatMap((menu) => {
    const previous = own.get(menu.handle);
    if (!previous?.items.length || sameLinks(previous.items, menu.items)) return [];
    const sample = shipped.get(menu.handle);
    if (sample && sameLinks(previous.items, sample)) return [];
    return [{ menu, items: previous.items }];
  });
}
