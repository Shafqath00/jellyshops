import type { BlockNode, DynamicValueType, PageType, SectionNode } from "@jelly/storefront-schema";
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
interface ControlBase {
  key: string;
  label: string;
  description?: string;
  /** Sub-heading the editor shows above this control (e.g. "Padding"), like Shopify's setting groups. */
  heading?: string;
  /** Shows the control only while another setting has this value. */
  showWhen?: { key: string; equals: unknown };
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
export type RegionName = "header" | "template" | "footer";
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
  /** Blocks that may sit inside this one (a group). Blocks without it hold no children. */
  allowedBlockTypes?: string[];
  maxBlocks?: number;
  defaultBlocks?: BlockNode[];
  /** Parts of the block the editor can select on their own (section-elements.ts adds the built-in ones). */
  elements?: ElementDefinition[];
}
export interface SectionDefinition {
  type: string;
  category: "layout" | "content" | "commerce";
  supportedPages: PageType[];
  settingsSchema: ZodType;
  controls: ControlDefinition[];
  allowedBlockTypes: string[];
  minBlocks?: number;
  maxBlocks?: number;
  defaultSettings: Record<string, unknown>;
  defaultBlocks: BlockNode[];
  responsiveFields: string[];
  allowedRegions?: RegionName[];
  /** Theme ids this section is limited to. Left out, every theme may use it (all built-in sections). */
  themes?: string[];
  /** Name shown in the editor (sections added from outside the core set; built-in names live in labels.ts). */
  label?: string;
  presets?: Array<Omit<SectionPreset, "sectionType">>;
  /** Parts of the section the editor can select on their own (section-elements.ts adds the built-in ones). */
  elements?: ElementDefinition[];
}
export type RegistryValidationIssueCode = "SECTION_NOT_REGISTERED" | "SECTION_NOT_ALLOWED_ON_PAGE" | "SECTION_NOT_AVAILABLE_ON_THEME" | "BLOCK_NOT_ALLOWED" | "BLOCK_LIMIT_EXCEEDED" | "SETTINGS_INVALID" | "RESPONSIVE_FIELD_NOT_ALLOWED";
export interface RegistryValidationIssue { code: RegistryValidationIssueCode; sectionId: string; blockId?: string; field?: string; message: string }
export type { SectionNode };
