import type { BlockNode, SectionNode, StorefrontDocument, StorefrontPage } from "@jelly/storefront-schema";
import type { RegionName } from "@jelly/storefront-registry";

export type EditorSelection =
  | { kind: "theme" }
  /** With `elementId`: one part of the section drawn from its settings (a heading, an image, the product cards; section-elements.ts). */
  | { kind: "section"; region: RegionName; sectionId: string; elementId?: string; elementIndex?: number }
  /** With `elementId`: one part of the block (a column's heading, a collection card's image). */
  | { kind: "block"; region: RegionName; sectionId: string; blockId: string; fieldKey?: string; focusRequestId?: number; elementId?: string; elementIndex?: number }
  | null;

export type EditorCommand =
  | { type: "replace-document"; document: StorefrontDocument }
  | { type: "add-page"; page: StorefrontPage }
  | { type: "rename-page"; pageId: string; title: string; slug: string }
  | { type: "remove-page"; pageId: string }
  | { type: "update-theme-setting"; group: "colors" | "typography" | "buttons" | "layout" | "productCards"; key: string; value: unknown }
  | { type: "update-theme-preset"; presetId: StorefrontDocument["theme"]["presetId"] }
  | { type: "update-section-setting"; region: RegionName; pageId?: string; sectionId: string; key: string; value: unknown }
  | { type: "add-section"; region: RegionName; pageId?: string; section: SectionNode; toIndex: number }
  | { type: "remove-section"; region: RegionName; pageId?: string; sectionId: string }
  | { type: "duplicate-section"; region: RegionName; pageId?: string; sectionId: string; createId: () => string }
  | { type: "move-section"; region: RegionName; pageId?: string; sectionId: string; toIndex: number }
  | { type: "toggle-section"; region: RegionName; pageId?: string; sectionId: string }
  | { type: "update-block-setting"; region: RegionName; pageId?: string; sectionId: string; blockId: string; key: string; value: unknown }
  | { type: "add-block"; region: RegionName; pageId?: string; sectionId: string; block: BlockNode; toIndex: number }
  | { type: "remove-block"; region: RegionName; pageId?: string; sectionId: string; blockId: string }
  | { type: "duplicate-block"; region: RegionName; pageId?: string; sectionId: string; blockId: string; createId: () => string }
  | { type: "move-block"; region: RegionName; pageId?: string; sectionId: string; blockId: string; toIndex: number }
  | { type: "toggle-block"; region: RegionName; pageId?: string; sectionId: string; blockId: string };

export interface EditorHistory {
  past: StorefrontDocument[];
  present: StorefrontDocument;
  future: StorefrontDocument[];
}
