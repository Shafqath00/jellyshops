import type { SectionNode } from "@jelly/storefront-schema";

export interface StoreIdentity {
  name: string;
  logoUrl?: string;
  /** Theme-level header defaults (for example header.sticky); section settings win over them. */
  headerSettings?: Record<string, unknown>;
}

/**
 * Fills the header and footer with the store's own name and logo when the
 * merchant has not set them on the section. The editor preview and the
 * published storefront both use this, so they show the same chrome.
 */
export function withStoreIdentity(section: SectionNode, store: StoreIdentity): SectionNode {
  const name = typeof section.settings.storeName === "string" && section.settings.storeName.trim() ? section.settings.storeName : store.name;
  if (section.type === "header") {
    const logo = section.settings.logo ?? (store.logoUrl ? { url: store.logoUrl, alt: store.name } : undefined);
    return { ...section, settings: { ...store.headerSettings, ...section.settings, storeName: name, ...(logo ? { logo } : {}) } };
  }
  if (section.type === "footer") return { ...section, settings: { ...section.settings, storeName: name } };
  return section;
}
