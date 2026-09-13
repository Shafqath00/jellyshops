"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, Monitor, Smartphone, Tablet } from "lucide-react";
import { RegistrySectionRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type { SectionNode } from "@jelly/storefront-schema";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { getDemoSession } from "@/features/store-editor/api/demo-session";
import type {
  DemoCatalog,
  GlobalSectionRecord,
  StorefrontTemplateRecord,
  WorkspaceRecord,
} from "@/features/store-editor/api/types";
import { TemplateHierarchy } from "@/features/store-editor/components/template-hierarchy";
import { TemplateResourceSelector, type PreviewResourceOption } from "@/features/store-editor/components/template-resource-selector";
import type { EditorSelection } from "@/features/store-editor/model/types";
import type { EditorViewport } from "@/features/store-editor/state/types";

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
  const [catalog, setCatalog] = useState<DemoCatalog>({ products: [], collections: [] });
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [previewResourceId, setPreviewResourceId] = useState<string>();
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  const [loadError, setLoadError] = useState<string>();

  useEffect(() => {
    if (!api) return;
    let active = true;
    void Promise.all([
      api.loadWorkspace(backendStoreId),
      api.listTemplates(backendStoreId),
      api.listGlobalSections(backendStoreId),
      api.listCatalog(),
    ]).then(([nextWorkspace, nextTemplates, nextGlobals, nextCatalog]) => {
      if (!active) return;
      setWorkspace(nextWorkspace);
      setTemplates(nextTemplates);
      setGlobals(nextGlobals);
      setCatalog(nextCatalog);
      setActiveTemplateId((current) => current || nextTemplates.find((template) => template.type === "home")?.id || nextTemplates[0]?.id || "");
    }).catch((error: unknown) => {
      if (!active) return;
      setLoadError(error instanceof Error ? error.message : "Unable to load the Online Store workspace");
    });
    return () => { active = false; };
  }, [api]);

  const activeTemplate = templates.find((template) => template.id === activeTemplateId);
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
          ] as const).map(([value, label, Icon]) => (
            <button key={value} type="button" aria-label={label} aria-pressed={viewport === value} onClick={() => setViewport(value)} className={clsx("grid size-7 place-items-center rounded-md", viewport === value ? "bg-white shadow-sm" : "text-[#8c9196]")}><Icon size={15} /></button>
          ))}
        </div>
        <div className="text-right"><p className="text-[10px] text-[#8c9196]">Draft workspace</p><p className="text-[12px] font-semibold">Generation {workspace.generation}</p></div>
      </header>

      <TemplateResourceSelector
        templates={templates.map(({ id, type, handle, name }) => ({ id, type, handle, name }))}
        activeTemplateId={activeTemplate.id}
        previewResources={previewResources}
        previewResourceId={previewResourceId}
        onTemplateChange={(templateId) => { setActiveTemplateId(templateId); setSelection(null); }}
        onPreviewResourceChange={setPreviewResourceId}
      />

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)]">
        <TemplateHierarchy template={activeTemplate} globalSections={globalLabels} selection={selection} onSelect={setSelection} />
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
                  if (next.kind === "section" && next.sectionId) setSelection({ kind: "section", region: "template", sectionId: next.sectionId });
                  if (next.kind === "block" && next.sectionId && next.blockId) setSelection({ kind: "block", region: "template", sectionId: next.sectionId, blockId: next.blockId, fieldKey: next.fieldKey });
                }}
              />
            ))}
            {sections.length === 0 && <div className="grid min-h-[360px] place-items-center p-8 text-center text-sm text-[#8c9196]">This template has no sections yet.</div>}
          </div>
        </main>
      </div>
    </div>
  );
}
