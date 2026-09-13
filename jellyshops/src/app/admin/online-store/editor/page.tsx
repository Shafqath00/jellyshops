"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Monitor, Smartphone, Tablet } from "lucide-react";
import { getBlockDefinition, getSectionDefinition } from "@jelly/storefront-registry";
import { RegistrySectionRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type { SectionNode } from "@jelly/storefront-schema";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { getDemoSession } from "@/features/store-editor/api/demo-session";
import type {
  DemoCatalog,
  DynamicSourceDescriptor,
  GlobalSectionRecord,
  SectionPresetRecord,
  StorefrontTemplateRecord,
  WorkspaceRecord,
} from "@/features/store-editor/api/types";
import { GlobalSectionPanel } from "@/features/store-editor/components/global-section-panel";
import { SettingGroups } from "@/features/store-editor/components/inspector/setting-groups";
import { SectionLibrary } from "@/features/store-editor/components/section-library";
import { TemplateHierarchy } from "@/features/store-editor/components/template-hierarchy";
import { TemplateResourceSelector, type PreviewResourceOption } from "@/features/store-editor/components/template-resource-selector";
import type { EditorSelection } from "@/features/store-editor/model/types";
import type { EditorViewport } from "@/features/store-editor/state/types";
import {
  appendGlobalPlacement,
  appendInlineSection,
  detachGlobalPlacement,
  replaceInlineWithGlobal,
  updateInlineSection,
} from "@/features/store-editor/template-layout";

const backendStoreId = "store-demo";

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

function resourceOptions(template: StorefrontTemplateRecord | undefined, catalog: DemoCatalog): PreviewResourceOption[] {
  if (!template) return [];
  if (template.type === "product") return catalog.products.map((product) => ({ id: product.id, label: product.name }));
  if (template.type === "collection") return catalog.collections.map((collection) => ({ id: collection.id, label: collection.name }));
  return [];
}

export default function OnlineStoreEditorPage() {
  const session = getDemoSession();
  const token = session?.token;
  const api = useMemo(() => token ? createStoreEditorApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
  }) : null, [token]);

  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [templates, setTemplates] = useState<StorefrontTemplateRecord[]>([]);
  const [globals, setGlobals] = useState<GlobalSectionRecord[]>([]);
  const [presets, setPresets] = useState<SectionPresetRecord[]>([]);
  const [dynamicSources, setDynamicSources] = useState<DynamicSourceDescriptor[]>([]);
  const [catalog, setCatalog] = useState<DemoCatalog>({ products: [], collections: [] });
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [previewResourceId, setPreviewResourceId] = useState<string>();
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [activeGlobalId, setActiveGlobalId] = useState<string>();
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (!api) return;
    let active = true;
    void Promise.all([
      api.loadWorkspace(backendStoreId),
      api.listTemplates(backendStoreId),
      api.listGlobalSections(backendStoreId),
      api.listPresets(backendStoreId),
      api.listCatalog(),
    ]).then(([nextWorkspace, nextTemplates, nextGlobals, nextPresets, nextCatalog]) => {
      if (!active) return;
      setWorkspace(nextWorkspace);
      setTemplates(nextTemplates);
      setGlobals(nextGlobals);
      setPresets(nextPresets);
      setCatalog(nextCatalog);
      setActiveTemplateId((current) => current || nextTemplates.find((template) => template.type === "home")?.id || nextTemplates[0]?.id || "");
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "Unable to load the Online Store workspace");
    });
    return () => { active = false; };
  }, [api]);

  const activeTemplate = templates.find((template) => template.id === activeTemplateId);

  useEffect(() => {
    if (!api || !activeTemplate) {
      setDynamicSources([]);
      return;
    }
    let active = true;
    setDynamicSources([]);
    void api.listDynamicSources(backendStoreId, activeTemplate.type)
      .then((sources) => { if (active) setDynamicSources(sources); })
      .catch(() => { if (active) setDynamicSources([]); });
    return () => { active = false; };
  }, [api, activeTemplate]);

  const globalMap = useMemo(() => new Map(globals.map((global) => [global.id, global])), [globals]);
  const sections = useMemo(
    () => activeTemplate ? templateSections(activeTemplate, globalMap) : [],
    [activeTemplate, globalMap],
  );
  const previewResources = useMemo(
    () => resourceOptions(activeTemplate, catalog),
    [activeTemplate, catalog],
  );
  const globalLabels = useMemo(() => Object.fromEntries(globals.map((global) => [
    global.id,
    {
      id: global.id,
      name: global.name,
      sectionType: typeof global.section.type === "string" ? global.section.type : undefined,
    },
  ])), [globals]);
  const presetOptions = useMemo(() => presets.flatMap((preset) => {
    const section = normalizeSection(preset.section);
    return section ? [{ id: preset.id, name: preset.name, section }] : [];
  }), [presets]);
  const globalOptions = useMemo(() => globals.flatMap((global) => {
    const section = normalizeSection(global.section);
    return section ? [{ id: global.id, name: global.name, section }] : [];
  }), [globals]);
  const localSection = activeTemplate ? selectedInlineSection(activeTemplate, selection) : null;
  const selectedBlock = localSection && selection?.kind === "block"
    ? localSection.blocks.find((block) => block.id === selection.blockId)
    : undefined;
  const sectionDefinition = localSection ? getSectionDefinition(localSection.type) : undefined;
  const blockDefinition = selectedBlock ? getBlockDefinition(selectedBlock.type) : undefined;
  const selectedControls = selectedBlock ? blockDefinition?.controls ?? [] : sectionDefinition?.controls ?? [];
  const selectedSettings = selectedBlock?.settings ?? localSection?.settings ?? {};

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
      setPreviewResourceId(undefined);
      return;
    }
    if (!previewResources.some((resource) => resource.id === previewResourceId)) {
      setPreviewResourceId(previewResources[0]?.id);
    }
  }, [previewResourceId, previewResources]);

  const persistLayout = async (layout: Record<string, unknown>) => {
    if (!api || !activeTemplate) return;
    const result = await api.updateTemplate(
      backendStoreId,
      activeTemplate.id,
      activeTemplate.revision,
      { layout },
    );
    setTemplates((current) => current.map((template) => template.id === result.template.id ? result.template : template));
    setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
  };

  const insertPreset = async (section: SectionNode) => {
    if (!activeTemplate) return;
    await persistLayout(appendInlineSection(activeTemplate.layout, section));
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
      section,
    });
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

  if (!api) {
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center"><div><h1 className="text-xl font-semibold">Online Store editor is disabled</h1><p className="mt-2 text-sm text-[#6d7175]">Connect merchant authentication to use the editor.</p></div></main>;
  }

  if (loadError) {
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center"><div><h1 className="text-xl font-semibold">Could not load Online Store</h1><p className="mt-2 text-sm text-[#b42318]">{loadError}</p></div></main>;
  }

  if (!workspace || !activeTemplate) {
    return <main className="grid min-h-[70vh] place-items-center text-[13px] text-[#616161]" aria-live="polite">Loading Online Store editor…</main>;
  }

  return (
    <div className="fixed inset-0 z-[60] flex h-dvh flex-col overflow-hidden bg-[#f4f4f5] text-[#303030]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e3e3e3] bg-white px-3">
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
        <div className="text-right"><p className="text-[10px] text-[#8c9196]">Draft workspace</p><p className="text-[12px] font-semibold">Generation {workspace.generation}</p></div>
      </header>

      <TemplateResourceSelector
        templates={templates.map(({ id, type, handle, name }) => ({ id, type, handle, name }))}
        activeTemplateId={activeTemplate.id}
        previewResources={previewResources}
        previewResourceId={previewResourceId}
        onTemplateChange={(templateId) => { setActiveTemplateId(templateId); setSelection(null); setActiveGlobalId(undefined); }}
        onPreviewResourceChange={setPreviewResourceId}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)_320px]">
        <TemplateHierarchy
          template={activeTemplate}
          globalSections={globalLabels}
          selection={selection}
          activeGlobalId={activeGlobalId}
          onSelect={(next) => { setSelection(next); setActiveGlobalId(undefined); }}
          onGlobalSelect={(globalId) => { setActiveGlobalId(globalId); setSelection(null); }}
        />

        <main className="min-h-0 overflow-auto p-4" aria-label="Storefront preview">
          <div className={clsx(
            "mx-auto min-h-full overflow-hidden border border-[#dcdcdc] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-[max-width]",
            viewport === "desktop" && "max-w-[1440px]",
            viewport === "tablet" && "max-w-[820px]",
            viewport === "mobile" && "max-w-[390px]",
          )} data-testid="preview-viewport" data-viewport={viewport}>
            {sections.map((section) => (
              <RegistrySectionRenderer
                key={section.id}
                section={section}
                mode="editor"
                commerce={commerce}
                region="template"
                selected={selection ?? undefined}
                onSelect={(next) => {
                  setActiveGlobalId(undefined);
                  if (next.kind === "section" && next.sectionId) setSelection({ kind: "section", region: "template", sectionId: next.sectionId });
                  if (next.kind === "block" && next.sectionId && next.blockId) setSelection({ kind: "block", region: "template", sectionId: next.sectionId, blockId: next.blockId, fieldKey: next.fieldKey });
                }}
              />
            ))}
            {sections.length === 0 && <div className="grid min-h-[360px] place-items-center p-8 text-center text-sm text-[#8c9196]">This template has no sections yet.</div>}
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-l border-[#e3e3e3] bg-white" aria-label="Section tools">
          {localSection && selectedControls.length > 0 && (
            <>
              <div className="border-b border-[#eeeeee] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Settings</p>
                <p className="mt-1 truncate text-[12px] font-semibold text-[#303030]">{selectedBlock ? `${selectedBlock.type} block` : localSection.type}</p>
              </div>
              <div className="border-b border-[#eeeeee] px-4 py-4">
                <SettingGroups
                  controls={selectedControls}
                  settings={selectedSettings}
                  catalog={catalog}
                  dynamicSources={dynamicSources}
                  onChange={(key, nextValue) => { void updateSelectedSetting(key, nextValue); }}
                />
              </div>
            </>
          )}

          <div className="border-b border-[#eeeeee] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Section library</p>
          </div>
          <SectionLibrary presets={presetOptions} onInsertPreset={(section) => { void insertPreset(section); }} />

          <div className="border-y border-[#eeeeee] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Global sections</p>
          </div>
          <GlobalSectionPanel
            globalSections={globalOptions}
            localSection={localSection ?? undefined}
            attachedGlobalId={activeGlobalId}
            onMakeGlobal={(section) => { void makeGlobal(section); }}
            onInsertGlobal={(globalId) => { void insertGlobal(globalId); }}
            onDetachGlobal={(section) => { void detachGlobal(section); }}
          />
        </aside>
      </div>
    </div>
  );
}
