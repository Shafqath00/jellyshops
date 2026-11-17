import type { V4StarterPack } from "@jelly/storefront-registry";
import signature from "./jelly-signature.json" with { type: "json" };
import avenue from "./jelly-avenue.json" with { type: "json" };

/**
 * Earlier page layouts of the built-in themes, whose starters are made in code (`v4-starter-packs.ts`).
 * Before changing a built-in starter in a way stores should be offered, copy its current
 * `globalSections` and `templates` here as a new revision. Never edit an existing revision.
 */
export interface BuiltInLayoutHistory {
  revisions: Array<{ revision: number; label: string; globalSections: V4StarterPack["globalSections"]; templates: V4StarterPack["templates"] }>;
}

export const builtInLayoutHistory: Record<string, BuiltInLayoutHistory> = {
  "jelly-signature": signature as unknown as BuiltInLayoutHistory,
  "jelly-avenue": avenue as unknown as BuiltInLayoutHistory,
};
