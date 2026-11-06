"use client";

import clsx from "clsx";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { ThemeCustomCss, createCollectionLinks, type RendererSelection } from "@jelly/storefront-renderer";
import { installedThemeCss } from "@/features/storefront/installed-theme";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import { themeSocialLinks, themeStyleId } from "@jelly/storefront-themes";
import { createResourceLinks } from "@/features/navigation/resource-links";
import { ScaledPreview } from "@/features/store-editor/components/scaled-preview";
import { StorefrontPreviewFrame } from "@/features/store-editor/components/storefront-preview-frame";
import { PreviewSection, type PreviewShared } from "./preview-section";
import type { EditorViewContext } from "../../hooks/use-editor-controller";

/** The storefront preview in the middle of the editor. */
export function EditorPreviewPane({ ctx }: { ctx: EditorViewContext }) {
  const { activeStore, backendStoreId, menuRecords, catalog, pages, blogs, articles, themeConfiguration, selection, setSelection, setActiveGlobalId, viewport, mobilePanel, setMobilePanel, desktopSidebarOpen, setDesktopSidebarOpen, previewInspectorEnabled, previewSnapshot, invalidatePreview, previewThemeStyle, validGlobals, selectedGlobal, activeLanguage, previewLayout, previewPageContext, commerce } = ctx;
  const storeSlug = activeStore?.slug ?? "";
  const storeName = activeStore?.name ?? "Your store";
  const settings = themeConfiguration?.settings;

  // Inputs every section shares. Each is kept stable between renders, so a section only redraws
  // when its own content changes (see PreviewSection).
  const identity = useMemo(() => {
    const branding = settings as { branding?: { logoUrl?: string }; header?: Record<string, unknown> } | undefined;
    return { name: storeName, logoUrl: branding?.branding?.logoUrl || undefined, headerSettings: branding?.header, socialLinks: themeSocialLinks(settings) };
  }, [settings, storeName]);
  const menus = useMemo(() => previewSnapshot?.menus ?? Object.fromEntries(menuRecords.map((menu) => [menu.handle, { id: menu.id, handle: menu.handle, items: menu.items }])) as Record<string, RuntimeMenuV4>, [previewSnapshot, menuRecords]);
  const collectionLinks = useMemo(() => createCollectionLinks(backendStoreId, storeSlug, catalog.collections.map((item) => ({ ...item, storeId: backendStoreId }))), [backendStoreId, storeSlug, catalog.collections]);
  const resourceLinks = useMemo(() => createResourceLinks(storeSlug, [
    ...catalog.products.map((item) => ({ kind: "product" as const, id: item.id, handle: item.slug })),
    ...pages.map((item) => ({ kind: "page" as const, id: item.id, handle: item.handle })),
    ...blogs.map((item) => ({ kind: "blog" as const, id: item.id, handle: item.handle })),
    ...articles.map((item) => ({ kind: "article" as const, id: item.id, handle: item.handle, blogHandle: blogs.find((blog) => blog.id === item.blogId)?.handle })),
  ]), [storeSlug, catalog.products, pages, blogs, articles]);
  const mode = previewInspectorEnabled ? "editor" : "preview";
  const themeId = themeConfiguration?.themeId;
  const themeVersion = themeConfiguration?.themeVersion;
  const shared = useMemo<PreviewShared>(() => ({ mode, commerce, themeId, themeVersion, page: previewPageContext ?? undefined, language: activeLanguage, menus, collectionLinks, resourceLinks, storeSlug: activeStore?.slug, identity }),
    [mode, commerce, themeId, themeVersion, previewPageContext, activeLanguage, menus, collectionLinks, resourceLinks, activeStore?.slug, identity]);

  // Clicks in the preview. The handler is recreated on every render (it reads the latest state), so
  // sections get a function that never changes and calls the newest one.
  const handleSelect = (next: RendererSelection, region: "header" | "template" | "footer") => {
    setDesktopSidebarOpen(true);
    invalidatePreview();
    const global = validGlobals.find((item) => item.section.id === next.sectionId);
    if (global) {
      setActiveGlobalId(global.id);
      setSelection(next.kind === "block" && next.blockId ? { kind: "block", region: next.region ?? region, sectionId: next.sectionId!, blockId: next.blockId } : null);
      setMobilePanel("settings");
      return;
    }
    setActiveGlobalId(undefined);
    if (next.kind === "section" && next.sectionId) {
      setSelection({ kind: "section", region: next.region ?? region, sectionId: next.sectionId });
      setMobilePanel("settings");
    }
    if (next.kind === "block" && next.sectionId && next.blockId) {
      setSelection({ kind: "block", region: next.region ?? region, sectionId: next.sectionId, blockId: next.blockId, fieldKey: next.fieldKey });
      setMobilePanel("settings");
    }
  };
  const latestSelect = useRef(handleSelect);
  useLayoutEffect(() => { latestSelect.current = handleSelect; });
  const stableSelect = useCallback((next: RendererSelection, region: "header" | "template" | "footer") => latestSelect.current(next, region), []);

  // What is selected, as the renderer wants it; each section only gets it when it points into that section.
  const selected: RendererSelection | undefined = previewSnapshot || !previewInspectorEnabled ? undefined : selection ?? (typeof selectedGlobal?.section.id === "string" ? { kind: "section", region: "template", sectionId: selectedGlobal.section.id } : undefined);

  const renderPreviewSections = (items: SectionNode[], region: "header" | "template" | "footer") => items.map((section) => (
    <PreviewSection
      key={section.id}
      section={section}
      contentKey={JSON.stringify(section)}
      region={region}
      shared={shared}
      selected={selected && selected.kind !== "theme" && selected.sectionId === section.id ? selected : undefined}
      onSelect={previewInspectorEnabled ? stableSelect : undefined}
    />
  ));

  return (
        <main
          className={clsx(
            "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card",
            mobilePanel !== "preview" && "hidden lg:flex",
            desktopSidebarOpen
              ? "lg:col-start-2 lg:row-start-1"
              : "lg:col-start-1 lg:row-start-1",
          )}
          aria-label="Storefront preview"
        >
          {previewSnapshot && (
            <div className="mx-auto mb-3 max-w-[1440px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
              This is how your store will look when you publish. Change anything to keep editing.
            </div>
          )}

          <div className="mx-auto flex min-h-0 w-full flex-1 items-start justify-center">
            <div
              className={clsx(
                "h-full w-full overflow-hidden bg-[var(--white)] shadow-sm transition-[max-width] duration-200",
                viewport === "desktop" && "max-w-none",
                viewport === "tablet" && "max-w-[820px]",
                viewport === "mobile" && "max-w-[390px]",
              )}
              data-testid="preview-viewport"
              data-jelly-theme={themeStyleId(themeConfiguration?.themeId ?? "minimal", themeConfiguration?.themeVersion)}
              data-jelly-theme-version={themeVersion}
              data-viewport={viewport}
              data-preview-width={viewport === "desktop" ? 1440 : viewport === "tablet" ? 820 : 390}
              style={previewThemeStyle}
            >
              <ScaledPreview minWidth={viewport === "desktop" ? 1280 : viewport === "tablet" ? 820 : 390}>
              <StorefrontPreviewFrame title="Storefront preview" themeId={themeConfiguration?.themeId ?? "minimal"} themeVersion={themeVersion} style={previewThemeStyle} className="h-full w-full border-0 bg-card">
                <ThemeCustomCss settings={themeConfiguration?.settings} themeId={themeConfiguration?.themeId} themeVersion={themeVersion} />
                {installedThemeCss(themeConfiguration?.draftArtifactId) ? <style data-installed-theme={themeConfiguration?.draftArtifactId ?? undefined}>{installedThemeCss(themeConfiguration?.draftArtifactId)}</style> : null}
                {renderPreviewSections([...previewLayout.announcement, ...previewLayout.header], "header")}
                <div data-storefront-template>
                  {renderPreviewSections(previewLayout.template, "template")}
                  {previewLayout.template.length === 0 && (
                    <div className="grid min-h-[360px] place-items-center p-8 text-center text-sm text-[var(--ink-soft)]">
                      This template has no sections yet.
                    </div>
                  )}
                </div>
                {renderPreviewSections(previewLayout.footer, "footer")}
              </StorefrontPreviewFrame>
              </ScaledPreview>
            </div>
          </div>
        </main>
  );
}
