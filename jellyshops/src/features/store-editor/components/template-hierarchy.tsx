import clsx from "clsx";
import { ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, LayoutPanelTop, MousePointerClick, Plus, Type } from "lucide-react";
import type { EditorSelection } from "../model/types";
import type { StorefrontTemplateRecord } from "../api/types";

const sectionLabels: Record<string, string> = {
  "announcement-bar": "Announcement bar",
  header: "Header",
  hero: "Hero",
  "product-grid": "Product grid",
  "featured-collection": "Featured collection",
  "rich-text": "Rich text",
  "image-with-text": "Image with text",
  "image-text": "Image with text",
  multicolumn: "Multicolumn",
  newsletter: "Newsletter",
  "spacer-divider": "Spacer / divider",
  spacer: "Spacer / divider",
  divider: "Spacer / divider",
  footer: "Footer",
};

type InlinePlacement = {
  kind: "inline";
  section: {
    id: string;
    type: string;
    enabled?: boolean;
    blocks: Array<{ id: string; type: string; settings?: Record<string, unknown> }>;
  };
};

type GlobalPlacement = {
  kind: "global";
  globalSectionId: string;
};

type TemplatePlacement = InlinePlacement | GlobalPlacement;
type HierarchyRegion = "header" | "template" | "footer";

type GlobalLabel = {
  id: string;
  name: string;
  sectionType?: string;
  sectionId?: string;
  blocks?: Array<{ id: string; type: string }>;
};

function placements(template: Pick<StorefrontTemplateRecord, "layout">): TemplatePlacement[] {
  const sections = template.layout.sections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((item): TemplatePlacement[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (candidate.kind === "global" && typeof candidate.globalSectionId === "string") {
      return [{ kind: "global", globalSectionId: candidate.globalSectionId }];
    }
    if (candidate.kind === "inline" && candidate.section && typeof candidate.section === "object" && !Array.isArray(candidate.section)) {
      const section = candidate.section as Record<string, unknown>;
      if (typeof section.id === "string" && typeof section.type === "string") {
        return [{
          kind: "inline",
          section: {
          id: section.id,
          type: section.type,
          enabled: section.enabled !== false,
            blocks: Array.isArray(section.blocks)
              ? section.blocks.flatMap((block): InlinePlacement["section"]["blocks"] => {
                if (!block || typeof block !== "object" || Array.isArray(block)) return [];
                const value = block as Record<string, unknown>;
                return typeof value.id === "string" && typeof value.type === "string"
                  ? [{ id: value.id, type: value.type, settings: value.settings as Record<string, unknown> | undefined }]
                  : [];
              })
              : [],
          },
        }];
      }
    }
    return [];
  });
}

function placementRegion(
  placement: TemplatePlacement,
  globalSections: Record<string, GlobalLabel>,
): HierarchyRegion {
  const type = placement.kind === "inline"
    ? placement.section.type
    : globalSections[placement.globalSectionId]?.sectionType;
  if (type === "header") return "header";
  if (type === "footer") return "footer";
  return "template";
}

