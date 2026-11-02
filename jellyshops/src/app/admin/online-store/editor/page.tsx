"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type SetStateAction, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ChevronLeft,
  LayoutPanelTop,
  Plus,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { createRevisionedSaveQueue } from "@/features/store-editor/state/revisioned-save-queue";
import { createSessionHistory } from "@/features/store-editor/state/session-history";
import { pickInitialTemplate, pickTemplateForType } from "@/features/store-editor/template-selection";
import { blockLabel, createSectionFromDefinition, getBlockDefinition, getSectionDefinition, listSectionDefinitionsForPage } from "@jelly/storefront-registry";
import { RegistrySectionRenderer, ThemeCustomCss, createCollectionLinks, withStoreIdentity, type CommerceDataProvider, type StorefrontPageContext } from "@jelly/storefront-renderer";
import type {
  CompilationDiagnostic,
  CompilationDiagnosticLocation,
  RuntimeStorefrontSnapshotV4,
  RuntimeMenuV4,
  BlockNode,
  SectionNode,
  RichTextDocument,
  ThemeId,
} from "@jelly/storefront-schema";
import { copyBlockWithNewIds, updateBlock } from "@jelly/storefront-schema";
import { mainLanguageName, resolveStorefrontThemeTokens, resolveTheme, storeLanguages, themeSocialLinks } from "@jelly/storefront-themes";
import { expandRawRuntimeLayout } from "@/features/storefront/resource-loader";
import { usePreviewBindingValues } from "@/features/store-editor/use-preview-binding-values";
import { isAssignableTemplateType } from "@/features/store-editor/template-names";
import { createResourceLinks } from "@/features/navigation/resource-links";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { useAuth } from "@/features/auth/providers/auth-provider";
import type {
  DemoCatalog,
  ArticleResource,
  BlogResource,
  CatalogAdminCollectionDetail,
  DynamicSourceDescriptor,
  GlobalSectionRecord,
  MenuRecord,
  SectionPresetRecord,
  StorefrontTemplateRecord,
  ThemeCatalogEntry,
  ThemeConfigurationRecord,
  ThemeLookRecord,
  PageResource,
  WorkspaceRecord,
} from "@/features/store-editor/api/types";
import { GlobalSectionPanel } from "@/features/store-editor/components/global-section-panel";
import { SettingGroups } from "@/features/store-editor/components/inspector/setting-groups";
import { RichTextDocumentEditor } from "@/features/store-editor/components/inspector/rich-text-document-editor";
import { ThemeSettingsPanel } from "@/features/store-editor/components/inspector/theme-settings-panel";
import { ThemeLibraryPanel } from "@/features/store-editor/components/theme-library-panel";
import { PublishControls } from "@/features/store-editor/components/publish-controls";
import { PublishHistory } from "@/features/store-editor/components/publish-history";
import { PublishDiagnostics } from "@/features/store-editor/components/publish-diagnostics";
import { EditorPanelNavigation, type EditorPanel } from "@/features/store-editor/components/editor-panel-navigation";
import { SectionLibrary } from "@/features/store-editor/components/section-library";
import { TemplateHierarchy } from "@/features/store-editor/components/template-hierarchy";
import { TemplateActions } from "@/features/store-editor/components/template-actions";
import { ScaledPreview } from "@/features/store-editor/components/scaled-preview";
import { StorefrontPreviewFrame } from "@/features/store-editor/components/storefront-preview-frame";
import { EditorPagePicker } from "@/features/store-editor/components/editor-page-picker";
import { WorkspaceToolbar } from "@/features/store-editor/components/workspace-toolbar";
import { type RegistrySection, type HierarchyRegion, sectionCategoryLabels, defaultTemplateLayout, displayName, setThemeSetting, normalizeSection, templateSections, draftPreviewLayout, selectedInlineSection } from "@/features/store-editor/editor-page-helpers";
import { editorSearchFor, parseEditorNavigationTarget } from "@/features/store-editor/editor-navigation";
import { createEditorPreviewPageContext, editorPreviewResourceOptions } from "@/features/store-editor/preview-context";
import { catalogProductToProduct } from "@/features/storefront/product-presentation";
import type { ConfiguredOptionSelection, Product } from "@/lib/domain";
import type { EditorSelection } from "@/features/store-editor/model/types";
import { SelectionToolbar } from "@/features/store-editor/components/selection-toolbar";
import { fetchPublicMetaobjects } from "@/features/storefront/metaobjects-api";
import { applySelectionAction, availableActions, blockDropLists, findTarget, moveBefore, moveBlockTo, siblingIdsFor, type SelectionAction, type SelectionTarget } from "@/features/store-editor/selection-actions";
import { useEditorShortcuts } from "@/features/store-editor/use-editor-shortcuts";
import { addBlockTo, childBlockOptions, createBlock, locateBlock } from "@/features/store-editor/block-editing";
import { applySettingsPatch, controlsForView, mobileKeys, settingsForView, type SettingsNode } from "@/features/store-editor/mobile-settings";
import { applyLanguagePatch, controlsForLanguage, settingsForLanguage } from "@/features/store-editor/translation-settings";
import { MobileEditingNote } from "@/features/store-editor/components/mobile-editing-note";
import { RestoreSessionBanner } from "@/features/store-editor/components/restore-session-banner";
import { clearUnsaved, describeUnsaved, findRestorableWork, readUnsaved, rememberUnsaved, type UnsavedWork } from "@/features/store-editor/state/unsaved-work";
import type { EditorViewport } from "@/features/store-editor/state/types";
import { withColorSchemeNames } from "@/features/store-editor/color-schemes";
import {
  appendBlock,
  appendGlobalPlacement,
  appendInlineSection,
  detachGlobalPlacement,
  movePlacement,
  reorderPlacement,
  removeInlineSection,
  replaceInlineWithGlobal,
  setInlineSectionEnabled,
  updateInlineSection,
} from "@/features/store-editor/template-layout";

export default function OnlineStoreEditorPage() {
  const { activeStore } = useAuth();
  return <StoreEditorWorkspace key={activeStore?.id ?? "loading"} />;
}

function subscribeNoop() { return () => {}; }

