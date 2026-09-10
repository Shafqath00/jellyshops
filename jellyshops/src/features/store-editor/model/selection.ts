import type { StorefrontDocument } from "@jelly/storefront-schema";
import type { EditorSelection } from "./types";

export function reconcileSelection(document: StorefrontDocument, selection: EditorSelection): EditorSelection {
  if (!selection || selection.kind === "theme") return selection;
  const section = document.regions[selection.region].find(({ id }) => id === selection.sectionId);
  if (!section) return null;
  if (selection.kind === "block" && !section.blocks.some(({ id }) => id === selection.blockId)) {
    return { kind: "section", region: selection.region, sectionId: selection.sectionId };
  }
  return selection;
}