function PlacementRow({
  placement,
  globalSections,
  selection,
  activeGlobalId,
  onSelect,
  onGlobalSelect,
  onAddBlock,
  onMove,
  onToggle,
  index,
  count,
  region,
}: {
  placement: TemplatePlacement;
  globalSections: Record<string, GlobalLabel>;
  selection: EditorSelection;
  activeGlobalId?: string;
  onSelect(selection: EditorSelection): void;
  onGlobalSelect?(globalSectionId: string): void;
  onAddBlock?(sectionId: string): void;
  onMove?(id: string, direction: "up" | "down"): void;
  onToggle?(id: string, enabled: boolean): void;
  index: number;
  count: number;
  region: HierarchyRegion;
}) {
  if (placement.kind === "global") {
    const global = globalSections[placement.globalSectionId];
    const selected = activeGlobalId === placement.globalSectionId;
    return (
      <div>
      <button
        type="button"
        aria-label={global?.name ?? "Missing global section"}
        onClick={() => onGlobalSelect?.(placement.globalSectionId)}
        className={clsx(
          "flex min-h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-left text-[12px]",
          selected ? "border-[var(--line)] bg-[var(--paper-deep)] text-[var(--ink)]" : "border-[var(--line)] bg-[var(--paper)] text-[var(--ink-soft)] hover:bg-[var(--white)]",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{global?.name ?? "Missing global section"}</span>
        <span className="rounded bg-[var(--paper-deep)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-soft)]">Global</span>
      </button>
      {selected && global?.blocks && global.blocks.length > 0 && <div className="ml-5 mt-1 space-y-0.5 border-l border-[var(--line)] pl-2">{global.blocks.map((block) => {
        const blockLabel = sectionLabels[block.type] ?? block.type.charAt(0).toUpperCase() + block.type.slice(1);
        const blockSelected = selection?.kind === "block" && selection.blockId === block.id;
        return <button key={block.id} type="button" aria-label={`${blockLabel} block`} onClick={() => onSelect({ kind: "block", region, sectionId: global.sectionId ?? placement.globalSectionId, blockId: block.id })} className={clsx("flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px]", blockSelected ? "bg-[var(--ink)] text-[var(--white)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]")}>
          {block.type === "button" ? <MousePointerClick size={14} /> : <Type size={14} />}<span className="truncate">{blockLabel}</span>
        </button>;
      })}</div>}
      </div>
    );
  }

  const selected = selection?.kind !== "theme" && selection?.sectionId === placement.section.id;
  const expanded = selected;
  const label = sectionLabels[placement.section.type] ?? placement.section.type;
  return (
    <div>
      <button
        type="button"
        aria-label={label}
        onClick={() => onSelect({ kind: "section", region, sectionId: placement.section.id })}
        className={clsx(
          "flex min-h-10 w-full items-center gap-2 rounded-xl px-2.5 text-left text-[12px] font-medium",
          selected ? "bg-[var(--paper-deep)] text-[var(--ink)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]",
        )}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <LayoutPanelTop size={15} className="text-[var(--ink-soft)]" />
        <span className="truncate">{label}</span>
      </button>
      {onMove ? <div className="-mt-8 mr-1 flex justify-end"><button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(placement.section.id, "up")} className="grid size-6 place-items-center rounded disabled:opacity-25"><ChevronUp size={13} /></button><button type="button" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(placement.section.id, "down")} className="grid size-6 place-items-center rounded disabled:opacity-25"><ChevronDown size={13} /></button>{onToggle ? <button type="button" aria-label={`${placement.section.enabled === false ? "Show" : "Hide"} ${label}`} onClick={() => onToggle(placement.section.id, placement.section.enabled === false)} className="grid size-6 place-items-center rounded"><span className="sr-only">{placement.section.enabled === false ? "Hidden" : "Visible"}</span>{placement.section.enabled === false ? <EyeOff size={13} /> : <Eye size={13} />}</button> : null}</div> : null}
      {expanded && (
        <div className="ml-5 mt-1 space-y-0.5 border-l border-[var(--line)] pl-2">
          {placement.section.blocks.map((block) => {
            const blockSelected = selection?.kind === "block" && selection.blockId === block.id;
            const blockLabel = sectionLabels[block.type] ?? block.type.charAt(0).toUpperCase() + block.type.slice(1);
            return (
              <button
                key={block.id}
                type="button"
                aria-label={`${blockLabel} block`}
                onClick={() => onSelect({ kind: "block", region, sectionId: placement.section.id, blockId: block.id })}
                className={clsx(
                  "flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px]",
                  blockSelected ? "bg-[var(--ink)] text-[var(--white)]" : "text-[var(--ink-soft)] hover:bg-[var(--paper)]",
                )}
              >
                {block.type === "button" ? <MousePointerClick size={14} /> : <Type size={14} />}
                <span className="truncate">{blockLabel}</span>
              </button>
            );
          })}
          {onAddBlock && (
            <button
              type="button"
              aria-label={`Add block to ${label}`}
              onClick={() => onAddBlock(placement.section.id)}
              className="flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--paper-deep)]"
            >
              <Plus size={15} /> Add block
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TemplateHierarchy({
  template,
  globalSections,
  selection,
  activeGlobalId,
  onSelect,
  onGlobalSelect,
  onAddSection,
  onAddBlock,
  onMove,
  onToggle,
}: {
  template: Pick<StorefrontTemplateRecord, "id" | "name" | "layout">;
  globalSections: Record<string, GlobalLabel>;
  selection: EditorSelection;
  activeGlobalId?: string;
  onSelect(selection: EditorSelection): void;
  onGlobalSelect?(globalSectionId: string): void;
  onAddSection?(region: HierarchyRegion): void;
  onAddBlock?(sectionId: string): void;
  onMove?(id: string, direction: "up" | "down"): void;
  onToggle?(id: string, enabled: boolean): void;
}) {
  const templatePlacements = placements(template);
  const groups: Record<HierarchyRegion, TemplatePlacement[]> = {
    header: [],
    template: [],
    footer: [],
  };
  templatePlacements.forEach((placement) => groups[placementRegion(placement, globalSections)].push(placement));

  return (
    <aside className="flex min-h-0 flex-1 flex-col bg-[var(--white)]" aria-label="Template hierarchy">
      <div className="h-14 shrink-0 border-b border-[var(--line)] px-4 py-2.5">
        <p className="text-[10px] font-medium text-[var(--ink-soft)]">Template</p>
        <h1 className="mt-0.5 truncate text-[13px] font-semibold text-[var(--ink)]">{template.name}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {(["header", "template", "footer"] as const).map((region) => (
          <section key={region} className="mb-3 last:mb-0">
            <h2 className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-soft)]">
              {region === "template" ? "Template" : region === "header" ? "Header" : "Footer"}
            </h2>
            <div className="space-y-1">
              {groups[region].map((placement, index) => (
                <PlacementRow
                  key={placement.kind === "global" ? `${placement.globalSectionId}:${index}` : placement.section.id}
                  placement={placement}
                  globalSections={globalSections}
                  selection={selection}
                  activeGlobalId={activeGlobalId}
                  onSelect={onSelect}
                  onGlobalSelect={onGlobalSelect}
                  onAddBlock={onAddBlock}
                  onMove={onMove}
                  onToggle={onToggle}
                  index={index}
                  count={groups[region].length}
                  region={region}
                />
              ))}
              {groups[region].length === 0 && (
                <p className="px-2 py-2 text-[11px] text-[var(--ink-soft)]">No {region} sections.</p>
              )}
              {onAddSection && (
                <button
                  type="button"
                  aria-label={`Add section to ${region === "template" ? "Template" : region === "header" ? "Header" : "Footer"}`}
                  onClick={() => onAddSection(region)}
                  className="mt-1 flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 text-left text-[12px] font-medium text-[var(--ink)] hover:bg-[var(--paper-deep)]"
                >
                  <Plus size={15} /> Add section
                </button>
              )}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
