import type { RegionName } from "@jelly/storefront-registry";
import type { EditorCommand } from "../model/types";

export type DragTreeItem =
  | { kind: "section"; region: RegionName; id: string }
  | { kind: "block"; region: RegionName; sectionId: string; id: string };

export function dragReorderCommand(active: DragTreeItem, over: DragTreeItem, orderedIds: string[]): EditorCommand | null {
  const toIndex = orderedIds.indexOf(over.id);
  if (toIndex < 0 || active.kind !== over.kind || active.region !== over.region) return null;
  if (active.kind === "section" && over.kind === "section") {
    return { type: "move-section", region: active.region, sectionId: active.id, toIndex };
  }
  if (active.kind === "block" && over.kind === "block" && active.sectionId === over.sectionId) {
    return { type: "move-block", region: active.region, sectionId: active.sectionId, blockId: active.id, toIndex };
  }
  return null;
}
