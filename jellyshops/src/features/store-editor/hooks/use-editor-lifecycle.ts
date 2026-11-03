"use client";

/* eslint-disable react-hooks/exhaustive-deps --
   State setters and refs reach this hook through `ctx`, so the linter cannot see that they never
   change. Effects list only the values that should re-run them. */

import { useEffect } from "react";
import { loadInstalledTheme } from "@/features/storefront/installed-theme";
import { createRevisionedSaveQueue } from "@/features/store-editor/state/revisioned-save-queue";
import { pickInitialTemplate } from "@/features/store-editor/template-selection";
import { clearUnsaved, findRestorableWork, readUnsaved } from "@/features/store-editor/state/unsaved-work";
import type { useEditorState } from "./use-editor-state";

/** Effects that keep the editor in step with the browser and the server: panel sizes, preview scrolling, the save queue, leaving the page and loading the workspace. */
export function useEditorLifecycle(ctx: ReturnType<typeof useEditorState>) {
  const { router, backendStoreId, api, handoff, setWorkspace, setTemplates, setGlobals, setMenuRecords, setPresets, setCatalog, setPages, setBlogs, setArticles, setThemeCatalog, setThemeConfiguration, activeTemplateId, setActiveTemplateId, selection, activeGlobalId, viewport, setMobilePanel, setLoadError, libraryRegion, blockPickerSectionId, saveState, setSaveState, setSaveError, loadAttempt, previewSelectionKind, previewSelectionSectionId, previewSelectionBlockId, saveQueueRef, setRestorable, unsavedDecided } = ctx;
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const restoreDesktopPanel = () => {
      if (!desktop.matches) return;
      setMobilePanel(selection || activeGlobalId || libraryRegion || blockPickerSectionId ? "settings" : "sections");
    };
    desktop.addEventListener("change", restoreDesktopPanel);
    return () => desktop.removeEventListener("change", restoreDesktopPanel);
  }, [selection, activeGlobalId, libraryRegion, blockPickerSectionId]);

  useEffect(() => {
    if (!previewSelectionSectionId || previewSelectionKind === "theme") return;
    const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Storefront preview"]');
    const previewDocument = frame?.contentDocument;
    if (!previewDocument) return;
    const section = [...previewDocument.querySelectorAll<HTMLElement>("[data-editor-section-id]")]
      .find((item) => item.dataset.editorSectionId === previewSelectionSectionId);
    if (!section) return;
    const blockId = previewSelectionBlockId;
    const block = blockId
      ? [...section.querySelectorAll<HTMLElement>("[data-editor-block-id]")]
        .find((item) => item.dataset.editorBlockId === blockId && !item.parentElement?.closest("[data-editor-block-id]"))
        ?? [...section.querySelectorAll<HTMLElement>("[data-editor-block-id]")].find((item) => item.dataset.editorBlockId === blockId)
      : undefined;
    (block ?? section).scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [previewSelectionKind, previewSelectionSectionId, previewSelectionBlockId, activeTemplateId, viewport]);

  useEffect(() => {
    const queue = createRevisionedSaveQueue({
      onStatus: setSaveState,
      onError: (error) => setSaveError(error instanceof Error ? error.message : "Your changes could not be saved. Try again."),
    });
    saveQueueRef.current = queue;
    return () => { queue.dispose(); saveQueueRef.current?.dispose(); saveQueueRef.current = null; };
  }, [backendStoreId]);

  useEffect(() => {
    if (saveState === "saved" && unsavedDecided.current) clearUnsaved(backendStoreId);
  }, [saveState, backendStoreId]);

  useEffect(() => {
    if (saveState === "saved") return;
    const protectDraft = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [saveState]);

  useEffect(() => {
    if (saveState === "saved") return;
    const protectNavigation = (event: MouseEvent) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download") || link.origin !== window.location.origin) return;
      event.preventDefault(); event.stopImmediatePropagation();
      void saveQueueRef.current?.flush().then((ok) => { if (ok) router.push(`${link.pathname}${link.search}${link.hash}`); });
    };
    const protectStore = (event: Event) => {
      event.preventDefault();
      const commit = (event as CustomEvent<{ commit: () => void }>).detail.commit;
      void saveQueueRef.current?.flush().then((ok) => { if (ok) commit(); });
    };
    document.addEventListener("click", protectNavigation, true);
    window.addEventListener("jelly:before-store-change", protectStore);
    return () => { document.removeEventListener("click", protectNavigation, true); window.removeEventListener("jelly:before-store-change", protectStore); };
  }, [router, saveState]);

  useEffect(() => {
    if (!api) return;
    let active = true;
    void Promise.all([
      api.loadWorkspace(backendStoreId),
      api.listTemplates(backendStoreId),
      api.listGlobalSections(backendStoreId),
      api.listMenus(backendStoreId),
      api.listPresets(backendStoreId),
      api.listCatalog(backendStoreId),
      api.listPages(backendStoreId),
      api.listBlogs(backendStoreId),
      api.listArticles(backendStoreId),
      api.listThemeCatalog(backendStoreId),
      // A draft on an uploaded theme needs that version registered before anything resolves the theme.
      api.getThemeConfiguration(backendStoreId).then(async (configuration) => { await loadInstalledTheme(configuration?.draftArtifactId, { baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001" }); return configuration; }),
    ]).then(([nextWorkspace, nextTemplates, nextGlobals, nextMenus, nextPresets, nextCatalog, nextPages, nextBlogs, nextArticles, nextThemeCatalog, nextThemeConfiguration]) => {
      if (!active) return;
      setWorkspace(nextWorkspace);
      setTemplates(nextTemplates);
      setGlobals(nextGlobals);
      setMenuRecords(nextMenus ?? []);
      setPresets(nextPresets);
      setCatalog(nextCatalog);
      setPages(nextPages);
      setBlogs(nextBlogs);
      setArticles(nextArticles);
      setThemeCatalog(nextThemeCatalog);
      setThemeConfiguration(nextThemeConfiguration);
      const remembered = readUnsaved(backendStoreId);
      const found = remembered ? findRestorableWork(remembered, { templates: nextTemplates, globals: nextGlobals, theme: nextThemeConfiguration }) : null;
      if (found && Object.keys(found.items).length) setRestorable(found);
      else if (remembered) clearUnsaved(backendStoreId);
      unsavedDecided.current = !found || Object.keys(found.items).length === 0;
      setActiveTemplateId((current) => {
        if (current) return current;
        if (handoff.templateId && nextTemplates.some((template) => template.id === handoff.templateId)) return handoff.templateId;
        return pickInitialTemplate(nextTemplates)?.id || "";
      });
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "Unable to load the Online Store workspace");
    });
    return () => { active = false; };
  }, [api, backendStoreId, handoff, loadAttempt]);
}
