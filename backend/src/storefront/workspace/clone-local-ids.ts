import { randomUUID } from "node:crypto";
/** Refresh section/block identity while preserving resource and global references. */
export function cloneLocalIds(value: Record<string, unknown>, rootNode = false): Record<string, unknown> {
  function visit(input: unknown, node: boolean): unknown {
    if (Array.isArray(input)) return input.map((item) => visit(item, node));
    if (!input || typeof input !== "object") return input;
    const source = input as Record<string, unknown>;
    if (source.kind === "global" || typeof source.globalSectionId === "string") return structuredClone(source);
    return Object.fromEntries(Object.entries(source).map(([key, item]) => [key, key === "id" && node ? randomUUID() : ["settings", "responsive"].includes(key) ? structuredClone(item) : visit(item, ["section", "sections", "blocks", "children", "header", "footer", "template", "announcement"].includes(key))]));
  }
  return visit(value, rootNode) as Record<string, unknown>;
}
