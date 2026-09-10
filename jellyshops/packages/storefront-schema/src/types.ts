export type ThemeId = "minimal" | "classic" | "bold" | "elegant" | "playful";

export type PageType = "home" | "product" | "collection";

export interface GlobalSettings {
  colors: { primary: string; background: string; text: string; surface: string; accent: string };
  typography: { headingFont: string; bodyFont: string; headingScale: "compact" | "standard" | "large" };
  buttons: { style: "solid" | "outline"; radius: "square" | "soft" | "rounded" | "pill" };
  layout: { containerWidth: "narrow" | "standard" | "wide"; sectionSpacing: "compact" | "standard" | "spacious" };
  productCards: { imageRatio: "square" | "portrait" | "landscape"; showVendor: boolean; showQuickAdd: boolean };
}

export interface ResponsiveSettings {
  mobile?: Record<string, unknown>;
}

export interface BlockNode {
  id: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  responsive?: ResponsiveSettings;
}

export interface SectionNode {
  id: string;
  type: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  responsive?: ResponsiveSettings;
  blocks: BlockNode[];
}

export interface PageDocument {
  id: string;
  type: PageType;
  sections: SectionNode[];
}

export interface StoreDesignDocument {
  schemaVersion: 1;
  theme: { id: ThemeId; settings: Record<string, unknown> };
  globalSettings: GlobalSettings;
  header: SectionNode;
  pages: { home: PageDocument; product: PageDocument; collection: PageDocument };
  footer: SectionNode;
}
