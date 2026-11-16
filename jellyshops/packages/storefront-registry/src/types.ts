import type { BlockNode, DynamicValueType, PageType, SectionNode } from "@jelly/storefront-schema";
export type { PageType };
import type { ZodType } from "zod";

export type ControlGroup = "content" | "layout" | "style" | "advanced";
export type PresetCategory = "banners" | "products" | "content" | "marketing";
/** A small layout sketch the editor draws for a preset in Add section. */
export type PresetThumbnail = "split" | "split-reverse" | "overlay" | "centered" | "grid-3" | "grid-4" | "bento" | "carousel" | "tabs" | "columns-3" | "columns-4";
/**
 * A designed variant of a section ("Collection list: Bento"): the section type plus the settings and blocks that
 * make the design. Settings are merged over the section's defaults; blocks replace its default blocks.
 */
export interface SectionPreset {
  id: string;
  label: string;
  category: PresetCategory;
  sectionType: string;
  description?: string;
  thumbnail?: PresetThumbnail;
  settings?: Record<string, unknown>;
  blocks?: BlockNode[];
}
/** A rule on another setting's value; exactly one of `equals`, `oneOf`, `notEquals` is given. */
export interface ControlCondition { key: string; equals?: unknown; oneOf?: unknown[]; notEquals?: unknown }
interface ControlBase {
  key: string;
  label: string;
  description?: string;
  /** Sub-heading the editor shows above this control (e.g. "Padding"), like Shopify's setting groups. */
  heading?: string;
  /** Shows the control only while another setting has this value. */
  showWhen?: { key: string; equals: unknown };
  /**
   * Shows the control only while another setting matches (Shopify's `visible_if`): `equals` one value, `oneOf`
   * several, or `notEquals` one. Use instead of `showWhen` in new definitions; `controlConditionMet` reads both.
   */
  visibleIf?: ControlCondition;
  /**
   * What the editor shows when the section has no saved value for this setting. The renderer must use the same
   * default (e.g. a checkbox that is on unless the merchant turned it off), so sections saved before the setting
   * existed look the same in the editor and on the store.
   */
  defaultValue?: unknown;
  /**
   * An older setting kept so saved stores render the same: the editor shows it only while the section still has a
   * value other than the first option, so new sections never offer it.
   */
  legacy?: boolean;
  /** With `showWhen`: also shown while the setting itself holds a saved value, so older saved values stay editable. */
  visibleWhenSaved?: boolean;
  group: ControlGroup;
  responsive?: boolean;
  /** Has a separate phone value (saved under `responsive.mobile`, screens up to 767px) and tablet value (`responsive.tablet`, 768-1023px). */
  mobile?: boolean;
  /** false for text that must not change per language (links, handles, code). */
  translatable?: boolean;
  dynamicTypes?: DynamicValueType[];
  /** Belongs to one element of the section (its own style settings): shown only when that element is selected. */
  element?: string;
}
export type ControlDefinition =
  | (ControlBase & { type: "text" | "textarea" | "rich-text"; maxLength: number; /** One line of formatted text (headings): no paragraphs or lists. */ inline?: boolean })
  | (ControlBase & { type: "number" | "range"; min: number; max: number; step: number; unit?: string })
  | (ControlBase & { type: "select" | "segmented"; options: Array<{ label: string; value: string }> })
  | (ControlBase & { type: "checkbox" })
  | (ControlBase & { type: "color"; allowAlpha: boolean })
  | (ControlBase & { type: "font"; role: "heading" | "body" })
  | (ControlBase & { type: "spacing"; min: number; max: number })
  | (ControlBase & { type: "link" | "image" | "product" | "collection" });
/** Where a section may sit in the editor today: the page template, or the header or footer area. */
export type RegionName = "header" | "template" | "footer";
/**
 * The page template and the layout's section groups. `overlay` is the group for drawers and popups (cart drawer,
 * search, quick add); no section uses it yet (theme plan T6).
 */
export type SectionGroupName = RegionName | "overlay";
/**
 * A named set of block types (Shopify's `@theme` / `@app`): a section or group that accepts a set accepts every
 * block that lists the set in its `sets`, including blocks added later. `@content` = general content blocks
 * (heading, text, button, image, video, group), `@product` = blocks that need a product (product pages),
 * `@app` = app blocks.
 */
