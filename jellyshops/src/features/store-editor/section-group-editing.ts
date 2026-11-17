import type { StorefrontSectionGroups } from "@jelly/storefront-schema";

export type EditableGroup = "header" | "footer";

/**
 * Where a new shared section goes in a group (theme plan T6): announcement bars above the header, anything else
 * below it; in the footer group, above the footer itself, as on Shopify themes.
 */
export function addToGroup(groups: StorefrontSectionGroups, group: EditableGroup, id: string, sectionType: string, typeOf: (id: string) => string | undefined): StorefrontSectionGroups {
  const list = groups[group].filter((entry) => entry !== id);
  const anchor = list.findIndex((entry) => typeOf(entry) === group);
  let at = list.length;
  if (group === "header" && anchor !== -1) at = sectionType === "announcement-bar" ? anchor : anchor + 1;
  if (group === "footer" && anchor !== -1) at = anchor;
  return { ...groups, [group]: [...list.slice(0, at), id, ...list.slice(at)] };
}

/** One step up or down inside its group; null when it can't move. */
export function moveInGroup(groups: StorefrontSectionGroups, group: EditableGroup, id: string, direction: "up" | "down"): StorefrontSectionGroups | null {
  const list = [...groups[group]];
  const from = list.indexOf(id);
  const to = from + (direction === "up" ? -1 : 1);
  if (from === -1 || to < 0 || to >= list.length) return null;
  [list[from], list[to]] = [list[to], list[from]];
  return { ...groups, [group]: list };
}

/** Takes a section out of its group. The header and footer themselves always stay. */
export function removeFromGroup(groups: StorefrontSectionGroups, group: EditableGroup, id: string, sectionType: string | undefined): StorefrontSectionGroups | null {
  if (sectionType === group || !groups[group].includes(id)) return null;
  return { ...groups, [group]: groups[group].filter((entry) => entry !== id) };
}
