"use client";

import { useEffect, useMemo, useRef, useState, type ComponentProps, type SetStateAction, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  ArrowLeft,
  ChevronLeft,
  Layers3,
  LayoutPanelTop,
  Monitor,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings2,
  Smartphone,
  Tablet,
  Trash2,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { createRevisionedSaveQueue } from "@/features/store-editor/state/revisioned-save-queue";
import { createSessionHistory } from "@/features/store-editor/state/session-history";
import {
  createSectionFromDefinition,
  getBlockDefinition,
  getSectionDefinition,
  listSectionDefinitionsForPage,
} from "@jelly/storefront-registry";
import { RegistrySectionRenderer, type CommerceDataProvider, type StorefrontPageContext } from "@jelly/storefront-renderer";
import type {
  CompilationDiagnostic,
  CompilationDiagnosticLocation,
  RuntimeStorefrontSnapshotV4,
  RuntimeMenuV4,
  BlockNode,
  SectionNode,
  GlobalSettings,
  RichTextDocument,
  ThemeId,
} from "@jelly/storefront-schema";
import { resolveDesignTokens, resolveTheme } from "@jelly/storefront-themes";
import { expandRuntimeLayout } from "@/features/storefront/resource-loader";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { useAuth } from "@/features/auth/auth-provider";
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
  PageResource,
  WorkspaceRecord,
} from "@/features/store-editor/api/types";
import { GlobalSectionPanel } from "@/features/store-editor/components/global-section-panel";
import { SettingGroups } from "@/features/store-editor/components/inspector/setting-groups";
import { RichTextDocumentEditor } from "@/features/store-editor/components/inspector/rich-text-document-editor";
import { ThemeSettingsPanel } from "@/features/store-editor/components/inspector/theme-settings-panel";
import { PublishControls } from "@/features/store-editor/components/publish-controls";
import { PublishDiagnostics } from "@/features/store-editor/components/publish-diagnostics";
import { EditorPanelNavigation, type EditorPanel } from "@/features/store-editor/components/editor-panel-navigation";
import { SectionLibrary } from "@/features/store-editor/components/section-library";
import { TemplateHierarchy } from "@/features/store-editor/components/template-hierarchy";
import { StorefrontPreviewFrame } from "@/features/store-editor/components/storefront-preview-frame";
import { TemplateResourceSelector } from "@/features/store-editor/components/template-resource-selector";
import { parseEditorNavigationTarget } from "@/features/store-editor/editor-navigation";
import { createEditorPreviewPageContext, editorPreviewResourceOptions } from "@/features/store-editor/preview-context";
import { catalogProductToProduct } from "@/features/storefront/product-presentation";
import type { ConfiguredOptionSelection, Product } from "@/lib/domain";
import type { EditorSelection } from "@/features/store-editor/model/types";
import type { EditorViewport } from "@/features/store-editor/state/types";
import {
  appendBlock,
  appendGlobalPlacement,
  appendInlineSection,
  detachGlobalPlacement,
  movePlacement,
  removeInlineSection,
  replaceInlineWithGlobal,
  setInlineSectionEnabled,
  updateInlineSection,
} from "@/features/store-editor/template-layout";

type RegistrySection = ComponentProps<typeof RegistrySectionRenderer>["section"];

type HierarchyRegion = "header" | "template" | "footer";

const sectionCategoryLabels = {
  layout: "Layout",
  content: "Content",
  commerce: "Products",
} as const;

const defaultTemplateSections: Record<string, string[]> = {
  home: ["hero"], product: ["product-information"], collection: ["collection-header", "collection-product-grid", "collection-description"],
  cart: ["cart-summary"], search: ["search-results"], page: ["page-content"], blog: ["blog-header", "article-list"], article: ["article-header", "article-content"], "not-found": ["not-found-message"],
};

function defaultTemplateLayout(type: string): Record<string, unknown> {
  return { sections: (defaultTemplateSections[type] ?? ["rich-text"]).map((sectionType) => ({ kind: "inline", section: { id: `${type}-${sectionType}`, type: sectionType, enabled: true, settings: {}, blocks: [] } })) };
}