export type BlockSet = "@content" | "@product" | "@app";
/** A block type, or a set of them, in an `allowedBlockTypes` list. */
export type AllowedBlockEntry = string;
/**
 * A part a section always draws and the merchant can't remove, move, duplicate or hide (Shopify's static blocks),
 * e.g. the photo and details columns of a product page. Identified by type: a section holds at most one block of
 * each static type. Its settings and child blocks are edited like any block's. Static blocks don't count toward
 * the section's block limits.
 */
export interface StaticBlockDefinition { type: string; label?: string }
/**
 * Where a section can be added. `pages` lists page types ("*" = every page type); `groups` lists the template and
 * the section groups. `enabledOn` and `disabledOn` are the newer way to say what `supportedPages` and
 * `allowedRegions` say; when given they decide both.
 */
export interface SectionPlacement { pages?: Array<PageType | "*">; groups?: SectionGroupName[] }
/** What a selectable part of a section is; decides which style settings it gets. */
/** `group` is a cluster of settings with no style of its own (the logo, the shopping icons). */
export type ElementKind = "heading" | "text" | "button" | "link" | "image" | "product-card" | "group";
/**
 * A part of a section drawn from section settings (a heading, an image, a "View all" link, the product cards)
 * that the editor can select on its own. `controls` are the section setting keys the element owns.
 */
export interface ElementDefinition {
  id: string;
  label: string;
  kind: ElementKind;
  controls: string[];
}
export interface BlockDefinition {
  type: string;
  settingsSchema: ZodType;
  controls: ControlDefinition[];
  defaultSettings: Record<string, unknown>;
  /** Blocks that may sit inside this one (a group): block types and/or sets such as "@content". Blocks without it hold no children. */
  allowedBlockTypes?: AllowedBlockEntry[];
  maxBlocks?: number;
  defaultBlocks?: BlockNode[];
  /** Parts of the block the editor can select on their own (section-elements.ts adds the built-in ones). */
  elements?: ElementDefinition[];
  /** The block sets this block belongs to, so sections and groups that accept a set accept it. */
  sets?: BlockSet[];
  /** A help page for the editor's "Read how-to" link: a site path ("/help/…") or an https address. */
  helpUrl?: string;
}
export interface SectionDefinition {
  type: string;
  category: "layout" | "content" | "commerce";
  supportedPages: PageType[];
  settingsSchema: ZodType;
  controls: ControlDefinition[];
  /** Block types and/or sets ("@content", "@app") the section takes. After registration it lists types only. */
  allowedBlockTypes: AllowedBlockEntry[];
  /** The block sets the section was declared with (kept after `allowedBlockTypes` is expanded to types). */
  blockSets?: BlockSet[];
  minBlocks?: number;
  maxBlocks?: number;
  defaultSettings: Record<string, unknown>;
  defaultBlocks: BlockNode[];
  responsiveFields: string[];
  allowedRegions?: RegionName[];
  /** Every group the section may sit in, overlay included (set by the registry from the placement). */
  groups?: SectionGroupName[];
  /** Where the section can be added, by page type and group. Replaces `supportedPages`/`allowedRegions` when given. */
  enabledOn?: SectionPlacement;
  /** Where the section can't be added; everything else is allowed. Not used together with `enabledOn`. */
  disabledOn?: SectionPlacement;
  /** Most copies of this section one template or group may hold (Shopify's `limit`). */
  limit?: 1 | 2;
  /** Parts the section always draws (see StaticBlockDefinition). */
  staticBlocks?: StaticBlockDefinition[];
  /** A help page for the editor's "Read how-to" link: a site path ("/help/…") or an https address. */
  helpUrl?: string;
  /** Theme ids this section is limited to. Left out, every theme may use it (all built-in sections). */
  themes?: string[];
  /** Name shown in the editor (sections added from outside the core set; built-in names live in labels.ts). */
  label?: string;
  presets?: Array<Omit<SectionPreset, "sectionType">>;
  /** Parts of the section the editor can select on their own (section-elements.ts adds the built-in ones). */
  elements?: ElementDefinition[];
}
export type RegistryValidationIssueCode = "SECTION_NOT_REGISTERED" | "SECTION_NOT_ALLOWED_ON_PAGE" | "SECTION_NOT_AVAILABLE_ON_THEME" | "BLOCK_NOT_ALLOWED" | "BLOCK_LIMIT_EXCEEDED" | "SETTINGS_INVALID" | "RESPONSIVE_FIELD_NOT_ALLOWED" | "STATIC_BLOCK_REPEATED";
export interface RegistryValidationIssue { code: RegistryValidationIssueCode; sectionId: string; blockId?: string; field?: string; message: string }
export type { SectionNode };
