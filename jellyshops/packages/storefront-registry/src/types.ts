import type { BlockNode, DynamicValueType, PageType, SectionNode } from "@jelly/storefront-schema";
import type { ZodType } from "zod";

export type ControlGroup = "content" | "layout" | "style" | "advanced";
export type PresetCategory = "banners" | "products" | "content" | "marketing";
export interface SectionPreset { id: string; label: string; category: PresetCategory; sectionType: string }
interface ControlBase {
  key: string;
  label: string;
  group: ControlGroup;
  responsive?: boolean;
  dynamicTypes?: DynamicValueType[];
}
export type ControlDefinition =
  | (ControlBase & { type: "text" | "textarea" | "rich-text"; maxLength: number })
  | (ControlBase & { type: "number" | "range"; min: number; max: number; step: number; unit?: string })
  | (ControlBase & { type: "select" | "segmented"; options: Array<{ label: string; value: string }> })
  | (ControlBase & { type: "checkbox" })
  | (ControlBase & { type: "color"; allowAlpha: boolean })
  | (ControlBase & { type: "font"; role: "heading" | "body" })
  | (ControlBase & { type: "spacing"; min: number; max: number })
  | (ControlBase & { type: "link" | "image" | "product" | "collection" });
export type RegionName = "header" | "template" | "footer";
export interface BlockDefinition { type: string; settingsSchema: ZodType; controls: ControlDefinition[]; defaultSettings: Record<string, unknown> }
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
