"use client";
import type { PageType } from "@jelly/storefront-schema";
import { RegistrySectionRenderer } from "@jelly/storefront-renderer";
import { useInitialStorefrontPublication } from "@/features/storefront/storefront-bootstrap";
import { expandRuntimeLayout } from "@/features/storefront/resource-loader";

/** Functional children are route-owned; theme configuration only controls supporting sections. */
export function ProtectedStorefrontPage({ type, storeSlug, children }: { type: PageType; storeSlug: string; children: React.ReactNode }) {
  const publication = useInitialStorefrontPublication();
  const snapshot = publication?.kind === "v4" ? publication.snapshot : null;
  const templateId = snapshot?.templateDefaults[type];
  const template = templateId ? snapshot?.templates[templateId] : null;
  const layout = snapshot && template ? expandRuntimeLayout(snapshot, template) : null;
  return <>
    {snapshot && layout?.template.map((section) => <RegistrySectionRenderer key={section.id} section={section} mode="published" commerce={{ getProducts: async () => [] }} themeId={snapshot.theme.id ?? snapshot.theme.presetId} storeSlug={storeSlug} menus={snapshot.menus} />)}
    <main className="signature-page">{children}</main>
  </>;
}
