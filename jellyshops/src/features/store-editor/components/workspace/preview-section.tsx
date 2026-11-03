"use client";

import { memo } from "react";
import { RegistrySectionRenderer, withStoreIdentity, type CommerceDataProvider, type StorefrontPageContext, type StoreIdentity } from "@jelly/storefront-renderer";
import type { RendererSelection } from "@jelly/storefront-renderer";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";

/** Everything the preview sections share. Keep it stable between renders (useMemo) so unchanged sections skip rendering. */
export interface PreviewShared {
  mode: "editor" | "preview";
  commerce: CommerceDataProvider;
  themeId?: string;
  themeVersion?: string;
  page?: StorefrontPageContext;
  language: string | null;
  menus: Record<string, RuntimeMenuV4>;
  collectionLinks: Record<string, string>;
  resourceLinks: Record<string, string>;
  storeSlug?: string;
  identity: StoreIdentity;
}

type PreviewSectionProps = {
  section: SectionNode;
  /** The section's content as text; the section re-renders only when this, the selection or the shared inputs change. */
  contentKey: string;
  region: "header" | "template" | "footer";
  shared: PreviewShared;
  /** The selection, only for the section it points into (others get undefined). */
  selected?: RendererSelection;
  /** Called with what was clicked in the preview; the latest handler is used even though this function never changes. */
  onSelect?(next: RendererSelection, region: "header" | "template" | "footer"): void;
};

const selectionKey = (selected: RendererSelection | undefined) => selected ? `${selected.kind}:${selected.sectionId ?? ""}:${selected.blockId ?? ""}:${selected.fieldKey ?? ""}` : "";

/**
 * One section of the preview. It re-renders only when its own content, its selection or the
 * shared inputs change, so editing one setting in a long page does not redraw every section.
 */
export const PreviewSection = memo(function PreviewSection({ section, region, shared, selected, onSelect }: PreviewSectionProps) {
  return (
    <RegistrySectionRenderer
      section={withStoreIdentity(section, shared.identity)}
      mode={shared.mode}
      commerce={shared.commerce}
      region={region}
      themeId={shared.themeId}
      themeVersion={shared.themeVersion}
      page={shared.page}
      language={shared.language}
      menus={shared.menus}
      collectionLinks={shared.collectionLinks}
      resourceLinks={shared.resourceLinks}
      storeSlug={shared.storeSlug}
      selected={selected}
      onSelect={onSelect ? (next) => onSelect(next, region) : undefined}
    />
  );
}, (previous, next) =>
  previous.contentKey === next.contentKey
  && previous.region === next.region
  && previous.shared === next.shared
  && selectionKey(previous.selected) === selectionKey(next.selected)
  // Whether clicks are handled can change (preview inspector on or off); the handler itself never does.
  && Boolean(previous.onSelect) === Boolean(next.onSelect));
