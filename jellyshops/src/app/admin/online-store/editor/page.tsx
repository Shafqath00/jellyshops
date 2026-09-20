"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, ChevronLeft, LayoutPanelTop, Monitor, Plus, Smartphone, Tablet, Trash2 } from "lucide-react";
import {
  createSectionFromDefinition,
  getBlockDefinition,
  getSectionDefinition,
  listSectionDefinitions,
} from "@jelly/storefront-registry";
import { RegistrySectionRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type {
  CompilationDiagnostic,
  CompilationDiagnosticLocation,
  RuntimeStorefrontSnapshotV4,
  BlockNode,
  SectionNode,
  GlobalSettings,
  ThemeId,
} from "@jelly/storefront-schema";
import { resolveDesignTokens, resolveTheme } from "@jelly/storefront-themes";
import { expandRuntimeTemplate } from "@/features/storefront/resource-loader";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { useAuth } from "@/features/auth/auth-provider";
import type {
  DemoCatalog,
  DynamicSourceDescriptor,
  GlobalSectionRecord,
  SectionPresetRecord,
  StorefrontTemplateRecord,
  ThemeCatalogEntry,
  ThemeConfigurationRecord,
  WorkspaceRecord,
} from "@/features/store-editor/api/types";
import { GlobalSectionPanel } from "@/features/store-editor/components/global-section-panel";
import { ThemedStorefrontShell } from "@/components/storefront-shell";
import { SettingGroups } from "@/features/store-editor/components/inspector/setting-groups";
import { ThemeSettingsPanel } from "@/features/store-editor/components/inspector/theme-settings-panel";
import { PublishControls } from "@/features/store-editor/components/publish-controls";
import { PublishDiagnostics } from "@/features/store-editor/components/publish-diagnostics";
import { SectionLibrary } from "@/features/store-editor/components/section-library";
import { TemplateHierarchy } from "@/features/store-editor/components/template-hierarchy";
import { TemplateResourceSelector, type PreviewResourceOption } from "@/features/store-editor/components/template-resource-selector";
import { parseEditorNavigationTarget } from "@/features/store-editor/editor-navigation";
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

type HierarchyRegion = "header" | "template" | "footer";

const sectionCategoryLabels = {
  layout: "Layout",
  content: "Content",
  commerce: "Products",
} as const;

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

function resourceOptions(
  template: StorefrontTemplateRecord | undefined,
  catalog: DemoCatalog,
  handoff: ReturnType<typeof parseEditorNavigationTarget>,
): PreviewResourceOption[] {
  if (!template) return [];
  const options = template.type === "product"
    ? catalog.products.map((product) => ({ id: product.id, label: product.name }))
    : template.type === "collection"
      ? catalog.collections.map((collection) => ({ id: collection.id, label: collection.name }))
      : [];
  if (handoff.resourceId && handoff.resourceType === template.type && !options.some((option) => option.id === handoff.resourceId)) {
    options.push({ id: handoff.resourceId, label: `Selected ${handoff.resourceType}` });
  }
  return options;
}

export default function OnlineStoreEditorPage() {
  const { session, activeStore } = useAuth();
  const backendStoreId = activeStore?.id ?? "";
  const token = session?.access_token;
  const api = useMemo(() => (token && backendStoreId) ? createStoreEditorApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
  }) : null, [token, backendStoreId]);
  const [handoff] = useState(() => typeof window === "undefined" ? {} : parseEditorNavigationTarget(window.location.search));

  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [templates, setTemplates] = useState<StorefrontTemplateRecord[]>([]);
  const [globals, setGlobals] = useState<GlobalSectionRecord[]>([]);
  const [presets, setPresets] = useState<SectionPresetRecord[]>([]);
  const [dynamicSources, setDynamicSources] = useState<DynamicSourceDescriptor[]>([]);
  const [catalog, setCatalog] = useState<DemoCatalog>({ products: [], collections: [] });
  const [themeCatalog, setThemeCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [themeConfiguration, setThemeConfiguration] = useState<ThemeConfigurationRecord | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [previewResourceId, setPreviewResourceId] = useState<string | undefined>(handoff.resourceId);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [activeGlobalId, setActiveGlobalId] = useState<string>();
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<RuntimeStorefrontSnapshotV4>();
  const [loadError, setLoadError] = useState<string>();
  const [libraryRegion, setLibraryRegion] = useState<HierarchyRegion>();
  const [blockPickerSectionId, setBlockPickerSectionId] = useState<string>();
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [themeSaveState, setThemeSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [themeSaveError, setThemeSaveError] = useState<string>();

  useEffect(() => {
    if (!api) return;
    let active = true;
    void Promise.all([
      api.loadWorkspace(backendStoreId),
      api.listTemplates(backendStoreId),
      api.listGlobalSections(backendStoreId),
      api.listPresets(backendStoreId),
      api.listCatalog(),
      api.listThemeCatalog(backendStoreId),
      api.getThemeConfiguration(backendStoreId),
    ]).then(([nextWorkspace, nextTemplates, nextGlobals, nextPresets, nextCatalog, nextThemeCatalog, nextThemeConfiguration]) => {
      if (!active) return;
      setWorkspace(nextWorkspace);
      setTemplates(nextTemplates);
      setGlobals(nextGlobals);
      setPresets(nextPresets);
      setCatalog(nextCatalog);
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
  }, [api, backendStoreId, handoff]);

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
    () => resourceOptions(activeTemplate, catalog, handoff),
    [activeTemplate, catalog, handoff],
  );
  const globalLabels = useMemo(() => Object.fromEntries(validGlobals.map((global) => [
    global.id,
    {
      id: global.id,
      name: global.name,
      sectionType: typeof global.section.type === "string" ? global.section.type : undefined,
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
  const localSection = activeTemplate ? selectedInlineSection(activeTemplate, selection) : null;
  const selectedBlock = localSection && selection?.kind === "block"
    ? localSection.blocks.find((block) => block.id === selection.blockId)
    : undefined;
  const sectionDefinition = localSection ? getSectionDefinition(localSection.type) : undefined;
  const blockDefinition = selectedBlock ? getBlockDefinition(selectedBlock.type) : undefined;
  const selectedControls = selectedBlock ? blockDefinition?.controls ?? [] : sectionDefinition?.controls ?? [];
  const selectedSettings = selectedBlock?.settings ?? localSection?.settings ?? {};
  const compiledTemplate = activeTemplate && previewSnapshot ? previewSnapshot.templates[activeTemplate.id] : undefined;
  const renderedSections = compiledTemplate && previewSnapshot ? expandRuntimeTemplate(previewSnapshot, compiledTemplate) : sections;
  const builtInSections = useMemo(() => {
    if (!activeTemplate || !libraryRegion) return [];
    return listSectionDefinitions()
      .filter((definition) =>
        definition.supportedPages.includes(activeTemplate.type as "home" | "product" | "collection")
        && (definition.allowedRegions ?? ["template"]).includes(libraryRegion))
      .map((definition) => ({
        id: definition.type,
        name: displayName(definition.type),
        category: sectionCategoryLabels[definition.category],
      }));
  }, [activeTemplate, libraryRegion]);
  const blockPickerSection = sections.find((section) => section.id === blockPickerSectionId);
  const blockPickerDefinition = blockPickerSection ? getSectionDefinition(blockPickerSection.type) : undefined;
  const selectedTheme = themeCatalog.find((theme) => theme.id === themeConfiguration?.themeId);
  const toolsOpen = Boolean(libraryRegion || blockPickerSectionId || localSection || activeGlobalId || selection?.kind === "theme");

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

  const persistLayout = async (layout: Record<string, unknown>) => {
    if (!api || !activeTemplate) return;
    setSaveState("saving");
    try {
      const result = await api.updateTemplate(
        backendStoreId,
        activeTemplate.id,
        activeTemplate.revision,
        { layout },
      );
      setTemplates((current) => current.map((template) => template.id === result.template.id ? result.template : template));
      setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
      setPreviewSnapshot(undefined);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  };

  const persistThemeSetting = async (path: string, value: unknown) => {
    if (!api || !themeConfiguration || themeSaveState === "saving") return;
    const previous = themeConfiguration;
    const settings = setThemeSetting(previous.settings, path, value);
    setThemeConfiguration({ ...previous, settings });
    setThemeSaveState("saving");
    setThemeSaveError(undefined);
    try {
      const result = await api.saveThemeConfiguration(backendStoreId, previous.revision, {
        themeId: previous.themeId,
        themeVersion: previous.themeVersion,
        settings,
        draftArtifactId: previous.draftArtifactId ?? null,
      });
      setThemeConfiguration(result.theme);
      setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
      setPreviewSnapshot(undefined);
      setThemeSaveState("saved");
    } catch (error) {
      setThemeConfiguration(previous);
      setThemeSaveState("error");
      setThemeSaveError(error instanceof Error ? error.message : "Unable to save theme settings.");
    }
  };

  const insertPreset = async (section: SectionNode) => {
    if (!activeTemplate) return;
    await persistLayout(appendInlineSection(activeTemplate.layout, section));
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
    await persistLayout(appendBlock(activeTemplate.layout, blockPickerSection.id, block));
    setSelection({ kind: "block", region: "template", sectionId: blockPickerSection.id, blockId: block.id });
    setBlockPickerSectionId(undefined);
  };

  const removeSelectedSection = async () => {
    if (!activeTemplate || !localSection) return;
    await persistLayout(removeInlineSection(activeTemplate.layout, localSection.id));
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
    await persistLayout(appendGlobalPlacement(activeTemplate.layout, globalSectionId));
    setActiveGlobalId(globalSectionId);
    setSelection(null);
  };

  const makeGlobal = async (section: SectionNode) => {
    if (!api || !activeTemplate) return;
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
      activeTemplate.revision,
      { layout: replaceInlineWithGlobal(activeTemplate.layout, section.id, created.globalSection.id) },
    );
    setTemplates((current) => current.map((template) => template.id === result.template.id ? result.template : template));
    setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
    setPreviewSnapshot(undefined);
    setSelection(null);
    setActiveGlobalId(created.globalSection.id);
  };

  const detachGlobal = async (section: SectionNode) => {
    if (!activeTemplate || !activeGlobalId) return;
    await persistLayout(detachGlobalPlacement(activeTemplate.layout, activeGlobalId, section));
    setActiveGlobalId(undefined);
    setSelection({ kind: "section", region: "template", sectionId: section.id });
  };

  const updateSelectedSetting = async (key: string, value: unknown) => {
    if (!activeTemplate || !localSection || !selection || selection.kind === "theme") return;
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
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center"><div><h1 className="text-xl font-semibold">Online Store editor is disabled</h1><p className="mt-2 text-sm text-[#6d7175]">Connect merchant authentication to use the editor.</p></div></main>;
  }

  if (loadError) {
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center"><div><h1 className="text-xl font-semibold">Could not load Online Store</h1><p className="mt-2 text-sm text-[#b42318]">{loadError}</p></div></main>;
  }

  if (!workspace) {
    return <main className="grid min-h-[70vh] place-items-center text-[13px] text-[#616161]" aria-live="polite">Loading Online Store editor…</main>;
  }

  if (templates.length === 0) {
    return (
      <main className="grid min-h-[70vh] place-items-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">No theme installed</h1>
          <p className="mt-2 text-sm text-[#6d7175]">Please choose a template from the Online Store overview to get started.</p>
          <Link href="/admin/online-store" className="mt-4 inline-block text-sm font-semibold text-[#315e24] hover:underline">Go to Online Store</Link>
        </div>
      </main>
    );
  }

  if (!activeTemplate) {
    return <main className="grid min-h-[70vh] place-items-center text-[13px] text-[#616161]" aria-live="polite">Loading template…</main>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex h-dvh flex-col overflow-hidden bg-[#f4f4f5] text-[#303030]">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-[#e3e3e3] bg-white px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/admin" aria-label="Back to admin" className="grid size-8 place-items-center rounded-lg text-[#616161] hover:bg-[#f1f1f1]"><ArrowLeft size={17} /></Link>
          <div className="min-w-0"><p className="text-[10px] text-[#8c9196]">Online Store</p><h1 className="truncate text-[13px] font-semibold">Theme editor</h1></div>
        </div>
        <div className="flex items-center rounded-lg bg-[#f1f1f1] p-1" aria-label="Preview device">
          {([
            ["desktop", "Desktop preview", Monitor],
            ["tablet", "Tablet preview", Tablet],
            ["mobile", "Mobile preview", Smartphone],
          ] as const).map(([viewportValue, label, Icon]) => (
            <button key={viewportValue} type="button" aria-label={label} aria-pressed={viewport === viewportValue} onClick={() => setViewport(viewportValue)} className={clsx("grid size-7 place-items-center rounded-md", viewport === viewportValue ? "bg-white shadow-sm" : "text-[#8c9196]")}><Icon size={15} /></button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right lg:block"><p className="text-[10px] text-[#8c9196]">{saveState === "saving" ? "Saving changes…" : saveState === "error" ? "Save failed" : "All changes saved"}</p><p className="text-[12px] font-semibold">Generation {workspace.generation}</p></div>
          <PublishControls
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

      <TemplateResourceSelector
        templates={templates.map(({ id, type, handle, name }) => ({ id, type, handle, name }))}
        activeTemplateId={activeTemplate.id}
        previewResources={previewResources}
        previewResourceId={previewResourceId}
        onTemplateChange={(templateId) => { setActiveTemplateId(templateId); setSelection(null); setActiveGlobalId(undefined); setPreviewSnapshot(undefined); }}
        onPreviewResourceChange={setPreviewResourceId}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)]">
        <div className={clsx("col-start-1 row-start-1 min-h-0 border-r border-[#e3e3e3] bg-white", toolsOpen && "hidden")}>
          <button type="button" onClick={() => { setSelection({ kind: "theme" }); setActiveGlobalId(undefined); }} className="m-2 flex min-h-9 w-[calc(100%-1rem)] items-center rounded-lg px-3 text-left text-[12px] font-semibold text-[#454f5b] hover:bg-[#f6f6f7]">Theme settings</button>
          <TemplateHierarchy
            template={activeTemplate}
            globalSections={globalLabels}
            selection={selection}
            activeGlobalId={activeGlobalId}
            onSelect={(next) => { setSelection(next); setActiveGlobalId(undefined); }}
            onGlobalSelect={(globalId) => { setActiveGlobalId(globalId); setSelection(null); }}
            onAddSection={(region) => { setLibraryRegion(region); setBlockPickerSectionId(undefined); }}
            onAddBlock={(sectionId) => { setBlockPickerSectionId(sectionId); setLibraryRegion(undefined); }}
            onMove={(id, direction) => { void moveSelectedPlacement(id, direction); }}
            onToggle={(id, enabled) => { void toggleSection(id, enabled); }}
          />
        </div>

        <main className="col-start-2 row-start-1 min-h-0 overflow-auto p-4" aria-label="Storefront preview">
          {previewSnapshot && <div className="mx-auto mb-2 max-w-[1440px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-medium text-emerald-800">Compiled preview · generation {previewSnapshot.sourceGeneration}</div>}
          <div className={clsx(
            "mx-auto min-h-full overflow-hidden border border-[#dcdcdc] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-[max-width]",
            viewport === "desktop" && "max-w-[1440px]",
            viewport === "tablet" && "max-w-[820px]",
            viewport === "mobile" && "max-w-[390px]",
          )} data-testid="preview-viewport" data-viewport={viewport} style={previewThemeStyle}>
            <ThemedStorefrontShell themeId={themeConfiguration?.themeId} settings={themeConfiguration?.settings ?? {}} store={{ name: activeStore?.name ?? "Your store", slug: activeStore?.slug ?? "store" }} navigation={[{ label: "Home", href: "#home" }, { label: "Shop", href: "#shop" }]} cartCount={0} cart={null} onCartOpen={() => undefined}>
            {renderedSections.map((section) => (
              <RegistrySectionRenderer
                key={section.id}
                section={section}
                mode={previewSnapshot ? "preview" : "editor"}
                commerce={commerce}
                region="template"
                themeId={themeConfiguration?.themeId}
                selected={previewSnapshot ? undefined : selection ?? undefined}
                onSelect={previewSnapshot ? undefined : (next) => {
                  setActiveGlobalId(undefined);
                  if (next.kind === "section" && next.sectionId) setSelection({ kind: "section", region: "template", sectionId: next.sectionId });
                  if (next.kind === "block" && next.sectionId && next.blockId) setSelection({ kind: "block", region: "template", sectionId: next.sectionId, blockId: next.blockId, fieldKey: next.fieldKey });
                }}
              />
            ))}
            {renderedSections.length === 0 && <div className="grid min-h-[360px] place-items-center p-8 text-center text-sm text-[#8c9196]">This template has no sections yet.</div>}
            </ThemedStorefrontShell>
          </div>
        </main>

        <aside className={clsx("col-start-1 row-start-1 min-h-0 overflow-y-auto border-r border-[#e3e3e3] bg-white", !toolsOpen && "hidden")} aria-label="Section tools">
          {selection?.kind === "theme" && <ThemeSettingsPanel
            schema={selectedTheme?.settingsSchema ?? []}
            settings={themeConfiguration?.settings ?? {}}
            saving={themeSaveState === "saving"}
            error={themeSaveError}
            upload={(file, onProgress) => api.uploadMedia(backendStoreId, file, onProgress)}
            onChange={(path, value) => { void persistThemeSetting(path, value); }}
          />}
          {diagnostics.length > 0 && <div className="border-b border-[#eeeeee] p-3">
            <PublishDiagnostics diagnostics={diagnostics} onOpen={openDiagnostic} />
          </div>}

          {libraryRegion && (
            <>
              <div className="flex h-14 items-center gap-2 border-b border-[#eeeeee] px-3">
                <button type="button" aria-label="Back to sections" onClick={() => setLibraryRegion(undefined)} className="grid size-8 place-items-center rounded-lg text-[#616161] hover:bg-[#f1f1f1]"><ChevronLeft size={16} /></button>
                <div><p className="text-[10px] text-[#8c9196]">{displayName(libraryRegion)}</p><h2 className="text-[13px] font-semibold">Add section</h2></div>
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
              <div className="flex h-14 items-center gap-2 border-b border-[#eeeeee] px-3">
                <button type="button" aria-label="Back to section settings" onClick={() => setBlockPickerSectionId(undefined)} className="grid size-8 place-items-center rounded-lg text-[#616161] hover:bg-[#f1f1f1]"><ChevronLeft size={16} /></button>
                <div><p className="text-[10px] text-[#8c9196]">{displayName(blockPickerSection.type)}</p><h2 className="text-[13px] font-semibold">Add content block</h2></div>
              </div>
              <div className="space-y-1 p-3">
                {blockPickerDefinition.allowedBlockTypes.map((blockType) => (
                  <button key={blockType} type="button" onClick={() => { void addBlock(blockType); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium hover:bg-[#f2eff7]">
                    <span className="grid size-8 place-items-center rounded-lg border border-[#e3e3e3] text-[#6f5b92]"><Plus size={15} /></span>
                    {displayName(blockType)}
                  </button>
                ))}
                {blockPickerDefinition.allowedBlockTypes.length === 0 && <p className="py-8 text-center text-[12px] text-[#8c9196]">This section does not support content blocks.</p>}
              </div>
            </>
          )}

          {localSection && !libraryRegion && !blockPickerSectionId && (
            <>
              <div className="flex min-h-14 items-center justify-between gap-3 border-b border-[#eeeeee] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={selectedBlock ? "Back to section settings" : "Back to sections"}
                    onClick={() => setSelection(selectedBlock ? { kind: "section", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id } : null)}
                    className="grid size-8 shrink-0 place-items-center rounded-lg text-[#616161] hover:bg-[#f1f1f1]"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <LayoutPanelTop size={16} className="text-[#6f5b92]" />
                  <div className="min-w-0"><p className="text-[10px] text-[#8c9196]">{selectedBlock ? displayName(localSection.type) : "Section settings"}</p><p className="truncate text-[13px] font-semibold">{displayName(selectedBlock?.type ?? localSection.type)}</p></div>
                </div>
                {!selectedBlock && <button type="button" aria-label="Remove section" onClick={() => { void removeSelectedSection(); }} className="grid size-8 place-items-center rounded-lg text-[#9b3a32] hover:bg-[#fff1f0]"><Trash2 size={15} /></button>}
              </div>
              <div className="border-b border-[#eeeeee] px-4 py-4">
                {selectedControls.length > 0 ? <SettingGroups
                    controls={selectedControls}
                    settings={selectedSettings}
                    catalog={catalog}
                    upload={(file, onProgress) => api.uploadMedia(backendStoreId, file, onProgress)}
                    dynamicSources={dynamicSources}
                    onChange={(key, nextValue) => { void updateSelectedSetting(key, nextValue); }}
                  /> : <p className="py-8 text-center text-[12px] text-[#8c9196]">This item has no additional settings.</p>}
              </div>
              {!selectedBlock && sectionDefinition && sectionDefinition.allowedBlockTypes.length > 0 && (
                <div className="border-b border-[#eeeeee] p-3">
                  <button
                    type="button"
                    onClick={() => setBlockPickerSectionId(localSection.id)}
                    className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d8d1e3] bg-[#f7f4fb] px-3 text-[12px] font-semibold text-[#624d86] hover:bg-[#eee8f7]"
                  >
                    <Plus size={15} /> Add content block
                  </button>
                </div>
              )}
            </>
          )}

          {!localSection && selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && <div className="px-6 py-12 text-center"><LayoutPanelTop className="mx-auto text-[#b4a8c9]" size={28} /><p className="mt-3 text-[13px] font-semibold">Select a section to edit</p><p className="mt-1 text-[11px] leading-5 text-[#8c9196]">Choose a section or content block from the left panel, or add a new section.</p></div>}

          {selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && <div className="border-y border-[#eeeeee] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Global sections</p>
          </div>}
          {selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && <GlobalSectionPanel
            globalSections={globalOptions}
            localSection={localSection ?? undefined}
            attachedGlobalId={activeGlobalId}
            onMakeGlobal={(section) => { void makeGlobal(section); }}
            onInsertGlobal={(globalId) => { void insertGlobal(globalId); }}
            onDetachGlobal={(section) => { void detachGlobal(section); }}
          />}
        </aside>
      </div>
    </div>
  );
}
