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