function StoreEditorWorkspace() {
  const mountedOnClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const router = useRouter();
  const { session, activeStore } = useAuth();
  const backendStoreId = activeStore?.id ?? "";
  const token = session?.access_token;
  const api = useMemo(() => (token && backendStoreId) ? createStoreEditorApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
  }) : null, [token, backendStoreId]);
  const [handoff] = useState(() => typeof window === "undefined" ? {} : parseEditorNavigationTarget(window.location.search));

  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [templates, setTemplateState] = useState<StorefrontTemplateRecord[]>([]);
  const [globals, setGlobalState] = useState<GlobalSectionRecord[]>([]);
  const templateDrafts = useRef<StorefrontTemplateRecord[]>([]);
  const globalDrafts = useRef<GlobalSectionRecord[]>([]);
  const setTemplates = (next: SetStateAction<StorefrontTemplateRecord[]>) => {
    templateDrafts.current = typeof next === "function" ? next(templateDrafts.current) : next;
    setTemplateState(templateDrafts.current);
  };
  const setGlobals = (next: SetStateAction<GlobalSectionRecord[]>) => {
    globalDrafts.current = typeof next === "function" ? next(globalDrafts.current) : next;
    setGlobalState(globalDrafts.current);
  };
  const [menuRecords, setMenuRecords] = useState<MenuRecord[]>([]);
  const [presets, setPresets] = useState<SectionPresetRecord[]>([]);
  // Theme library (saved looks); stays empty on a backend without it.
  const [looks, setLooks] = useState<ThemeLookRecord[]>([]);
  const [looksError, setLooksError] = useState("");
  const [looksBusy, setLooksBusy] = useState(false);
  const [dynamicSources, setDynamicSources] = useState<DynamicSourceDescriptor[]>([]);
  const [catalog, setCatalog] = useState<DemoCatalog>({ products: [], collections: [] });
  const [pages, setPages] = useState<PageResource[]>([]);
  const [blogs, setBlogs] = useState<BlogResource[]>([]);
  const [articles, setArticles] = useState<ArticleResource[]>([]);
  const [themeCatalog, setThemeCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [themeConfiguration, setThemeState] = useState<ThemeConfigurationRecord | null>(null);
  const themeDraft = useRef<ThemeConfigurationRecord | null>(null);
  const setThemeConfiguration = (next: ThemeConfigurationRecord | null) => {
    themeDraft.current = next;
    setThemeState(next);
  };
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [previewResourceId, setPreviewResourceId] = useState<string | undefined>(handoff.resourceId);
  const [previewQuery, setPreviewQuery] = useState("cake");
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewCollection, setPreviewCollection] = useState<CatalogAdminCollectionDetail | null>(null);
  const [previewProductSelections, setPreviewProductSelections] = useState<ConfiguredOptionSelection[]>([]);
  const [previewProductQuantity, setPreviewProductQuantity] = useState(1);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [activeGlobalId, setActiveGlobalId] = useState<string>();
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  // The language being edited: null = the main language; others come from theme settings > Languages.
  const [editLanguage, setEditLanguage] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<EditorPanel>("sections");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [previewInspectorEnabled, setPreviewInspectorEnabled] = useState(true);
  const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<RuntimeStorefrontSnapshotV4>();
  const previewVersion = useRef(0);
  const invalidatePreview = () => { previewVersion.current += 1; setPreviewSnapshot(undefined); };
  const [loadError, setLoadError] = useState<string>();
  const [libraryRegion, setLibraryRegion] = useState<HierarchyRegion>();
  const [blockPickerSectionId, setBlockPickerSectionId] = useState<string>();
  // Set when the block picker adds to a group rather than to the section.
  const [blockPickerParentId, setBlockPickerParentId] = useState<string>();
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string>();
  const [isConverting, setIsConverting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const convertingRef = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [history] = useState(() => createSessionHistory<{ kind: "template" | "global" | "theme"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }>());
  const [, refreshHistory] = useState(0);
  const historyScope = `${backendStoreId}:${activeTemplateId}`;
  const previewSelectionKind = selection?.kind;
  const previewSelectionSectionId = selection && selection.kind !== "theme" ? selection.sectionId : undefined;
  const previewSelectionBlockId = selection?.kind === "block" ? selection.blockId : undefined;
  const recordHistory = (change: { kind: "template" | "global" | "theme"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }) => {
    if (JSON.stringify(change.before) === JSON.stringify(change.after)) return;
    history.push(historyScope, change); refreshHistory((value) => value + 1);
  };
  const saveQueue = useRef<ReturnType<typeof createRevisionedSaveQueue> | null>(null);
  // Changes the last session never got saved (offered as "Restore your last session").
  const [restorable, setRestorable] = useState<UnsavedWork | null>(null);
  // Remembered work is only forgotten once the offer has been decided, so loading never erases it.
  const unsavedDecided = useRef(false);

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
    (block ?? section).scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [previewSelectionKind, previewSelectionSectionId, previewSelectionBlockId, activeTemplateId, viewport]);

  useEffect(() => {
    const queue = createRevisionedSaveQueue({
      onStatus: setSaveState,
      onError: (error) => setSaveError(error instanceof Error ? error.message : "Your changes could not be saved. Try again."),
    });
    saveQueue.current = queue;
    return () => { queue.dispose(); saveQueue.current?.dispose(); saveQueue.current = null; };
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
      void saveQueue.current?.flush().then((ok) => { if (ok) router.push(`${link.pathname}${link.search}${link.hash}`); });
    };
    const protectStore = (event: Event) => {
      event.preventDefault();
      const commit = (event as CustomEvent<{ commit: () => void }>).detail.commit;
      void saveQueue.current?.flush().then((ok) => { if (ok) commit(); });
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
      api.getThemeConfiguration(backendStoreId),
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

  const activeTemplate = templates.find((template) => template.id === activeTemplateId);
  const previewThemeStyle = useMemo(() => {
    const resolved = resolveTheme(themeConfiguration?.themeId, themeConfiguration?.settings ?? {}, themeConfiguration?.themeVersion);
    // Same token layer as the published storefront, so the preview matches the live store.
    return resolveStorefrontThemeTokens(resolved.id as ThemeId, resolved.settings);
  }, [themeConfiguration]);

  useEffect(() => {
    if (!api || !activeTemplate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear stale controls when the selected template disappears.
      setDynamicSources([]);
      return;
    }
    let active = true;
    setDynamicSources([]);
    void api.listDynamicSources(backendStoreId, activeTemplate.type)
      .then((sources) => { if (active) setDynamicSources(sources); })
      .catch(() => { if (active) setDynamicSources([]); });
    return () => { active = false; };
  }, [api, activeTemplate, backendStoreId]);

  useEffect(() => {
    if (!api || activeTemplate?.type !== "product" || !previewResourceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear detail data when switching away from product preview.
      setPreviewProduct(null);
      setPreviewProductSelections([]);
      setPreviewProductQuantity(1);
      return;
    }
    let active = true;
    setPreviewProduct(null);
    setPreviewProductSelections([]);
    setPreviewProductQuantity(1);
    void api.getProduct(backendStoreId, previewResourceId)
      .then((detail) => { if (active && detail?.storeId === backendStoreId) setPreviewProduct(catalogProductToProduct(detail)); })
      .catch(() => { if (active) setPreviewProduct(null); });
    return () => { active = false; };
  }, [api, activeTemplate?.type, backendStoreId, previewResourceId]);

  useEffect(() => {
    if (!api || activeTemplate?.type !== "collection" || !previewResourceId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear detail data when switching away from collection preview.
      setPreviewCollection(null);
      return;
    }
    let active = true;
    setPreviewCollection(null);
    void api.getCollection(backendStoreId, previewResourceId)
      .then((detail) => { if (active && detail?.storeId === backendStoreId) setPreviewCollection(detail); })
      .catch(() => { if (active) setPreviewCollection(null); });
    return () => { active = false; };
  }, [api, activeTemplate?.type, backendStoreId, previewResourceId]);

  const validGlobals = useMemo(
    () => globals.filter((global): global is GlobalSectionRecord => Boolean(global?.id)),
    [globals],
  );
  const globalMap = useMemo(() => new Map(validGlobals.map((global) => [global.id, global])), [validGlobals]);
  const sections = useMemo(
    () => activeTemplate ? templateSections(activeTemplate, globalMap) : [],
    [activeTemplate, globalMap],
  );
  // The selected section and block live in the address (?section=…&block=…), so a reload or a shared link opens the same place.
  const urlSelectionApplied = useRef(false);
  useEffect(() => {
    if (urlSelectionApplied.current || !activeTemplate) return;
    urlSelectionApplied.current = true;
    const section = handoff.sectionId ? sections.find((item) => item.id === handoff.sectionId) : undefined;
    if (!section) return;
    const hasBlock = handoff.blockId ? section.blocks.some((block) => block.id === handoff.blockId || block.blocks?.some((child) => child.id === handoff.blockId)) : false;
    setSelection(hasBlock && handoff.blockId ? { kind: "block", region: "template", sectionId: section.id, blockId: handoff.blockId } : { kind: "section", region: "template", sectionId: section.id });
  }, [activeTemplate, sections, handoff]);
  useEffect(() => {
    if (!urlSelectionApplied.current || !activeTemplateId || typeof window === "undefined") return;
    const inTemplate = selection && selection.kind !== "theme" && selection.region === "template" ? selection : null;
    const search = editorSearchFor(window.location.search, { templateId: activeTemplateId, sectionId: inTemplate?.sectionId, blockId: inTemplate?.kind === "block" ? inTemplate.blockId : undefined });
    if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [selection, activeTemplateId]);
  const previewResources = useMemo(
    () => {
      const options = editorPreviewResourceOptions(activeTemplate?.type, catalog, { pages, blogs, articles });
      if (handoff.resourceId && handoff.resourceType === activeTemplate?.type && !options.some((option) => option.id === handoff.resourceId)) {
        options.push({ id: handoff.resourceId, label: `Selected ${handoff.resourceType}` });
      }
      return options;
    },
    [activeTemplate, articles, blogs, catalog, handoff, pages],
  );
  const globalLabels = useMemo(() => Object.fromEntries(validGlobals.map((global) => [
    global.id,
    {
      id: global.id,
      name: global.name,
      sectionType: typeof global.section.type === "string" ? global.section.type : undefined,
      sectionId: typeof global.section.id === "string" ? global.section.id : undefined,
      blocks: Array.isArray(global.section.blocks) ? global.section.blocks.flatMap((block) => block && typeof block === "object" && typeof block.id === "string" && typeof block.type === "string" ? [{ id: block.id, type: block.type }] : []) : [],
    },
  ])), [validGlobals]);
  const presetOptions = useMemo(() => presets.flatMap((preset) => {
    const section = normalizeSection(preset.section);
    return section ? [{ id: preset.id, name: preset.name, section }] : [];
  }), [presets]);
  const globalOptions = useMemo(() => validGlobals.flatMap((global) => {
    const section = normalizeSection(global.section);
    return section ? [{ id: global.id, name: global.name, section }] : [];
  }), [validGlobals]);
  const selectedGlobal = activeGlobalId ? globalMap.get(activeGlobalId) : undefined;
  const localSection = selectedGlobal ? normalizeSection(selectedGlobal.section) : activeTemplate ? selectedInlineSection(activeTemplate, selection) : null;
  // Blocks are found at any depth (blocks inside a group too).
  const selectedLocation = selection?.kind === "block" ? locateBlock(localSection, selection.blockId) : null;
  const selectedBlock = selectedLocation?.block;
  const selectedChildOptions = localSection && selectedBlock ? childBlockOptions(localSection, selectedBlock.id) : { types: [], full: false };
  const sectionDefinition = localSection ? getSectionDefinition(localSection.type) : undefined;
  const blockDefinition = selectedBlock ? getBlockDefinition(selectedBlock.type) : undefined;
  const baseControls = selectedBlock ? blockDefinition?.controls ?? [] : sectionDefinition?.controls ?? [];
  // On the Mobile preview, phone settings show and save their phone values.
  const responsiveView = viewport;
  const selectedNode = selectedBlock ?? localSection;
  // The colour scheme picker shows the theme's schemes by name.
  const languages = storeLanguages(themeConfiguration?.settings);
  const activeLanguage = editLanguage && languages.some((item) => item.code === editLanguage) ? editLanguage : null;
  const activeLanguageName = languages.find((item) => item.code === activeLanguage)?.name ?? "";
  // In another language, text settings show and save that language's text.
  const selectedControls = controlsForLanguage(controlsForView(withColorSchemeNames(baseControls, themeConfiguration?.settings, selectedNode?.settings), responsiveView, selectedNode?.settings), activeLanguage, activeLanguageName, selectedNode?.settings);
  const selectedSettings = selectedNode ? settingsForLanguage(settingsForView(selectedNode, baseControls, responsiveView), baseControls, activeLanguage) : {};
  const compiledTemplate = activeTemplate && previewSnapshot ? previewSnapshot.templates[activeTemplate.id] : undefined;
  const rawPreviewLayout = compiledTemplate && previewSnapshot
    ? expandRawRuntimeLayout(previewSnapshot, compiledTemplate)
    : activeTemplate ? draftPreviewLayout(activeTemplate, globalMap) : { announcement: [], header: [], template: [], footer: [] };
  // Settings connected to custom fields show the value for the item being previewed.
  const previewLayout = usePreviewBindingValues(rawPreviewLayout, {
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
    storeId: backendStoreId,
    resource: activeTemplate && isAssignableTemplateType(activeTemplate.type) && previewResourceId ? { type: activeTemplate.type, id: previewResourceId } : undefined,
  });
  const previewPageContext: StorefrontPageContext | null = activeTemplate
    ? createEditorPreviewPageContext({ type: activeTemplate.type, resourceId: previewResourceId, storeId: backendStoreId, catalog, content: { pages, blogs, articles }, searchQuery: previewQuery, productDetail: previewProduct, productRuntime: { selections: previewProductSelections, quantity: previewProductQuantity, onSelectionsChange: setPreviewProductSelections, onQuantityChange: setPreviewProductQuantity }, collectionDetail: previewCollection })
    : null;
  const builtInSections = useMemo(() => {
    if (!activeTemplate || !libraryRegion) return [];
    return listSectionDefinitionsForPage(activeTemplate.type, libraryRegion)
      .map((definition) => ({
        id: definition.type,
        name: displayName(definition.type),
        category: sectionCategoryLabels[definition.category],
      }));
  }, [activeTemplate, libraryRegion]);
  const blockPickerSection = sections.find((section) => section.id === blockPickerSectionId);
  const blockPickerDefinition = blockPickerSection ? getSectionDefinition(blockPickerSection.type) : undefined;
  const blockPickerTypes = blockPickerSection && blockPickerParentId
    ? childBlockOptions(blockPickerSection, blockPickerParentId).types
    : blockPickerDefinition?.allowedBlockTypes ?? [];
  const selectedTheme = themeCatalog.find((theme) => theme.id === themeConfiguration?.themeId);

  const commerce = useMemo<CommerceDataProvider>(() => ({
    getMetaobjects: backendStoreId ? (handle) => fetchPublicMetaobjects(backendStoreId, handle) : undefined,
    async getProducts() {
      return catalog.products.map((product) => ({
        id: product.id,
        name: product.name,
        href: `/products/${product.slug}`,
        imageUrl: product.imageUrl,
        price: new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.priceMinor / 100),
      }));
    },
  }), [catalog, backendStoreId]);

  useEffect(() => {
    if (previewResources.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset an invalid resource selection after template changes.
      setPreviewResourceId(undefined);
      return;
    }
    if (!previewResources.some((resource) => resource.id === previewResourceId)) {
      setPreviewResourceId(previewResources[0]?.id);
    }
  }, [previewResourceId, previewResources]);

  const persistLayout = (layout: Record<string, unknown>, record = true) =>
    activeTemplate ? persistTemplateLayout(activeTemplate.id, layout, record) : Promise.resolve(false);

  const persistTemplateLayout = async (templateId: string, layout: Record<string, unknown>, record = true) => {
    if (convertingRef.current) return false;
    const previous = templateDrafts.current.find((template) => template.id === templateId);
    if (!api || !previous) return false;
    if (record) recordHistory({ kind: "template", id: previous.id, before: previous.layout, after: layout });
    const draft = { ...previous, layout };
    rememberUnsaved(backendStoreId, { kind: "template", id: draft.id, baseRevision: draft.revision, value: layout });
    setTemplates((current) => current.map((template) => template.id === draft.id ? draft : template));
    invalidatePreview();
    setDiagnostics([]);
    return saveQueue.current?.save(`template:${draft.id}`, draft, {
      async persist(value) {
        const result = await api.updateTemplate(backendStoreId, value.id, value.revision, { layout: value.layout });
        setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, result.generation) } : current);
        return result.template;
      },
      onSaved(saved, pending) {
        setTemplates((current) => current.map((template) => template.id === saved.id ? pending ? { ...template, revision: saved.revision } : saved : template));
      },
    }) ?? false;
  };

  useEffect(() => {
    if (!api || !backendStoreId) return;
    let active = true;
    api.listThemeLooks(backendStoreId).then((result) => { if (active) setLooks(result.looks); }).catch(() => undefined);
    return () => { active = false; };
  }, [api, backendStoreId]);

  const saveThemeLook = async (name: string) => {
    if (!api || !themeDraft.current || looksBusy) return;
    setLooksBusy(true); setLooksError("");
    try {
      if (!await saveQueue.current?.flush()) return;
      const current = themeDraft.current;
      const result = await api.saveThemeLook(backendStoreId, { name, themeId: current.themeId, ...(current.themeVersion ? { themeVersion: current.themeVersion } : {}), settings: current.settings });
      setLooks((existing) => [...existing, result.look]);
    } catch (error) { setLooksError(error instanceof Error ? error.message : "Could not save this look. Try again."); }
    finally { setLooksBusy(false); }
  };

  const renameThemeLook = async (look: { id: string }, name: string) => {
    if (!api || looksBusy) return;
    setLooksBusy(true); setLooksError("");
    try { const result = await api.renameThemeLook(backendStoreId, look.id, name); setLooks((existing) => existing.map((item) => item.id === look.id ? result.look : item)); }
    catch (error) { setLooksError(error instanceof Error ? error.message : "Could not rename this look. Try again."); }
    finally { setLooksBusy(false); }
  };

  const deleteThemeLook = async (look: { id: string }) => {
    if (!api || looksBusy) return;
    setLooksBusy(true); setLooksError("");
    try { await api.deleteThemeLook(backendStoreId, look.id); setLooks((existing) => existing.filter((item) => item.id !== look.id)); }
    catch (error) { setLooksError(error instanceof Error ? error.message : "Could not delete this look. Try again."); }
    finally { setLooksBusy(false); }
  };

  const persistThemeSetting = async (path: string, value: unknown, record = true, look?: { themeId: string; themeVersion: string; settings: Record<string, unknown> }) => {
    if (convertingRef.current) return;
    if (!api || !themeDraft.current) return;
    const previous = themeDraft.current;
    const settings = look ? structuredClone(look.settings) : path ? setThemeSetting(previous.settings, path, value) : value as Record<string, unknown>;
    // Applying a saved look also changes the theme itself, which undo does not bring back; save the current look first to keep it.
    if (record && !look) recordHistory({ kind: "theme", id: "theme", before: previous.settings, after: settings });
    const draft = { ...previous, settings, ...(look ? { themeId: look.themeId, themeVersion: look.themeVersion } : {}) };
    if (!look) rememberUnsaved(backendStoreId, { kind: "theme", id: "theme", baseRevision: draft.revision, value: settings });
    setThemeConfiguration(draft);
    invalidatePreview();
    setDiagnostics([]);
    await saveQueue.current?.save("theme", draft, {
      async persist(value) {
        const result = await api.saveThemeConfiguration(backendStoreId, value.revision, { themeId: value.themeId, themeVersion: value.themeVersion, settings: value.settings, draftArtifactId: value.draftArtifactId ?? null });
        setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, result.generation) } : current);
        return result.theme;
      },
      onSaved(saved, pending) { setThemeConfiguration(pending && themeDraft.current ? { ...themeDraft.current, revision: saved.revision } : saved); },
    });
  };

  const persistGlobalSection = async (section: SectionNode, record = true, targetId = selectedGlobal?.id) => {
    if (convertingRef.current) return false;
    if (!api || !targetId) return false;
    const previous = globalDrafts.current.find((global) => global.id === targetId);
    if (!previous) return false;
    const nextSection = section as unknown as Record<string, unknown>;
    if (record) recordHistory({ kind: "global", id: previous.id, before: previous.section, after: nextSection });
    const draft = { ...previous, section: nextSection };
    rememberUnsaved(backendStoreId, { kind: "global", id: draft.id, baseRevision: draft.revision, value: nextSection });
    setGlobals((current) => current.map((global) => global.id === draft.id ? draft : global));
    invalidatePreview();
    setDiagnostics([]);
    return saveQueue.current?.save(`global:${draft.id}`, draft, {
      async persist(value) {
        const result = await api.updateGlobalSection(backendStoreId, value.id, value.revision, { section: value.section });
        setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, result.generation) } : current);
        return result.globalSection;
      },
      onSaved(saved, pending) { setGlobals((current) => current.map((global) => global.id === saved.id ? pending ? { ...global, revision: saved.revision } : saved : global)); },
    }) ?? false;
  };

  /** Puts the last session's unsaved changes back; they save like any other edit (and can be undone). */
  const restoreLastSession = async () => {
    const work = restorable;
    if (!work) return;
    setRestorable(null);
    unsavedDecided.current = true;
    for (const item of Object.values(work.items)) {
      if (item.kind === "template") await persistTemplateLayout(item.id, item.value);
      else if (item.kind === "global") await persistGlobalSection(item.value as unknown as SectionNode, true, item.id);
      else await persistThemeSetting("", item.value);
    }
  };
  const discardLastSession = () => {
    setRestorable(null);
    unsavedDecided.current = true;
    clearUnsaved(backendStoreId);
  };

  const playHistory = async (direction: "undo" | "redo") => {
    const change = direction === "undo" ? history.undo(historyScope) : history.redo(historyScope);
    if (!change) return;
    refreshHistory((value) => value + 1);
    const value = direction === "undo" ? change.before : change.after;
    if (change.kind === "template") await persistLayout(value, false);
    else if (change.kind === "global") await persistGlobalSection(value as unknown as SectionNode, false, change.id);
    else await persistThemeSetting("", value, false);
  };

  // A saved section is added as its own copy, with new ids each time.
  const insertPreset = async (section: SectionNode) => {
    if (!activeTemplate) return;
    const createId = () => crypto.randomUUID();
    const copy = { ...structuredClone(section), id: createId(), blocks: section.blocks.map((block) => copyBlockWithNewIds(block, createId)) };
    if (!await persistLayout(appendInlineSection(activeTemplate.layout, copy))) return;
    setSelection({ kind: "section", region: "template", sectionId: copy.id });
  };

  const saveToLibrary = async (section: SectionNode, name: string) => {
    if (!api) return;
    try {
      const created = await api.createPreset(backendStoreId, { name, section: structuredClone(section) as unknown as Record<string, unknown> });
      setPresets((current) => [...current, created.preset]);
      setWorkspace((current) => current ? { ...current, generation: created.generation } : current);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not save this section. Try again.");
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!api) return;
    try {
      const result = await api.deletePreset(backendStoreId, presetId);
      setPresets((current) => current.filter((preset) => preset.id !== presetId));
      setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not remove the saved section. Try again.");
    }
  };

  const insertBuiltIn = async (sectionType: string) => {
    if (!activeTemplate || !libraryRegion) return;
    const section = createSectionFromDefinition(sectionType, () => crypto.randomUUID());
    await persistLayout(appendInlineSection(activeTemplate.layout, section));
    setSelection({ kind: "section", region: libraryRegion, sectionId: section.id });
    setLibraryRegion(undefined);
  };

  const addBlock = async (blockType: string) => {
    if (!activeTemplate || !blockPickerSection) return;
    const block: BlockNode | null = createBlock(blockType);
    if (!block) return;
    const layout = blockPickerParentId
      ? updateInlineSection(activeTemplate.layout, blockPickerSection.id, (current) => addBlockTo(current, blockPickerParentId, block))
      : appendBlock(activeTemplate.layout, blockPickerSection.id, block);
    if (!await persistLayout(layout)) return;
    setSelection({ kind: "block", region: "template", sectionId: blockPickerSection.id, blockId: block.id });
    setBlockPickerSectionId(undefined);
    setBlockPickerParentId(undefined);
  };

  const removeSelectedSection = async () => {
    if (!activeTemplate || !localSection) return;
    void persistLayout(removeInlineSection(activeTemplate.layout, localSection.id));
    setSelection(null);
    setMobilePanel("sections");
  };

  const moveSelectedPlacement = async (id: string, direction: "up" | "down") => {
    if (!activeTemplate) return;
    await persistLayout(movePlacement(activeTemplate.layout, id, direction));
  };

  const toggleSection = async (id: string, enabled: boolean) => {
    if (!activeTemplate) return;
    await persistLayout(setInlineSectionEnabled(activeTemplate.layout, id, enabled));
  };

  const insertGlobal = async (globalSectionId: string) => {
    if (!activeTemplate) return;
    if (!await persistLayout(appendGlobalPlacement(activeTemplate.layout, globalSectionId))) return;
    setActiveGlobalId(globalSectionId);
    setSelection(null);
  };

  const makeGlobal = async (section: SectionNode) => {
    if (!api || !activeTemplate) return;
    if (convertingRef.current) return;
    convertingRef.current = true;
    setIsConverting(true);
    try {
    if (!await saveQueue.current?.flush()) return;
    setSaveState("saving");
    const created = await api.createGlobalSection(backendStoreId, {
      name: `Shared ${displayName(section.type).toLowerCase()}`,
      section: structuredClone(section) as unknown as Record<string, unknown>,
    });
    if (!created.globalSection?.id) return;
    setGlobals((current) => [...current, created.globalSection]);
    setWorkspace((current) => current ? { ...current, generation: created.generation } : current);
    const result = await api.updateTemplate(
      backendStoreId,
      activeTemplate.id,
      templateDrafts.current.find((template) => template.id === activeTemplate.id)?.revision ?? activeTemplate.revision,
      { layout: replaceInlineWithGlobal(templateDrafts.current.find((template) => template.id === activeTemplate.id)?.layout ?? activeTemplate.layout, section.id, created.globalSection.id) },
    );
    setTemplates((current) => current.map((template) => template.id === result.template.id ? result.template : template));
    setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
    invalidatePreview();
    setSelection(null);
    setActiveGlobalId(created.globalSection.id);
    setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not create a shared section. Try again.");
    } finally {
      convertingRef.current = false;
      setIsConverting(false);
    }
  };

  const detachGlobal = async (section: SectionNode) => {
    if (!activeTemplate || !activeGlobalId) return;
    if (!await persistLayout(detachGlobalPlacement(activeTemplate.layout, activeGlobalId, section))) return;
    setActiveGlobalId(undefined);
    setSelection({ kind: "section", region: "template", sectionId: section.id });
  };

  const updateSelectedSetting = (key: string, value: unknown) => updateSelectedSettings({ [key]: value });
  // Several settings in one save (rich text keeps its plain text and formatted copy together).
  const updateSelectedSettings = async (patch: Record<string, unknown>) => {
    if (convertingRef.current) return;
    if (!activeTemplate || !localSection || selection?.kind === "theme") return;
    const applyPatch = <T extends SettingsNode>(node: T): T => applyLanguagePatch(node, patch, baseControls, activeLanguage) ?? applySettingsPatch(node, patch, baseControls, responsiveView);
    if (selectedGlobal) {
      await persistGlobalSection(selection?.kind === "block"
        ? { ...localSection, blocks: updateBlock(localSection.blocks, selection.blockId, applyPatch) }
        : applyPatch(localSection));
      return;
    }
    if (!selection) return;
    const layout = updateInlineSection(activeTemplate.layout, localSection.id, (current) => {
      if (selection.kind === "block") return { ...current, blocks: updateBlock(current.blocks, selection.blockId, applyPatch) };
      return applyPatch(current);
    });
    await persistLayout(layout);
  };

  const saveRichTextDocument = async (document: RichTextDocument) => {
    if (convertingRef.current) throw new Error("Wait for the shared section update to finish.");
    if (!activeTemplate || !localSection || localSection.type !== "rich-text") throw new Error("Select a rich text section first.");
    if (selectedGlobal) {
      if (!await persistGlobalSection({ ...localSection, settings: { ...localSection.settings, document } })) throw new Error("Your shared text could not be saved. Try again.");
      return;
    }
    const layout = updateInlineSection(activeTemplate.layout, localSection.id, (current) => ({
      ...current,
      settings: { ...current.settings, document },
    }));
    if (!await persistLayout(layout)) throw new Error("Rich text could not be saved. Please try again.");
  };

  const openDiagnostic = (location: CompilationDiagnosticLocation) => {
    setDesktopSidebarOpen(true);
    setMobilePanel("settings");
    if (location.entityType === "template" && location.entityId && templates.some((template) => template.id === location.entityId)) {
      setActiveTemplateId(location.entityId);
      setActiveGlobalId(undefined);
    }
    if (location.entityType === "global_section" && location.entityId) {
      setActiveGlobalId(location.entityId);
      setSelection(null);
      return;
    }
    if (location.sectionId) {
      setActiveGlobalId(undefined);
      setSelection(location.blockId
        ? { kind: "block", region: "template", sectionId: location.sectionId, blockId: location.blockId, fieldKey: location.fieldKey }
        : { kind: "section", region: "template", sectionId: location.sectionId });
    }
  };

  // Floating toolbar and shortcuts act on the selected section or block of this template (not shared sections).
  const toolbarTarget: SelectionTarget | null = activeTemplate && !selectedGlobal && selection && selection.kind !== "theme"
    ? { sectionId: selection.sectionId, ...(selection.kind === "block" ? { blockId: selection.blockId } : {}) }
    : null;
  const toolbarFound = toolbarTarget && activeTemplate ? findTarget(activeTemplate.layout, toolbarTarget) : null;
  const runSelectionAction = async (action: SelectionAction) => {
    if (!activeTemplate || !toolbarTarget || !toolbarFound) return;
    const result = applySelectionAction(activeTemplate.layout, toolbarTarget, action);
    if (!result || !await persistLayout(result.layout)) return;
    const region = selection && selection.kind !== "theme" ? selection.region : "template";
    setSelection(result.select ? (result.select.blockId ? { kind: "block", region, sectionId: result.select.sectionId, blockId: result.select.blockId } : { kind: "section", region, sectionId: result.select.sectionId }) : null);
    if (!result.select) setMobilePanel("sections");
  };
  // Dragging the toolbar's grip over the preview drops the selection before a sibling (or at the end).
  const runMove = async (beforeId: string | null) => {
    if (!activeTemplate || !toolbarTarget || !toolbarFound) return;
    const result = moveBefore(activeTemplate.layout, toolbarTarget, beforeId);
    if (result) await persistLayout(result.layout);
  };
  // A block dragged into another list (into or out of a group).
  const runMoveTo = async (parentId: string | null, beforeId: string | null) => {
    if (!activeTemplate || !toolbarTarget || !toolbarFound) return;
    const result = moveBlockTo(activeTemplate.layout, toolbarTarget, parentId, beforeId);
    if (result) await persistLayout(result.layout);
  };
  useEditorShortcuts({
    undo: () => { void playHistory("undo"); },
    redo: () => { void playHistory("redo"); },
    save: () => { void saveQueue.current?.flush(); },
    remove: toolbarFound ? () => { void runSelectionAction("remove"); } : undefined,
    duplicate: toolbarFound ? () => { void runSelectionAction("duplicate"); } : undefined,
    deselect: selection ? () => setSelection(null) : undefined,
  });

  if (!api) {
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center text-[var(--ink)]"><div><h1 className="text-xl font-semibold">Online Store editor is disabled</h1><p className="mt-2 text-sm text-[var(--ink-soft)]">Connect merchant authentication to use the editor.</p></div></main>;
  }

  if (loadError) {
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center text-[var(--ink)]"><div><h1 className="text-xl font-semibold">Could not load Online Store</h1><p role="alert" className="mt-2 text-sm text-[var(--destructive)]">{loadError}</p><button type="button" onClick={() => { setLoadError(undefined); setLoadAttempt((value) => value + 1); }} className="mt-5 rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-semibold">Try again</button></div></main>;
  }

  if (!workspace) {
    return <main className="grid min-h-[70vh] place-items-center text-[13px] text-[var(--ink-soft)]" aria-live="polite">Loading Online Store editor…</main>;
  }

  if (templates.length === 0) {
    return (
      <main className="grid min-h-[70vh] place-items-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">No theme installed</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Please choose a template from the Online Store overview to get started.</p>
          <Link href="/admin/online-store" className="mt-4 inline-block text-sm font-semibold text-[var(--ink)] hover:underline">Go to Online Store</Link>
        </div>
      </main>
    );
  }

  if (!activeTemplate) {
    return <main className="grid min-h-[70vh] place-items-center text-[13px] text-[var(--ink-soft)]" aria-live="polite">Loading template…</main>;
  }

  const previewBranding = (themeConfiguration?.settings as { branding?: { logoUrl?: string }; header?: Record<string, unknown> } | undefined);
  const previewIdentity = { name: activeStore?.name ?? "Your store", logoUrl: previewBranding?.branding?.logoUrl || undefined, headerSettings: previewBranding?.header, socialLinks: themeSocialLinks(themeConfiguration?.settings) };
  const renderPreviewSections = (items: SectionNode[], region: "header" | "template" | "footer") => items.map((section) => (
    <RegistrySectionRenderer
      key={section.id}
      section={withStoreIdentity(section as unknown as RegistrySection, previewIdentity)}
      mode={previewInspectorEnabled ? "editor" : "preview"}
      commerce={commerce}
      region={region}
      themeId={themeConfiguration?.themeId}
      page={previewPageContext ?? undefined}
      language={activeLanguage}
      menus={previewSnapshot?.menus ?? Object.fromEntries(menuRecords.map((menu) => [menu.handle, { id: menu.id, handle: menu.handle, items: menu.items }])) as Record<string, RuntimeMenuV4>}
      collectionLinks={createCollectionLinks(backendStoreId, activeStore?.slug ?? "", catalog.collections.map(item => ({ ...item, storeId: backendStoreId })))}
      resourceLinks={createResourceLinks(activeStore?.slug ?? "", [
        ...catalog.products.map(item => ({ kind: "product" as const, id: item.id, handle: item.slug })),
        ...pages.map(item => ({ kind: "page" as const, id: item.id, handle: item.handle })),
        ...blogs.map(item => ({ kind: "blog" as const, id: item.id, handle: item.handle })),
        ...articles.map(item => ({ kind: "article" as const, id: item.id, handle: item.handle, blogHandle: blogs.find(blog => blog.id === item.blogId)?.handle })),
      ])}
      storeSlug={activeStore?.slug}
      selected={previewSnapshot || !previewInspectorEnabled ? undefined : selection ?? (typeof selectedGlobal?.section.id === "string" ? { kind: "section", region: "template", sectionId: selectedGlobal.section.id } : undefined)}
      onSelect={!previewInspectorEnabled ? undefined : (next) => {
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
      }}
    />
  ));

  const renderInspectorPanel = () => (
    <>
      {selection?.kind === "theme" && (
        <>
        <ThemeLibraryPanel
          looks={looks}
          currentThemeName={selectedTheme?.name ?? "Current theme"}
          themeName={(themeId) => themeCatalog.find((theme) => theme.id === themeId)?.name ?? themeId}
          busy={looksBusy}
          error={looksError}
          onSave={(name) => { void saveThemeLook(name); }}
          onApply={(look) => { void persistThemeSetting("", undefined, false, look); }}
          onRename={(look, name) => { void renameThemeLook(look, name); }}
          onDelete={(look) => { void deleteThemeLook(look); }}
        />
        <ThemeSettingsPanel
          schema={selectedTheme?.settingsSchema ?? []}
          settings={themeConfiguration?.settings ?? {}}
          saving={false}
          upload={(file, onProgress) => api.uploadMedia(backendStoreId, file, onProgress)}
          onChange={(path, value) => { void persistThemeSetting(path, value); }}
        />
        </>
      )}

      {diagnostics.length > 0 && (
        <div className="border-b border-[var(--line)] p-3">
          <PublishDiagnostics diagnostics={diagnostics} onOpen={openDiagnostic} />
        </div>
      )}

      {libraryRegion && (
        <>
          <div className="flex h-14 items-center gap-2 border-b border-[var(--line)] px-3">
            <button
              type="button"
              aria-label="Back to sections"
              onClick={() => { setLibraryRegion(undefined); setMobilePanel("sections"); }}
              className="grid size-8 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <p className="text-[12px] text-[var(--ink-soft)]">{displayName(libraryRegion)}</p>
              <h2 className="text-[13px] font-semibold">Add section</h2>
            </div>
          </div>
          <SectionLibrary
            presets={presetOptions}
            builtIns={builtInSections}
            onInsertPreset={(section) => { void insertPreset(section); setLibraryRegion(undefined); }}
            onInsertBuiltIn={(sectionType) => { void insertBuiltIn(sectionType); }}
            onDeletePreset={(presetId) => { void deletePreset(presetId); }}
          />
        </>
      )}

      {blockPickerSection && blockPickerDefinition && !libraryRegion && (
        <>
          <div className="flex h-14 items-center gap-2 border-b border-[var(--line)] px-3">
            <button
              type="button"
              aria-label="Back to section settings"
              onClick={() => { setBlockPickerSectionId(undefined); setBlockPickerParentId(undefined); setMobilePanel("settings"); }}
              className="grid size-8 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <p className="text-[12px] text-[var(--ink-soft)]">{displayName(blockPickerSection.type)}</p>
              <h2 className="text-[13px] font-semibold">{blockPickerParentId ? "Add block to group" : "Add content block"}</h2>
            </div>
          </div>
          <div className="space-y-1 p-3">
            {blockPickerTypes.map((blockType) => (
              <button
                key={blockType}
                type="button"
                onClick={() => { void addBlock(blockType); }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium hover:bg-[var(--paper)]"
              >
                <span className="grid size-8 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)]">
                  <Plus size={15} />
                </span>
                {blockLabel(blockType)}
              </button>
            ))}
            {blockPickerTypes.length === 0 && (
              <p className="py-8 text-center text-[12px] text-[var(--ink-soft)]">This section does not support content blocks.</p>
            )}
          </div>
        </>
      )}

      {localSection && !libraryRegion && !blockPickerSectionId && (
        <>
          <div className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-3 border-b border-[var(--line)] bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label={selectedLocation?.parent ? "Back to group" : selectedBlock ? "Back to section settings" : "Back to sections"}
                onClick={() => {
                  const region = selection && selection.kind !== "theme" ? selection.region : "template";
                  setSelection(selectedLocation?.parent
                    ? { kind: "block", region, sectionId: localSection.id, blockId: selectedLocation.parent.id }
                    : selectedBlock ? { kind: "section", region, sectionId: localSection.id } : null);
                  if (!selectedBlock) setMobilePanel("sections");
                }}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
              >
                <ChevronLeft size={16} />
              </button>
              <LayoutPanelTop size={16} className="text-[var(--ink-soft)]" />
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--ink-soft)]">
                  {selectedBlock && localSection.type !== "rich-text" ? displayName(localSection.type) : "Section settings"}
                </p>
                <p className="truncate text-[13px] font-semibold">
                  {localSection.type === "rich-text" || !selectedBlock ? displayName(localSection.type) : blockLabel(selectedBlock.type)}
                </p>
              </div>
            </div>
            {!selectedBlock && !selectedGlobal && (
              <button
                type="button"
                aria-label="Remove section"
                onClick={() => { void removeSelectedSection(); }}
                className="grid size-8 place-items-center rounded-lg text-[var(--destructive)] hover:bg-[var(--paper-deep)]"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          <div className="border-b border-[var(--line)] px-4 py-4">
            {responsiveView !== "desktop" && localSection.type !== "rich-text" && <MobileEditingNote device={responsiveView} phoneSettings={mobileKeys(baseControls).size} />}
            {localSection.type === "rich-text" ? (
              <RichTextDocumentEditor
                key={`${activeTemplate.id}:${localSection.id}`}
                section={localSection}
                onSave={saveRichTextDocument}
              />
            ) : selectedControls.length > 0 ? (
              <SettingGroups
                controls={selectedControls}
                settings={selectedSettings}
                catalog={catalog}
                upload={(file, onProgress) => api.uploadMedia(backendStoreId, file, onProgress)}
                dynamicSources={dynamicSources}
                onChange={(key, nextValue) => { void updateSelectedSetting(key, nextValue); }}
                onPatch={(patch) => { void updateSelectedSettings(patch); }}
              />
            ) : (
              <p className="py-8 text-center text-[12px] text-[var(--ink-soft)]">This item has no additional settings.</p>
            )}
          </div>

          {!selectedBlock && localSection.blocks.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Content blocks</p>
              {localSection.blocks.map((block) => <button key={block.id} type="button" onClick={() => setSelection({ kind: "block", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, blockId: block.id })} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs hover:bg-muted">{blockLabel(block.type)}</button>)}
            </div>
          )}
          {selectedBlock && !selectedGlobal && selectedChildOptions.types.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              {(selectedBlock.blocks ?? []).length > 0 && <p className="mb-2 text-xs font-semibold text-muted-foreground">Blocks in this group</p>}
              {(selectedBlock.blocks ?? []).map((block) => <button key={block.id} type="button" onClick={() => setSelection({ kind: "block", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, blockId: block.id })} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs hover:bg-muted">{blockLabel(block.type)}{block.enabled ? "" : " (hidden)"}</button>)}
              <button
                type="button"
                disabled={selectedChildOptions.full}
                onClick={() => { setBlockPickerParentId(selectedBlock.id); setBlockPickerSectionId(localSection.id); }}
                className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--paper-deep)] disabled:opacity-50"
              >
                <Plus size={15} /> {selectedChildOptions.full ? "This group is full" : "Add block to group"}
              </button>
            </div>
          )}
          {!selectedBlock && !selectedGlobal && localSection.type !== "rich-text" && sectionDefinition && sectionDefinition.allowedBlockTypes.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <button
                type="button"
                onClick={() => { setBlockPickerParentId(undefined); setBlockPickerSectionId(localSection.id); }}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--paper-deep)]"
              >
                <Plus size={15} /> Add content block
              </button>
            </div>
          )}
        </>
      )}

      {!localSection && selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && (
        <div className="px-6 py-12 text-center">
          <LayoutPanelTop className="mx-auto text-[var(--ink-soft)]" size={28} />
          <p className="mt-3 text-[13px] font-semibold">Select a section to edit</p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--ink-soft)]">Choose a section or content block from the page structure, or add a new section.</p>
        </div>
      )}

      {selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && (
        <>
          <details className="border-t border-border">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium">Shared and saved sections</summary>
          <GlobalSectionPanel
            globalSections={globalOptions}
            localSection={selectedGlobal ? undefined : localSection ?? undefined}
            attachedGlobalId={activeGlobalId}
            onMakeGlobal={(section) => { void makeGlobal(section); }}
            onInsertGlobal={(globalId) => { void insertGlobal(globalId); }}
            onDetachGlobal={(section) => { void detachGlobal(section); }}
            onSaveToLibrary={(section, name) => { void saveToLibrary(section, name); }}
            suggestedName={localSection ? displayName(localSection.type) : undefined}
          />
          </details>
        </>
      )}
    </>
  );

  const shell = (
    <div
      data-testid="theme-editor-shell"
      style={{ "--paper": "var(--card)", "--paper-deep": "var(--background)", "--ink": "var(--foreground)", "--ink-soft": "var(--muted-foreground)", "--line": "var(--border)", "--white": "var(--card)" } as CSSProperties}
      className="admin-store-editor fixed inset-0 z-[60] flex h-dvh flex-col overflow-hidden bg-[var(--paper-deep)] text-[var(--ink)]"
    >
      <WorkspaceToolbar
        themeName={selectedTheme?.name ?? "Theme"}
        viewport={viewport}
        inspector={previewInspectorEnabled}
        themeSelected={selection?.kind === "theme"}
        canUndo={history.canUndo(historyScope) && !isConverting && !isPublishing}
        canRedo={history.canRedo(historyScope) && !isConverting && !isPublishing}
        onBack={() => { if (!isPublishing) void saveQueue.current?.flush().then((saved) => { if (saved) router.push("/admin/online-store"); }); }}
        onSections={() => { setDesktopSidebarOpen(true); setSelection(null); setActiveGlobalId(undefined); setLibraryRegion(undefined); setBlockPickerSectionId(undefined); setMobilePanel("sections"); }}
        onTheme={() => { setDesktopSidebarOpen(true); setSelection({ kind: "theme" }); setActiveGlobalId(undefined); setLibraryRegion(undefined); setBlockPickerSectionId(undefined); setMobilePanel("settings"); }}
        onViewport={setViewport}
        languagePicker={languages.length ? <label className="mr-1 hidden items-center sm:flex"><span className="sr-only">Editing language</span><select aria-label="Editing language" value={activeLanguage ?? ""} onChange={(event) => setEditLanguage(event.target.value || null)} className="h-8 max-w-[130px] rounded-md border border-border bg-card px-2 text-[12px]"><option value="">{mainLanguageName(themeConfiguration?.settings)}</option>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label> : undefined}
        onInspector={() => setPreviewInspectorEnabled((enabled) => !enabled)}
        onUndo={() => { void playHistory("undo"); }}
        onRedo={() => { void playHistory("redo"); }}
        pagePicker={<div inert={isPublishing} className="flex min-w-0 items-center gap-1">          <EditorPagePicker
            templates={templates.map(({ id, type, handle, name }) => ({ id, type, handle, name }))}
            activeTemplateId={activeTemplate.id}
            previewResources={previewResources}
            previewResourceId={previewResourceId}
            previewQuery={previewQuery}
            onTemplateChange={(templateId) => {
              setActiveTemplateId(templateId);
              setSelection(null);
              setActiveGlobalId(undefined);
              invalidatePreview();
              setMobilePanel("sections");
            }}
            onPreviewResourceChange={setPreviewResourceId}
            onPreviewQueryChange={setPreviewQuery}
            onPageTypeChange={(pageType) => {
              const template = pickTemplateForType(templates, pageType);
              if (template) {
                setActiveTemplateId(template.id);
                setSelection(null);
                setActiveGlobalId(undefined);
                invalidatePreview();
                setMobilePanel("sections");
                return;
              }
              if (!api) return;
              void (async () => {
              if (!await saveQueue.current?.flush()) return;
              setSaveState("saving");
              await api.createTemplate(backendStoreId, {
                type: pageType,
                name: `Default ${pageType.charAt(0).toUpperCase()}${pageType.slice(1)}`,
                handle: "default",
                layout: defaultTemplateLayout(pageType),
              }).then((result) => {
                setTemplates((current) => [...current, result.template]);
                setActiveTemplateId(result.template.id);
                setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
                invalidatePreview();
                setMobilePanel("sections");
                setSaveState("saved");
              }).catch((error: unknown) => {
                setSaveError(error instanceof Error ? error.message : "Could not create this page. Try again.");
                setSaveState("error");
              });
              })();
            }}
          />
          <TemplateActions
            api={api}
            storeId={backendStoreId}
            activeTemplate={activeTemplate}
            templates={templates}
            latest={(templateId) => templateDrafts.current.find((item) => item.id === templateId)}
            blankLayout={defaultTemplateLayout(activeTemplate.type)}
            disabled={isPublishing || isConverting}
            flush={() => saveQueue.current?.flush() ?? Promise.resolve(true)}
            onCreated={(template, generation) => {
              setTemplates((current) => [...current, template]);
              setActiveTemplateId(template.id);
              setSelection(null);
              setActiveGlobalId(undefined);
              setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, generation) } : current);
              invalidatePreview();
              setMobilePanel("sections");
            }}
            onUpdated={(template, generation) => {
              setTemplates((current) => current.map((item) => item.id === template.id ? template : item));
              setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, generation) } : current);
            }}
            onDeleted={(templateId, generation) => {
              const remaining = templateDrafts.current.filter((item) => item.id !== templateId);
              setTemplates(remaining);
              setActiveTemplateId(pickTemplateForType(remaining, activeTemplate.type)?.id ?? pickInitialTemplate(remaining)?.id ?? "");
              setSelection(null);
              setActiveGlobalId(undefined);
              setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, generation) } : current);
              invalidatePreview();
            }}
          /></div>}
        actions={<><span role="status" className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${saveState === "error" ? "bg-destructive" : saveState === "saving" ? "bg-muted-foreground/50" : "bg-emerald-500"}`} /><span className="sr-only md:not-sr-only md:max-w-24 md:truncate">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}</span></span>          <PublishControls
            compact
            mobileActions={[
              { label: "Sections", action: () => { setSelection(null); setActiveGlobalId(undefined); setMobilePanel("sections"); } },
              { label: "Theme settings", action: () => { setSelection({ kind: "theme" }); setActiveGlobalId(undefined); setMobilePanel("settings"); } },
              { label: "Desktop preview", action: () => setViewport("desktop") },
              { label: previewInspectorEnabled ? "Turn off preview inspector" : "Turn on preview inspector", action: () => setPreviewInspectorEnabled((enabled) => !enabled) },
              { label: "Undo", action: () => { void playHistory("undo"); }, disabled: !history.canUndo(historyScope) || isPublishing },
              { label: "Redo", action: () => { void playHistory("redo"); }, disabled: !history.canRedo(historyScope) || isPublishing },
            ]}
            historyMenu={<PublishHistory disabled={isPublishing} list={async () => (await api.listPublications(backendStoreId)).publications} restore={async (publicationId) => { await api.restorePublication(backendStoreId, publicationId); }} />}
            onSaveDraft={() => { void saveQueue.current?.flush(); }}
            saveState={saveState}
            flushDraft={() => saveQueue.current?.flush() ?? Promise.resolve(false)}
            onPublishingChange={setIsPublishing}
            generation={workspace.generation}
            diagnostics={diagnostics}
            validate={(generation) => api.validate(backendStoreId, generation)}
            compilePreview={async (generation) => {
              const version = previewVersion.current;
              const result = await api.compilePreview(backendStoreId, generation);
              if (previewVersion.current !== version) throw new Error("Your draft changed while the preview was loading. Try again.");
              return result;
            }}
            publish={(generation, idempotencyKey) => api.publish(backendStoreId, generation, idempotencyKey)}
            refreshWorkspace={() => api.loadWorkspace(backendStoreId)}
            onDiagnostics={(next) => { setDiagnostics(next); if (next.length) { setDesktopSidebarOpen(true); setMobilePanel("settings"); } }}
            onPreview={setPreviewSnapshot}
            onGeneration={(generation) => setWorkspace((current) => current ? { ...current, generation } : current)}
          /></>}
      />

      {restorable && <RestoreSessionBanner summary={describeUnsaved(restorable)} savedAt={restorable.savedAt} onRestore={() => { void restoreLastSession(); }} onDiscard={discardLastSession} />}
      {saveState === "error" && <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-5 py-3 text-xs leading-5 text-destructive"><p><strong>Your changes are still here.</strong> {saveError ?? "They could not be saved."}</p><button type="button" onClick={() => { setSaveError(undefined); void saveQueue.current?.retry(); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-destructive/30 bg-card px-3 font-semibold"><RefreshCw size={13} />Retry saving</button><button type="button" onClick={() => { const data = new Blob([JSON.stringify({ templates: templateDrafts.current, globals: globalDrafts.current, theme: themeDraft.current }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = "jelly-shop-local-changes.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }} className="rounded-lg border border-destructive/30 bg-card px-3 py-2 font-semibold">Download local changes</button><button type="button" onClick={() => { if (!window.confirm("Discard unsaved changes and reload the latest saved workspace? Download your local changes first if you want to keep a copy.")) return; saveQueue.current?.dispose(); saveQueue.current = createRevisionedSaveQueue({ onStatus: setSaveState, onError: (error) => setSaveError(error instanceof Error ? error.message : "Your changes could not be saved.") }); history.clear(); refreshHistory((value) => value + 1); setSaveState("saved"); setSaveError(undefined); setLoadAttempt((value) => value + 1); }} className="rounded-lg border border-destructive/30 bg-card px-3 py-2 font-semibold">Discard local changes and reload</button></div>}


      <EditorPanelNavigation value={mobilePanel} onChange={setMobilePanel} editPanel={selection || activeGlobalId || libraryRegion || blockPickerSectionId ? "settings" : "sections"} />

      <div
        className={clsx(
          "grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-1 bg-muted/50 p-1",
          desktopSidebarOpen
              ? "lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-1"
            : "lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-1",
        )}
        inert={isConverting || isPublishing}
        aria-busy={isConverting || isPublishing}
      >
        <section
          className={clsx(
            "min-h-0 overflow-hidden rounded-xl border border-border bg-card",
            mobilePanel !== "sections" && "hidden",
            desktopSidebarOpen
              ? "lg:col-start-1 lg:row-start-1 lg:border-r lg:border-b-0"
              : "lg:hidden",
          )}
          aria-label="Page structure"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {toolbarTarget && toolbarFound && activeTemplate && (
                <SelectionToolbar
                  target={toolbarTarget}
                  label={toolbarFound.block ? blockLabel(toolbarFound.block.type) : displayName(toolbarFound.section.type)}
                  hidden={toolbarFound.block ? !toolbarFound.block.enabled : !toolbarFound.section.enabled}
                  actions={availableActions(activeTemplate.layout, toolbarTarget)}
                  onAction={(action) => { void runSelectionAction(action); }}
                  siblingIds={siblingIdsFor(activeTemplate.layout, toolbarTarget)}
                  onMove={(beforeId) => { void runMove(beforeId); }}
                  dropLists={toolbarTarget.blockId ? blockDropLists(activeTemplate.layout, toolbarTarget) : undefined}
                  onMoveTo={(parentId, beforeId) => { void runMoveTo(parentId, beforeId); }}
                />
              )}
              <TemplateHierarchy
                template={activeTemplate}
                globalSections={globalLabels}
                selection={selection}
                activeGlobalId={activeGlobalId}
                onSelect={(next) => {
                  setSelection(next);
                  const owningGlobal = next && next.kind !== "theme" ? validGlobals.find((global) => global.section.id === next.sectionId) : undefined;
                  setActiveGlobalId(owningGlobal?.id);
                  setMobilePanel("settings");
                }}
                onGlobalSelect={(globalId) => {
                  setActiveGlobalId(globalId);
                  setSelection(null);
                  setMobilePanel("settings");
                }}
                onAddSection={(region) => {
                  setLibraryRegion(region);
                  setBlockPickerSectionId(undefined);
                  setMobilePanel("settings");
                }}
                onAddBlock={(sectionId, parentId) => {
                  setBlockPickerSectionId(sectionId);
                  setBlockPickerParentId(parentId);
                  setLibraryRegion(undefined);
                  setMobilePanel("settings");
                }}
                onMove={(id, direction) => { void moveSelectedPlacement(id, direction); }}
                onReorder={(from, to) => { void persistLayout(reorderPlacement(activeTemplate.layout, from, to)); }}
                onToggle={(id, enabled) => { void toggleSection(id, enabled); }}
              />
            </div>
          </div>
        </section>

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
              data-jelly-theme={themeConfiguration?.themeId ?? "minimal"}
              data-viewport={viewport}
              data-preview-width={viewport === "desktop" ? 1440 : viewport === "tablet" ? 820 : 390}
              style={previewThemeStyle}
            >
              <ScaledPreview minWidth={viewport === "desktop" ? 1280 : viewport === "tablet" ? 820 : 390}>
              <StorefrontPreviewFrame title="Storefront preview" themeId={themeConfiguration?.themeId ?? "minimal"} style={previewThemeStyle} className="h-full w-full border-0 bg-card">
                <ThemeCustomCss settings={themeConfiguration?.settings} />
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

        <aside
          className={clsx(
            "min-h-0 overflow-y-auto rounded-xl border border-border bg-card",
            mobilePanel !== "settings" && "hidden",
            desktopSidebarOpen
              ? "lg:col-start-1 lg:row-start-1 lg:border-r lg:border-[var(--line)]"
              : "lg:hidden",
          )}
          aria-label="Section settings"
        >
          {selectedGlobal && <p className="mx-3 mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">This shared section appears on other templates. Changes apply everywhere it is used.</p>}
          {renderInspectorPanel()}
        </aside>
      </div>
    </div>
  );
  // The admin shell animates each page's opacity, which creates a stacking context that would trap this
  // full-screen editor under the admin header. Render it on <body> once mounted on the client.
  return mountedOnClient ? createPortal(shell, document.body) : shell;
}
