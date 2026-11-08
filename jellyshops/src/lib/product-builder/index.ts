// The rules live in @jelly/storefront-schema so the API, storefront and builder cannot drift apart.
export {
  MAX_VARIANTS,
  MAX_VARIANT_AXES,
  dropHiddenSelections,
  findConditionProblems,
  getVisibleOptions,
  selectionKey,
  toggleSelection,
  validateProductDraft,
  validateProductOptions,
  validateProductSelections,
  validateVariantCombinations,
} from "@jelly/storefront-schema";
export type { ConditionProblem, DraftIssue, ProductDraftInput, SelectionProblem } from "@jelly/storefront-schema";
