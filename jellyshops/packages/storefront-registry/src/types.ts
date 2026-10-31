import type { BlockNode, DynamicValueType, PageType, SectionNode } from "@jelly/storefront-schema";
import type { ZodType } from "zod";

export type ControlGroup = "content" | "layout" | "style" | "advanced";
export type PresetCategory = "banners" | "products" | "content" | "marketing";
export interface SectionPreset { id: string; label: string; category: PresetCategory; sectionType: string }
interface ControlBase {
  key: string;
  label: string;
  /** Sub-heading the editor shows above this control (e.g. "Padding"), like Shopify's setting groups. */
  heading?: string;
  /** Shows the control only while another setting has this value. */
  showWhen?: { key: string; equals: unknown };
  group: ControlGroup;
  responsive?: boolean;
  /** Has a separate phone value (saved under `responsive.mobile`) that the store shows on screens up to 767px wide. */
  mobile?: boolean;
  dynamicTypes?: DynamicValueType[];
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
export interface BlockDefinition {
  type: string;
  settingsSchema: ZodType;
  controls: ControlDefinition[];
  defaultSettings: Record<string, unknown>;
  /** Blocks that may sit inside this one (a group). Blocks without it hold no children. */
  allowedBlockTypes?: string[];
  maxBlocks?: number;
  defaultBlocks?: BlockNode[];
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
  presets?: Array<Omit<SectionPreset, "sectionType">>;
}
export type RegistryValidationIssueCode = "SECTION_NOT_REGISTERED" | "SECTION_NOT_ALLOWED_ON_PAGE" | "BLOCK_NOT_ALLOWED" | "BLOCK_LIMIT_EXCEEDED" | "SETTINGS_INVALID" | "RESPONSIVE_FIELD_NOT_ALLOWED";
export interface RegistryValidationIssue { code: RegistryValidationIssueCode; sectionId: string; blockId?: string; field?: string; message: string }
export type { SectionNode };