function displayName(value: string): string {
  return value.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function setThemeSetting(settings: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const result = structuredClone(settings);
  const keys = path.split(".");
  let current = result;
  keys.slice(0, -1).forEach((key) => {
    const next = current[key];
    current[key] = next && typeof next === "object" && !Array.isArray(next) ? structuredClone(next) : {};
    current = current[key] as Record<string, unknown>;
  });
  current[keys[keys.length - 1]!] = value;
  return result;
}

function normalizeBlock(value: unknown): SectionNode["blocks"][number] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.type !== "string") return null;
  return {
    id: input.id,
    type: input.type,
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    settings: input.settings && typeof input.settings === "object" && !Array.isArray(input.settings)
      ? structuredClone(input.settings as Record<string, unknown>)
      : {},
    ...(input.responsive && typeof input.responsive === "object" && !Array.isArray(input.responsive)
      ? { responsive: structuredClone(input.responsive) as SectionNode["blocks"][number]["responsive"] }
      : {}),
  };
}

function normalizeSection(value: unknown): SectionNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.type !== "string") return null;
  return {
    id: input.id,
    type: input.type,
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    settings: input.settings && typeof input.settings === "object" && !Array.isArray(input.settings)
      ? structuredClone(input.settings as Record<string, unknown>)
      : {},
    blocks: Array.isArray(input.blocks)
      ? input.blocks.map(normalizeBlock).filter((block): block is NonNullable<ReturnType<typeof normalizeBlock>> => block !== null)
      : [],
    ...(input.responsive && typeof input.responsive === "object" && !Array.isArray(input.responsive)
      ? { responsive: structuredClone(input.responsive) as SectionNode["responsive"] }
      : {}),
  };
}

function templateSections(template: StorefrontTemplateRecord, globals: Map<string, GlobalSectionRecord>): SectionNode[] {
  const placements = template.layout.sections;
  if (!Array.isArray(placements)) return [];
  return placements.flatMap((placement): SectionNode[] => {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) return [];
    const input = placement as Record<string, unknown>;
    if (input.kind === "inline") {
      const section = normalizeSection(input.section);
      return section ? [section] : [];
    }
    if (input.kind === "global" && typeof input.globalSectionId === "string") {
      const section = normalizeSection(globals.get(input.globalSectionId)?.section);
      return section ? [section] : [];
    }
    return [];
  });
}

function draftPreviewLayout(template: StorefrontTemplateRecord, globals: Map<string, GlobalSectionRecord>) {
  const layout = { announcement: [] as SectionNode[], header: [] as SectionNode[], template: [] as SectionNode[], footer: [] as SectionNode[] };
  const placements = template.layout.sections;
  if (!Array.isArray(placements)) return layout;
  for (const placement of placements) {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) continue;
    const input = placement as Record<string, unknown>;
    const section = input.kind === "inline"
      ? normalizeSection(input.section)
      : input.kind === "global" && typeof input.globalSectionId === "string"
        ? normalizeSection(globals.get(input.globalSectionId)?.section)
        : null;
    if (!section) continue;
    const region = section.type === "announcement-bar" ? "announcement"
      : section.type === "header" ? "header"
        : section.type === "footer" ? "footer"
          : "template";
    layout[region].push(section);
  }
  return layout;
}

function selectedInlineSection(template: StorefrontTemplateRecord, selection: EditorSelection): SectionNode | null {
  if (!selection || selection.kind === "theme" || !selection.sectionId) return null;
  const placements = template.layout.sections;
  if (!Array.isArray(placements)) return null;
  for (const placement of placements) {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) continue;
    const input = placement as Record<string, unknown>;
    if (input.kind !== "inline") continue;
    const section = normalizeSection(input.section);
    if (section?.id === selection.sectionId) return section;
  }
  return null;
}

export default function OnlineStoreEditorPage() {
  const { activeStore } = useAuth();
  return <StoreEditorWorkspace key={activeStore?.id ?? "loading"} />;
}

