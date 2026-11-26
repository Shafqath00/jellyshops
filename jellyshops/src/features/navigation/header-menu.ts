import type { GlobalSectionRecord, StorefrontTemplateRecord } from "@/features/store-editor/api/types";

/** Use the active default home header, not an unrelated saved header or menu name. */
export function referencedHeaderMenu(templates: StorefrontTemplateRecord[], globals: GlobalSectionRecord[]): string {
  const home = templates.find(template => template.type === "home" && template.handle === "default");
  const placements = home?.layout.sections;
  if (!Array.isArray(placements)) return "main";
  for (const placement of placements) {
    const section = placement.kind === "global" ? globals.find(global => global.id === placement.globalSectionId)?.section : placement.section;
    if (section?.type !== "header" || section.enabled === false || !Array.isArray(section.blocks)) continue;
    const block = section.blocks.find((block: { type: string; enabled?: boolean }) => block.type === "menu" && block.enabled !== false);
    if (typeof block?.settings?.handle === "string") return block.settings.handle;
  }
  return "main";
}

export type MenuPlacement = "header" | "footer";

/**
 * Where each menu shows on the live design: the header and footer of the default home page (and the shared header
 * and footer sections), found by their "menu" blocks. A menu missing from the result is not shown anywhere yet.
 */
export function menuPlacements(templates: StorefrontTemplateRecord[], globals: GlobalSectionRecord[]): Record<string, MenuPlacement[]> {
  const found: Record<string, MenuPlacement[]> = {};
  const note = (handle: string, place: MenuPlacement) => { const list = found[handle] ??= []; if (!list.includes(place)) list.push(place); };
  const home = templates.find(template => template.type === "home" && template.handle === "default");
  const placed = Array.isArray(home?.layout.sections) ? home!.layout.sections.map(placement => placement.kind === "global" ? globals.find(global => global.id === placement.globalSectionId)?.section : placement.section) : [];
  const sections = [...placed, ...globals.map(global => global.section)];
  for (const section of sections) {
    if (!section || section.enabled === false || (section.type !== "header" && section.type !== "footer") || !Array.isArray(section.blocks)) continue;
    for (const block of section.blocks as Array<{ type: string; enabled?: boolean; settings?: Record<string, unknown> }>) {
      if (block.type !== "menu" || block.enabled === false) continue;
      note(typeof block.settings?.handle === "string" && block.settings.handle ? block.settings.handle : "main", section.type);
    }
  }
  return found;
}
