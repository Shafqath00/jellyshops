import { PREFERENCE_LIMITS } from "@jelly/storefront-schema";

/** Rules for the bulk SEO editor: one row per product, page or post, with the search title and description. */
export type BulkKind = "product" | "page" | "post";
export interface BulkRow {
  key: string;
  kind: BulkKind;
  id: string;
  name: string;
  /** Shown as the title when the search title is empty (the item's own name). */
  fallbackTitle: string;
  /** Where the description comes from when none is written ("the start of the product description"). */
  fallbackDescription: string;
  seoTitle: string;
  seoDescription: string;
  status: string;
}
export interface BulkEdit { seoTitle: string; seoDescription: string }

export const TITLE_MAX = PREFERENCE_LIMITS.homeTitle;
export const DESCRIPTION_MAX = PREFERENCE_LIMITS.homeDescription;

/** What is wrong with a row's text, for the message under the row. Over-long text blocks saving. */
export function bulkProblems(value: BulkEdit): { title?: string; description?: string } {
  const problems: { title?: string; description?: string } = {};
  if (value.seoTitle.length > TITLE_MAX) problems.title = `${value.seoTitle.length - TITLE_MAX} too many characters. Keep it to ${TITLE_MAX}.`;
  if (value.seoDescription.length > DESCRIPTION_MAX) problems.description = `${value.seoDescription.length - DESCRIPTION_MAX} too many characters. Keep it to ${DESCRIPTION_MAX}.`;
  if (/[<>]/.test(value.seoTitle)) problems.title = "Remove the < and > characters.";
  if (/[<>]/.test(value.seoDescription)) problems.description = "Remove the < and > characters.";
  return problems;
}

/** Whether a row needs attention even before any edit: no description, or one that is too long. */
export function needsWork(row: Pick<BulkRow, "seoDescription" | "seoTitle" | "fallbackDescription">): boolean {
  return (!row.seoDescription.trim() && !row.fallbackDescription.trim()) || row.seoDescription.length > DESCRIPTION_MAX || row.seoTitle.length > TITLE_MAX;
}

/** The values to show for a row: the owner's edit if there is one, else what is saved. */
export function currentValue(row: BulkRow, edits: Map<string, BulkEdit>): BulkEdit {
  return edits.get(row.key) ?? { seoTitle: row.seoTitle, seoDescription: row.seoDescription };
}

/** Records an edit, or forgets it when the text goes back to what is saved. */
export function withEdit(edits: Map<string, BulkEdit>, row: BulkRow, patch: Partial<BulkEdit>): Map<string, BulkEdit> {
  const next = new Map(edits);
  const value = { ...currentValue(row, edits), ...patch };
  if (value.seoTitle === row.seoTitle && value.seoDescription === row.seoDescription) next.delete(row.key); else next.set(row.key, value);
  return next;
}

/** The text sent to the server: trimmed, and empty means "clear it". */
export function toPatch(value: BulkEdit): { seoTitle: string | null; seoDescription: string | null } {
  return { seoTitle: value.seoTitle.trim() || null, seoDescription: value.seoDescription.trim() || null };
}

export const plainStart = (text: string, length = 160) => {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length - 1).trimEnd()}…` : clean;
};