function StoreEditorWorkspace() {
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
  const [mobilePanel, setMobilePanel] = useState<EditorPanel>("sections");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [previewInspectorEnabled, setPreviewInspectorEnabled] = useState(true);
  const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<RuntimeStorefrontSnapshotV4>();
  const [loadError, setLoadError] = useState<string>();
  const [libraryRegion, setLibraryRegion] = useState<HierarchyRegion>();
  const [blockPickerSectionId, setBlockPickerSectionId] = useState<string>();
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string>();
  const [isConverting, setIsConverting] = useState(false);
  const convertingRef = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [history] = useState(() => createSessionHistory<{ kind: "template" | "global" | "theme"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }>());
  const [, refreshHistory] = useState(0);
  const historyScope = `${backendStoreId}:${activeTemplateId}`;
  const recordHistory = (change: { kind: "template" | "global" | "theme"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }) => {
    if (JSON.stringify(change.before) === JSON.stringify(change.after)) return;
    history.push(historyScope, change); refreshHistory((value) => value + 1);
  };
  const saveQueue = useRef<ReturnType<typeof createRevisionedSaveQueue> | null>(null);
  useEffect(() => {
    const queue = createRevisionedSaveQueue({
      onStatus: setSaveState,
      onError: (error) => setSaveError(error instanceof Error ? error.message : "Your changes could not be saved. Try again."),
    });
    saveQueue.current = queue;
    return () => { queue.dispose(); saveQueue.current?.dispose(); saveQueue.current = null; };
  }, [backendStoreId]);

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
      setActiveTemplateId((current) => {
        if (current) return current;
        if (handoff.templateId && nextTemplates.some((template) => template.id === handoff.templateId)) return handoff.templateId;
        return nextTemplates.find((template) => template.type === "home")?.id || nextTemplates[0]?.id || "";
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
    return resolveDesignTokens(resolved.id as ThemeId, resolved.settings as unknown as GlobalSettings);
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
  const selectedBlock = localSection && selection?.kind === "block"
    ? localSection.blocks.find((block) => block.id === selection.blockId)
    : undefined;
  const sectionDefinition = localSection ? getSectionDefinition(localSection.type) : undefined;
  const blockDefinition = selectedBlock ? getBlockDefinition(selectedBlock.type) : undefined;
  const selectedControls = selectedBlock ? blockDefinition?.controls ?? [] : sectionDefinition?.controls ?? [];
  const selectedSettings = selectedBlock?.settings ?? localSection?.settings ?? {};
  const compiledTemplate = activeTemplate && previewSnapshot ? previewSnapshot.templates[activeTemplate.id] : undefined;
  const previewLayout = compiledTemplate && previewSnapshot
    ? expandRuntimeLayout(previewSnapshot, compiledTemplate)
    : activeTemplate ? draftPreviewLayout(activeTemplate, globalMap) : { announcement: [], header: [], template: [], footer: [] };
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
  const selectedTheme = themeCatalog.find((theme) => theme.id === themeConfiguration?.themeId);

  const commerce = useMemo<CommerceDataProvider>(() => ({
    async getProducts() {
      return catalog.products.map((product) => ({
        id: product.id,
        name: product.name,
        href: `/products/${product.slug}`,
        imageUrl: product.imageUrl,
        price: new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.priceMinor / 100),
      }));
    },
  }), [catalog]);

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

  const persistLayout = async (layout: Record<string, unknown>, record = true) => {
    if (convertingRef.current) return false;
    if (!api || !activeTemplate) return false;
    const previous = templateDrafts.current.find((template) => template.id === activeTemplate.id) ?? activeTemplate;
    if (record) recordHistory({ kind: "template", id: previous.id, before: previous.layout, after: layout });
    const draft = { ...previous, layout };
    setTemplates((current) => current.map((template) => template.id === draft.id ? draft : template));
    setPreviewSnapshot(undefined);
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

  const persistThemeSetting = async (path: string, value: unknown, record = true) => {
    if (convertingRef.current) return;
    if (!api || !themeDraft.current) return;
    const previous = themeDraft.current;
    const settings = path ? setThemeSetting(previous.settings, path, value) : value as Record<string, unknown>;
    if (record) recordHistory({ kind: "theme", id: "theme", before: previous.settings, after: settings });
    const draft = { ...previous, settings };
    setThemeConfiguration(draft);
    setPreviewSnapshot(undefined);
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
    setGlobals((current) => current.map((global) => global.id === draft.id ? draft : global));
    setPreviewSnapshot(undefined);
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

  const playHistory = async (direction: "undo" | "redo") => {
    const change = direction === "undo" ? history.undo(historyScope) : history.redo(historyScope);
    if (!change) return;
    refreshHistory((value) => value + 1);
    const value = direction === "undo" ? change.before : change.after;
    if (change.kind === "template") await persistLayout(value, false);
    else if (change.kind === "global") await persistGlobalSection(value as unknown as SectionNode, false, change.id);
    else await persistThemeSetting("", value, false);
  };

  const insertPreset = async (section: SectionNode) => {
    if (!activeTemplate) return;
    if (!await persistLayout(appendInlineSection(activeTemplate.layout, section))) return;
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
    const definition = getBlockDefinition(blockType);
    if (!definition) return;
    const block: BlockNode = {
      id: crypto.randomUUID(),
      type: blockType,
      enabled: true,
      settings: structuredClone(definition.defaultSettings),
    };
    if (!await persistLayout(appendBlock(activeTemplate.layout, blockPickerSection.id, block))) return;
    setSelection({ kind: "block", region: "template", sectionId: blockPickerSection.id, blockId: block.id });
    setBlockPickerSectionId(undefined);
  };

  const removeSelectedSection = async () => {
    if (!activeTemplate || !localSection) return;
    if (!await persistLayout(removeInlineSection(activeTemplate.layout, localSection.id))) return;
    setSelection(null);
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
      name: `Global ${section.type}`,
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
    setPreviewSnapshot(undefined);
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

  const updateSelectedSetting = async (key: string, value: unknown) => {
    if (convertingRef.current) return;
    if (!activeTemplate || !localSection || selection?.kind === "theme") return;
    if (selectedGlobal) {
      await persistGlobalSection(selection?.kind === "block"
        ? { ...localSection, blocks: localSection.blocks.map((block) => block.id === selection.blockId ? { ...block, settings: { ...block.settings, [key]: value } } : block) }
        : { ...localSection, settings: { ...localSection.settings, [key]: value } });
      return;
    }
    if (!selection) return;
    const layout = updateInlineSection(activeTemplate.layout, localSection.id, (current) => {
      if (selection.kind === "block") {
        return {
          ...current,
          blocks: current.blocks.map((block) => block.id === selection.blockId
            ? { ...block, settings: { ...block.settings, [key]: value } }
            : block),
        };
      }
      return { ...current, settings: { ...current.settings, [key]: value } };
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

  const renderPreviewSections = (items: SectionNode[]) => items.map((section) => (
    <RegistrySectionRenderer
      key={section.id}
      section={section as unknown as RegistrySection}
      mode={previewInspectorEnabled ? "editor" : "preview"}
      commerce={commerce}
      region="template"
      themeId={themeConfiguration?.themeId}
      page={previewPageContext ?? undefined}
      menus={previewSnapshot?.menus ?? Object.fromEntries(menuRecords.map((menu) => [menu.handle, { id: menu.id, handle: menu.handle, items: menu.items }])) as Record<string, RuntimeMenuV4>}
      storeSlug={activeStore?.slug}
      selected={previewSnapshot || !previewInspectorEnabled ? undefined : selection ?? undefined}
      onSelect={!previewInspectorEnabled ? undefined : (next) => {
        setPreviewSnapshot(undefined);
        const global = validGlobals.find((item) => item.section.id === next.sectionId);
        if (global) {
          setActiveGlobalId(global.id);
          setSelection(next.kind === "block" && next.blockId ? { kind: "block", region: "template", sectionId: next.sectionId!, blockId: next.blockId } : null);
          setMobilePanel("settings");
          return;
        }
        setActiveGlobalId(undefined);
        if (next.kind === "section" && next.sectionId) {
          setSelection({ kind: "section", region: "template", sectionId: next.sectionId });
          setMobilePanel("settings");
        }
        if (next.kind === "block" && next.sectionId && next.blockId) {
          setSelection({ kind: "block", region: "template", sectionId: next.sectionId, blockId: next.blockId, fieldKey: next.fieldKey });
          setMobilePanel("settings");
        }
      }}
    />
  ));

  const renderInspectorPanel = () => (
    <>
      {selection?.kind === "theme" && (
        <ThemeSettingsPanel
          schema={selectedTheme?.settingsSchema ?? []}
          settings={themeConfiguration?.settings ?? {}}
          saving={false}
          upload={(file, onProgress) => api.uploadMedia(backendStoreId, file, onProgress)}
          onChange={(path, value) => { void persistThemeSetting(path, value); }}
        />
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
              <p className="text-[10px] text-[var(--ink-soft)]">{displayName(libraryRegion)}</p>
              <h2 className="text-[13px] font-semibold">Add section</h2>
            </div>
          </div>
          <SectionLibrary
            presets={presetOptions}
            builtIns={builtInSections}
            onInsertPreset={(section) => { void insertPreset(section); setLibraryRegion(undefined); }}
            onInsertBuiltIn={(sectionType) => { void insertBuiltIn(sectionType); }}
          />
        </>
      )}

      {blockPickerSection && blockPickerDefinition && !libraryRegion && (
        <>
          <div className="flex h-14 items-center gap-2 border-b border-[var(--line)] px-3">
            <button
              type="button"
              aria-label="Back to section settings"
              onClick={() => { setBlockPickerSectionId(undefined); setMobilePanel("settings"); }}
              className="grid size-8 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <p className="text-[10px] text-[var(--ink-soft)]">{displayName(blockPickerSection.type)}</p>
              <h2 className="text-[13px] font-semibold">Add content block</h2>
            </div>
          </div>
          <div className="space-y-1 p-3">
            {blockPickerDefinition.allowedBlockTypes.map((blockType) => (
              <button
                key={blockType}
                type="button"
                onClick={() => { void addBlock(blockType); }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium hover:bg-[var(--paper)]"
              >
                <span className="grid size-8 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)]">
                  <Plus size={15} />
                </span>
                {displayName(blockType)}
              </button>
            ))}
            {blockPickerDefinition.allowedBlockTypes.length === 0 && (
              <p className="py-8 text-center text-[12px] text-[var(--ink-soft)]">This section does not support content blocks.</p>
            )}
          </div>
        </>
      )}

      {localSection && !libraryRegion && !blockPickerSectionId && (
        <>
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label={selectedBlock ? "Back to section settings" : "Back to sections"}
                onClick={() => {
                  setSelection(selectedBlock
                    ? { kind: "section", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id }
                    : null);
                  if (!selectedBlock) setMobilePanel("sections");
                }}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
              >
                <ChevronLeft size={16} />
              </button>
              <LayoutPanelTop size={16} className="text-[var(--ink-soft)]" />
              <div className="min-w-0">
                <p className="text-[10px] text-[var(--ink-soft)]">
                  {selectedBlock && localSection.type !== "rich-text" ? displayName(localSection.type) : "Section settings"}
                </p>
                <p className="truncate text-[13px] font-semibold">
                  {displayName(localSection.type === "rich-text" ? localSection.type : selectedBlock?.type ?? localSection.type)}
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
              />
            ) : (
              <p className="py-8 text-center text-[12px] text-[var(--ink-soft)]">This item has no additional settings.</p>
            )}
          </div>

          {!selectedBlock && !selectedGlobal && localSection.type !== "rich-text" && sectionDefinition && sectionDefinition.allowedBlockTypes.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <button
                type="button"
                onClick={() => setBlockPickerSectionId(localSection.id)}
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
          <p className="mt-1 text-[11px] leading-5 text-[var(--ink-soft)]">Choose a section or content block from the page structure, or add a new section.</p>
        </div>
      )}

      {selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && (
        <>
          <div className="border-y border-[var(--line)] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-soft)]">Global sections</p>
          </div>
          <GlobalSectionPanel
            globalSections={globalOptions}
            localSection={selectedGlobal ? undefined : localSection ?? undefined}
            attachedGlobalId={activeGlobalId}
            onMakeGlobal={(section) => { void makeGlobal(section); }}
            onInsertGlobal={(globalId) => { void insertGlobal(globalId); }}
            onDetachGlobal={(section) => { void detachGlobal(section); }}
          />
        </>
      )}
    </>
  );

  return (
    <div
      data-testid="theme-editor-shell"
      style={{ "--paper": "#fffaf6", "--paper-deep": "#f5efeb", "--ink": "#241f20", "--ink-soft": "#74686c", "--line": "#e8e0db", "--white": "#ffffff" } as CSSProperties}
      className="fixed inset-0 z-[60] flex h-dvh flex-col overflow-hidden bg-[var(--paper-deep)] text-[var(--ink)]"
    >
      <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--line)] bg-[var(--white)] px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-5">
        <div className="flex min-w-0 items-center gap-1">
          <Link
            href="/admin/online-store"
            aria-label="Back to templates"
            onClick={(event) => { event.preventDefault(); void saveQueue.current?.flush().then((saved) => { if (saved) router.push("/admin/online-store"); }); }}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          >
            <ArrowLeft size={17} />
          </Link>

          <button
            type="button"
            aria-label={desktopSidebarOpen ? "Hide editor sidebar" : "Show editor sidebar"}
            aria-pressed={desktopSidebarOpen}
            onClick={() => setDesktopSidebarOpen((open) => !open)}
            className="hidden size-9 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)] lg:grid"
          >
            {desktopSidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>

          <div className="hidden items-center gap-1 lg:flex">
            <button
              type="button"
              aria-label="Sections"
              title="Sections"
              onClick={() => {
                setDesktopSidebarOpen(true);
                setSelection(null);
                setLibraryRegion(undefined);
                setBlockPickerSectionId(undefined);
                setMobilePanel("sections");
              }}
              className={clsx(
                "grid size-9 place-items-center rounded-lg",
                selection?.kind !== "theme" ? "bg-[var(--paper)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]",
              )}
            >
              <Layers3 size={17} />
            </button>
            <button
              type="button"
              aria-label="Theme settings"
              title="Theme settings"
              onClick={() => {
                setDesktopSidebarOpen(true);
                setSelection({ kind: "theme" });
                setActiveGlobalId(undefined);
                setLibraryRegion(undefined);
                setBlockPickerSectionId(undefined);
                setMobilePanel("settings");
              }}
              className={clsx(
                "grid size-9 place-items-center rounded-lg",
                selection?.kind === "theme" ? "bg-[var(--paper)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]",
              )}
            >
              <Settings2 size={17} />
            </button>
          </div>

          <div className="ml-1 min-w-0">
            <p className="hidden text-[11px] text-[var(--ink-soft)] sm:block">{activeStore?.name} / Store editor</p>
            <h1 className="truncate text-sm font-semibold">Theme editor</h1>
          </div>
        </div>

        <div className="order-last col-span-2 mx-auto flex items-center gap-1 rounded-xl bg-[var(--paper-deep)] p-1 sm:order-none sm:col-span-1">
          <button
            type="button"
            aria-label="Toggle preview inspector"
            title="Preview inspector"
            aria-pressed={previewInspectorEnabled}
            onClick={() => setPreviewInspectorEnabled((enabled) => !enabled)}
            className={clsx(
              "grid size-8 place-items-center rounded-lg",
              previewInspectorEnabled ? "bg-[var(--white)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)]",
            )}
          >
            <MousePointer2 size={15} />
          </button>
          <span className="mx-0.5 h-4 w-px bg-[var(--line)]" aria-hidden="true" />
          {([
            ["desktop", "Desktop preview", Monitor],
            ["tablet", "Tablet preview", Tablet],
            ["mobile", "Mobile preview", Smartphone],
          ] as const).map(([viewportValue, label, Icon]) => (
            <button
              key={viewportValue}
              type="button"
              aria-label={label}
              title={`${label.replace(" preview", "")} · ${viewportValue === "desktop" ? 1440 : viewportValue === "tablet" ? 820 : 390}px`}
              aria-pressed={viewport === viewportValue}
              onClick={() => setViewport(viewportValue)}
              className={clsx(
                "grid size-8 place-items-center rounded-lg",
                viewport === viewportValue ? "bg-[var(--white)] text-[var(--ink)] shadow-sm" : "text-[var(--ink-soft)] hover:text-[var(--ink)]",
              )}
            >
              <Icon size={15} />
            </button>
          ))}
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <button type="button" aria-label="Undo last editor change" disabled={!history.canUndo(historyScope) || isConverting} onClick={() => { void playHistory("undo"); }} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs disabled:opacity-40">Undo</button>
          <button type="button" aria-label="Redo editor change" disabled={!history.canRedo(historyScope) || isConverting} onClick={() => { void playHistory("redo"); }} className="rounded-lg border border-[var(--line)] px-3 py-2 text-xs disabled:opacity-40">Redo</button>
          <div className="hidden text-right xl:block" role="status">
            <p className={clsx(
              "text-[10px]",
              saveState === "error" ? "text-[var(--destructive)]" : "text-[var(--ink-soft)]",
            )}>
              {saveState === "saving" ? "Saving changes…" : saveState === "error" ? "Changes not saved" : "All changes saved"}
            </p>
            <p className="text-[11px] font-medium text-[var(--ink-soft)]">Private until published</p>
          </div>
          <PublishControls
            saveState={saveState}
            generation={workspace.generation}
            diagnostics={diagnostics}
            validate={(generation) => api.validate(backendStoreId, generation)}
            compilePreview={(generation) => api.compilePreview(backendStoreId, generation)}
            publish={(generation, idempotencyKey) => api.publish(backendStoreId, generation, idempotencyKey)}
            refreshWorkspace={() => api.loadWorkspace(backendStoreId)}
            onDiagnostics={setDiagnostics}
            onPreview={setPreviewSnapshot}
            onGeneration={(generation) => setWorkspace((current) => current ? { ...current, generation } : current)}
          />
        </div>
      </header>

      {saveState === "error" && <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-5 py-3 text-xs leading-5 text-red-800"><p><strong>Your changes are still here.</strong> {saveError ?? "They could not be saved."}</p><button type="button" onClick={() => { setSaveError(undefined); void saveQueue.current?.retry(); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 font-semibold"><RefreshCw size={13} />Retry saving</button><button type="button" onClick={() => { const data = new Blob([JSON.stringify({ templates: templateDrafts.current, globals: globalDrafts.current, theme: themeDraft.current }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = "jelly-shop-local-changes.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }} className="rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold">Download local changes</button><button type="button" onClick={() => { if (!window.confirm("Discard unsaved changes and reload the latest saved workspace? Download your local changes first if you want to keep a copy.")) return; saveQueue.current?.dispose(); saveQueue.current = createRevisionedSaveQueue({ onStatus: setSaveState, onError: (error) => setSaveError(error instanceof Error ? error.message : "Your changes could not be saved.") }); history.clear(); refreshHistory((value) => value + 1); setSaveState("saved"); setSaveError(undefined); setLoadAttempt((value) => value + 1); }} className="rounded-lg border border-red-200 bg-white px-3 py-2 font-semibold">Discard local changes and reload</button></div>}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--line)] bg-[#fff5f6] px-4 py-2 text-[11px] text-[var(--ink-soft)] sm:px-5"><span className="flex items-center gap-2"><Sparkles size={13} className="text-[#9b5266]" />{previewSnapshot ? "Compiled preview. Select a section or change a setting to continue editing." : "Select a section in your preview to make it your own."}</span><span className="flex shrink-0 items-center gap-1.5 xl:hidden">{saveState === "saving" ? <Loader2 size={12} className="animate-spin motion-reduce:animate-none" /> : <CheckCircle2 size={12} />}{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}</span></div>

      <div className="shrink-0 border-b border-[var(--line)] bg-[var(--white)]">
        <div className="mx-auto max-w-[1200px]">
          <TemplateResourceSelector
            templates={templates.map(({ id, type, handle, name }) => ({ id, type, handle, name }))}
            activeTemplateId={activeTemplate.id}
            previewResources={previewResources}
            previewResourceId={previewResourceId}
            previewQuery={previewQuery}
            onTemplateChange={(templateId) => {
              setActiveTemplateId(templateId);
              setSelection(null);
              setActiveGlobalId(undefined);
              setPreviewSnapshot(undefined);
              setMobilePanel("sections");
            }}
            onPreviewResourceChange={setPreviewResourceId}
            onPreviewQueryChange={setPreviewQuery}
            onPageTypeChange={(pageType) => {
              const template = templates.find((entry) => entry.type === pageType);
              if (template) {
                setActiveTemplateId(template.id);
                setSelection(null);
                setActiveGlobalId(undefined);
                setPreviewSnapshot(undefined);
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
                setPreviewSnapshot(undefined);
                setMobilePanel("sections");
                setSaveState("saved");
              }).catch((error: unknown) => {
                setSaveError(error instanceof Error ? error.message : "Could not create this page. Try again.");
                setSaveState("error");
              });
              })();
            }}
          />
        </div>
      </div>

      <EditorPanelNavigation value={mobilePanel} onChange={setMobilePanel} />

      <div
        className={clsx(
          "grid min-h-0 flex-1 grid-cols-1 grid-rows-1",
          desktopSidebarOpen
              ? "lg:grid-cols-[260px_minmax(0,1fr)_300px] lg:grid-rows-1 min-[1600px]:grid-cols-[290px_minmax(0,1fr)_340px]"
            : "lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-1",
        )}
        inert={isConverting}
        aria-busy={isConverting}
      >
        <section
          className={clsx(
            "min-h-0 overflow-hidden border-b border-[var(--line)] bg-[var(--white)]",
            mobilePanel !== "sections" && "hidden lg:block",
            desktopSidebarOpen
              ? "lg:col-start-1 lg:row-start-1 lg:border-r lg:border-b-0"
              : "lg:hidden",
          )}
          aria-label="Page structure"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--line)] px-3">
              <div className="flex items-center gap-2">
                <Layers3 size={15} className="text-[var(--ink-soft)]" />
                <h2 className="text-[13px] font-semibold">Page structure</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelection({ kind: "theme" });
                  setActiveGlobalId(undefined);
                  setLibraryRegion(undefined);
                  setBlockPickerSectionId(undefined);
                  setMobilePanel("settings");
                }}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-[var(--ink-soft)] hover:bg-[var(--paper)] hover:text-[var(--ink)] min-[1600px]:hidden"
              >
                Theme settings
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
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
                onAddBlock={(sectionId) => {
                  setBlockPickerSectionId(sectionId);
                  setLibraryRegion(undefined);
                  setMobilePanel("settings");
                }}
                onMove={(id, direction) => { void moveSelectedPlacement(id, direction); }}
                onToggle={(id, enabled) => { void toggleSection(id, enabled); }}
              />
            </div>
          </div>
        </section>

        <main
          className={clsx(
            "min-h-0 min-w-0 overflow-auto bg-[var(--paper-deep)] p-2 sm:p-3 lg:p-5",
            mobilePanel !== "preview" && "hidden lg:block",
            desktopSidebarOpen
              ? "lg:col-start-2 lg:row-start-1"
              : "lg:col-start-1 lg:row-start-1",
          )}
          aria-label="Storefront preview"
        >
          {previewSnapshot && (
            <div className="mx-auto mb-3 max-w-[1440px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-medium text-emerald-800">
              Compiled preview · generation {previewSnapshot.sourceGeneration}
            </div>
          )}

          <div className="mx-auto flex min-h-full w-full items-start justify-center">
            <div
              className={clsx(
                "min-h-full w-full overflow-hidden rounded-sm border border-[var(--line)] bg-[var(--white)] shadow-[0_8px_28px_rgba(0,0,0,0.08)] transition-[max-width] duration-200",
                viewport === "desktop" && "max-w-[1440px]",
                viewport === "tablet" && "max-w-[820px]",
                viewport === "mobile" && "max-w-[390px]",
              )}
              data-testid="preview-viewport"
              data-jelly-theme={themeConfiguration?.themeId ?? "minimal"}
              data-viewport={viewport}
              data-preview-width={viewport === "desktop" ? 1440 : viewport === "tablet" ? 820 : 390}
              style={previewThemeStyle}
            >
              <StorefrontPreviewFrame title="Storefront preview" themeId={themeConfiguration?.themeId ?? "minimal"} style={previewThemeStyle} className="h-[calc(100dvh-230px)] min-h-[420px] w-full border-0 bg-white">
                {renderPreviewSections([...previewLayout.announcement, ...previewLayout.header])}
                <div data-storefront-template>
                  {renderPreviewSections(previewLayout.template)}
                  {previewLayout.template.length === 0 && (
                    <div className="grid min-h-[360px] place-items-center p-8 text-center text-sm text-[var(--ink-soft)]">
                      This template has no sections yet.
                    </div>
                  )}
                </div>
                {renderPreviewSections(previewLayout.footer)}
              </StorefrontPreviewFrame>
            </div>
          </div>
        </main>

        <aside
          className={clsx(
            "min-h-0 overflow-y-auto bg-[var(--white)]",
            mobilePanel !== "settings" && "hidden lg:block",
            desktopSidebarOpen
              ? "lg:col-start-3 lg:row-start-1 lg:border-l lg:border-[var(--line)]"
              : "lg:hidden",
          )}
          aria-label="Section settings"
        >
          {renderInspectorPanel()}
        </aside>
      </div>
    </div>
  );
}
