/**
 * `@jelly/storefront-registry/runtime`: what store pages need while drawing sections, without zod or the section
 * definitions. Editor, backend and tests use the main entry, which also plugs the full definitions in here.
 */
export { BLOCK_ELEMENTS, ELEMENT_ALIGNMENTS, ELEMENT_WEIGHTS, elementStyleKey, elementStyleProps, SECTION_ELEMENTS, type ElementStyleProp } from "./element-data.js";
export { PART_BLOCK_PREFIX, PRODUCT_PART_SECTIONS, partBlockType, partSectionType, type ProductPartSection } from "./parts.js";
export { blockLabel, pageTypeLabel, sectionLabel } from "./labels.js";
export { SECTION_DATA_NEEDS, sectionEmptyMessage } from "./section-data.js";
export { blockControlTypes, blockElementList, runtimeSectionTypes, sectionControlTypes, sectionDisplayLabel, sectionElementList, setRuntimeSectionControlTypes } from "./runtime-lookup.js";
export type { ElementDefinition, ElementKind } from "./types.js";
