import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, LayoutPanelTop, Plus, Search, Trash2, Type, X } from "lucide-react";
import type { EditorSelection } from "../model/types";
import type { StorefrontTemplateRecord } from "../api/types";
import { blockLabel as blockTypeLabel, getSectionDefinition } from "@jelly/storefront-registry";
import { displayName } from "../editor-page-helpers";

/** Block name plus a short preview of its text, so merchants can tell blocks apart. */
function describeBlock(block: { type: string; settings?: Record<string, unknown> }): string {
  const label = blockTypeLabel(block.type);
  const text = [block.settings?.text, block.settings?.label, block.settings?.heading, block.settings?.question, block.settings?.quote].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  return text ? `${label}: ${text.trim().slice(0, 40)}${text.trim().length > 40 ? "…" : ""}` : label;
}

type TreeBlock = { id: string; type: string; enabled?: boolean; settings?: Record<string, unknown>; blocks?: TreeBlock[] };

/** Whether the section or block (or anything inside it) matches the search words. */
function blockMatches(block: TreeBlock, query: string): boolean {
  return describeBlock(block).toLowerCase().includes(query) || (block.blocks ?? []).some((child) => blockMatches(child, query));
}

type InlinePlacement = {
  kind: "inline";
  section: {
    id: string;
    type: string;
    enabled?: boolean;
    settings?: Record<string, unknown>;
    blocks: TreeBlock[];
  };
};

/** The parts of a section (section-elements.ts) that have something to show: their own settings hold a value. Product cards always do. */
function shownElements(section: InlinePlacement["section"], themeVersion?: string) {
  const elements = getSectionDefinition(section.type, themeVersion)?.elements ?? [];
  return elements.filter((element) => element.kind === "product-card" || element.controls.some((key) => {
    const value = section.settings?.[key];
    return typeof value === "string" ? value.trim().length > 0 : value !== undefined && value !== null && typeof value !== "boolean";
  }));
}

/** Saved blocks with their children (blocks inside a group). */
function treeBlocks(value: unknown): TreeBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((block): TreeBlock[] => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return [];
    const item = block as Record<string, unknown>;
    return typeof item.id === "string" && typeof item.type === "string"
      ? [{ id: item.id, type: item.type, enabled: item.enabled !== false, settings: item.settings as Record<string, unknown> | undefined, ...(Array.isArray(item.blocks) ? { blocks: treeBlocks(item.blocks) } : {}) }]
      : [];
  });
}

type GlobalPlacement = {
  kind: "global";
  globalSectionId: string;
};

type TemplatePlacement = (InlinePlacement | GlobalPlacement) & { sourceIndex: number };
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
  return sections.flatMap((item, sourceIndex): TemplatePlacement[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, unknown>;
    if (candidate.kind === "global" && typeof candidate.globalSectionId === "string") {
      return [{ kind: "global", globalSectionId: candidate.globalSectionId, sourceIndex }];
    }
    if (candidate.kind === "inline" && candidate.section && typeof candidate.section === "object" && !Array.isArray(candidate.section)) {
      const section = candidate.section as Record<string, unknown>;
      if (typeof section.id === "string" && typeof section.type === "string") {
        return [{
          kind: "inline",
          sourceIndex,
          section: {
          id: section.id,
          type: section.type,
          enabled: section.enabled !== false,
            settings: section.settings && typeof section.settings === "object" && !Array.isArray(section.settings) ? section.settings as Record<string, unknown> : undefined,
            blocks: treeBlocks(section.blocks),
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

function PlacementRow({ placement, globalSections, selection, activeGlobalId, onSelect, onGlobalSelect, onAddBlock, onMove, onToggle, onRemove, onBlockAction, index, count, region, expanded, onExpand, query, themeVersion }: {
  placement: TemplatePlacement; globalSections: Record<string, GlobalLabel>; selection: EditorSelection; activeGlobalId?: string;
  onSelect(selection: EditorSelection): void; onGlobalSelect?(id: string): void; onAddBlock?(id: string, parentId?: string): void; onMove?(id: string, direction: "up" | "down"): void; onToggle?(id: string, enabled: boolean): void;
  onRemove?(id: string): void; onBlockAction?(sectionId: string, blockId: string, action: "toggle" | "remove"): void;
  index: number; count: number; region: HierarchyRegion; expanded: boolean; onExpand(): void; query: string;
  themeVersion?: string;
}) {
  const shared = placement.kind === "global" ? globalSections[placement.globalSectionId] : undefined;
  const id = placement.kind === "inline" ? placement.section.id : placement.globalSectionId;
  const label = placement.kind === "inline" ? displayName(placement.section.type, themeVersion) : shared?.name ?? "Missing global section";
  const selected = placement.kind === "global" ? activeGlobalId === id : selection?.kind !== "theme" && selection?.sectionId === id;
  const allBlocks = placement.kind === "inline" ? placement.section.blocks : shared?.blocks ?? [];
  // While searching, a section whose own name matches shows all its blocks; otherwise only the blocks that match.
  const sectionMatches = !query || label.toLowerCase().includes(query);
  const blocks = sectionMatches ? allBlocks : allBlocks.filter((block) => blockMatches(block, query));
  const hidden = placement.kind === "inline" && placement.section.enabled === false;
  return <div className="group/row">
    <div className={clsx("flex min-h-8 items-center rounded-lg text-[13px] hover:bg-muted", selected && (selection?.kind === "section" && !selection.elementId ? "bg-primary/10 text-primary" : "bg-muted"))}>
      <button type="button" aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`} aria-expanded={expanded} onClick={onExpand} className="grid size-7 shrink-0 place-items-center rounded text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>
      <button type="button" aria-label={label} aria-current={selected && selection?.kind === "section" && !selection.elementId ? "true" : undefined} onClick={() => placement.kind === "global" ? onGlobalSelect?.(id) : onSelect({ kind: "section", region, sectionId: id })} className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"><LayoutPanelTop size={14} className="shrink-0 text-muted-foreground" /><span className={clsx("truncate", hidden && "text-muted-foreground line-through decoration-muted-foreground/60")}>{label}</span>{hidden && <span className="text-[9px] text-muted-foreground">Hidden</span>}{shared && <span className="text-[9px] text-muted-foreground">Global</span>}</button>
      {onMove && <div className="flex shrink-0 items-center opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100"><button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(id, "up")} className="grid size-6 place-items-center rounded disabled:opacity-25"><ChevronUp size={13} /></button><button type="button" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(id, "down")} className="grid size-6 place-items-center rounded disabled:opacity-25"><ChevronDown size={13} /></button>{onToggle && placement.kind === "inline" && <button type="button" aria-label={`${placement.section.enabled === false ? "Show" : "Hide"} ${label}`} onClick={() => onToggle(id, placement.section.enabled === false)} className="grid size-6 place-items-center rounded">{placement.section.enabled === false ? <EyeOff size={13} /> : <Eye size={13} />}</button>}{onRemove && placement.kind === "inline" && <button type="button" aria-label={`Delete ${label}`} onClick={() => onRemove(id)} className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>}</div>}
    </div>
    {expanded && <div className="ml-5 border-l border-border pl-2">{placement.kind === "inline" && sectionMatches && shownElements(placement.section, themeVersion).map((element) => {
      const elementSelected = selection?.kind === "section" && selection.sectionId === id && selection.elementId === element.id;
      return <button key={`element:${element.id}`} type="button" aria-label={`${element.label} (part of ${label})`} aria-current={elementSelected ? "true" : undefined} onClick={() => onSelect({ kind: "section", region, sectionId: id, elementId: element.id })} className={clsx("flex min-h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-muted", elementSelected && "bg-primary/10 font-medium text-primary")}><Type size={14} className="shrink-0 text-muted-foreground" /><span className="truncate">{element.label}</span></button>;
    })}{blocks.map(function renderBlock(block: TreeBlock): React.ReactNode {
      const sectionId = placement.kind === "inline" ? id : shared?.sectionId ?? id;
      const blockSelected = selection?.kind === "block" && selection.sectionId === sectionId && selection.blockId === block.id;
      const blockHidden = block.enabled === false;
      const row = <div key={block.id} className="group/block flex items-center rounded-md hover:bg-muted">
        <button type="button" aria-label={describeBlock(block)} aria-current={blockSelected ? "true" : undefined} onClick={() => onSelect({ kind: "block", region, sectionId, blockId: block.id })} className={clsx("flex min-h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs", blockSelected && "bg-primary/10 font-medium text-primary")}><Type size={14} className="shrink-0" /><span className={clsx("truncate", blockHidden && "text-muted-foreground line-through decoration-muted-foreground/60")}>{describeBlock(block)}</span>{blockHidden && <span className="text-[9px] text-muted-foreground">Hidden</span>}</button>
        {onBlockAction && placement.kind === "inline" && <div className="flex shrink-0 items-center opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100 [@media(hover:none)]:opacity-100">
          <button type="button" aria-label={`${blockHidden ? "Show" : "Hide"} ${describeBlock(block)}`} onClick={() => onBlockAction(id, block.id, "toggle")} className="grid size-6 place-items-center rounded">{blockHidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          <button type="button" aria-label={`Delete ${describeBlock(block)}`} onClick={() => onBlockAction(id, block.id, "remove")} className="grid size-6 place-items-center rounded text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
        </div>}
      </div>;
      if (!block.blocks) return row;
      // A group: its blocks sit one step in, with their own "Add block".
      const shownChildren = !query || sectionMatches || describeBlock(block).toLowerCase().includes(query) ? block.blocks : block.blocks.filter((child) => blockMatches(child, query));
      return <div key={block.id}>{row}<div className="ml-4 border-l border-border pl-2">{shownChildren.map(renderBlock)}{onAddBlock && placement.kind === "inline" && <button type="button" aria-label={`Add block to ${describeBlock(block)}`} onClick={() => onAddBlock(id, block.id)} className="flex min-h-8 items-center gap-2 px-2 text-xs font-medium text-primary"><Plus size={14} /> Add block</button>}</div></div>;
    })}{onAddBlock && placement.kind === "inline" && <button type="button" aria-label={`Add block to ${label}`} onClick={() => onAddBlock(id)} className="flex min-h-8 items-center gap-2 px-2 text-xs font-medium text-primary"><Plus size={14} /> Add block</button>}</div>}
  </div>;
}

function SortablePlacement({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="group/sort flex items-start">
    <button type="button" aria-label={`Reorder ${label}`} className="mt-0.5 grid size-6 shrink-0 touch-none place-items-center rounded text-muted-foreground opacity-0 group-hover/sort:opacity-100 group-focus-within/sort:opacity-100 [@media(hover:none)]:opacity-100" {...attributes} {...listeners}><GripVertical size={15} /></button>
    <div className="min-w-0 flex-1">{children}</div>
  </div>;
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
  onReorder,
  onToggle,
  onRemove,
  onBlockAction,
  themeVersion,
}: {
  themeVersion?: string;
  template: Pick<StorefrontTemplateRecord, "id" | "name" | "layout">;
  globalSections: Record<string, GlobalLabel>;
  selection: EditorSelection;
  activeGlobalId?: string;
  onSelect(selection: EditorSelection): void;
  onGlobalSelect?(globalSectionId: string): void;
  onAddSection?(region: HierarchyRegion): void;
  onAddBlock?(sectionId: string, parentId?: string): void;
  onMove?(id: string, direction: "up" | "down"): void;
  onReorder?(from: number, to: number): void;
  onToggle?(id: string, enabled: boolean): void;
  /** Deletes a section of this template. */
  onRemove?(id: string): void;
  /** Hides/shows or deletes one block of a section. */
  onBlockAction?(sectionId: string, blockId: string, action: "toggle" | "remove"): void;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set([...(selection && selection.kind !== "theme" ? [selection.sectionId] : []), ...(activeGlobalId ? placements(template).filter((item) => item.kind === "global" && item.globalSectionId === activeGlobalId).map((item) => `global:${item.sourceIndex}`) : [])]));
  // Selecting something in the preview opens its section here and scrolls it into view, like Shopify.
  const selectedSectionId = selection && selection.kind !== "theme" ? selection.sectionId : undefined;
  const selectedBlockId = selection?.kind === "block" ? selection.blockId : selection?.kind === "section" ? selection.elementId : undefined;
  const [shownSectionId, setShownSectionId] = useState(selectedSectionId);
  if (shownSectionId !== selectedSectionId) {
    setShownSectionId(selectedSectionId);
    if (selectedSectionId && !expandedItems.has(selectedSectionId)) setExpandedItems((current) => new Set([...current, selectedSectionId]));
  }
  const treeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    treeRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView?.({ block: "nearest" });
  }, [selectedSectionId, selectedBlockId]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const templatePlacements = placements(template);
  const groups: Record<HierarchyRegion, TemplatePlacement[]> = {
    header: [],
    template: [],
    footer: [],
  };
  // While searching, only sections whose name or blocks match are listed, and they open to show the matching blocks.
  const placementMatches = (placement: TemplatePlacement) => {
    if (!query) return true;
    const label = placement.kind === "inline" ? displayName(placement.section.type, themeVersion) : globalSections[placement.globalSectionId]?.name ?? "";
    const blocks = placement.kind === "inline" ? placement.section.blocks : (globalSections[placement.globalSectionId]?.blocks ?? []) as TreeBlock[];
    return label.toLowerCase().includes(query) || blocks.some((block) => blockMatches(block, query));
  };
  templatePlacements.filter(placementMatches).forEach((placement) => groups[placementRegion(placement, globalSections)].push(placement));
  const matchCount = groups.header.length + groups.template.length + groups.footer.length;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = Number(active.id);
    const to = Number(over.id);
    const source = templatePlacements.find((item) => item.sourceIndex === from);
    const target = templatePlacements.find((item) => item.sourceIndex === to);
    if (source && target && placementRegion(source, globalSections) === placementRegion(target, globalSections)) onReorder?.(from, to);
  };
  return (
    <aside className="flex min-h-0 flex-1 flex-col bg-[var(--white)]" aria-label="Template hierarchy">
      <div className="h-10 shrink-0 border-b border-[var(--line)] px-4 py-2.5">
        <h1 className="truncate text-[13px] font-semibold text-[var(--ink)]">{template.name}</h1>
      </div>

      <div className="shrink-0 border-b border-[var(--line)] px-3 py-2">
        <label className="flex h-8 items-center gap-2 rounded-lg border border-border bg-card px-2 focus-within:ring-2 focus-within:ring-black/[0.06]">
          <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input type="search" aria-label="Search sections and blocks" placeholder="Search sections and blocks" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && search) { event.stopPropagation(); setSearch(""); } }} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden" />
          {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="grid size-5 place-items-center rounded text-muted-foreground hover:text-foreground"><X size={13} /></button>}
        </label>
      </div>

      <div ref={treeRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {query && matchCount === 0 && <p role="status" className="px-2 py-3 text-[12px] text-muted-foreground">Nothing matches &ldquo;{search.trim()}&rdquo;.</p>}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {(["header", "template", "footer"] as const).map((region) => (
          <section key={region} className="mb-3 last:mb-0">
            <h2 className="px-2 py-2 text-[13px] font-semibold text-foreground">
              {region === "template" ? "Template" : region === "header" ? "Header" : "Footer"}
            </h2>
            <div className="space-y-1">
              <SortableContext items={groups[region].map((placement) => String(placement.sourceIndex))} strategy={verticalListSortingStrategy}>
              {groups[region].map((placement, index) => (
                <SortablePlacement key={placement.sourceIndex} id={String(placement.sourceIndex)} label={placement.kind === "global" ? globalSections[placement.globalSectionId]?.name ?? "shared section" : displayName(placement.section.type, themeVersion)}>
                <PlacementRow
                  placement={placement}
                  expanded={Boolean(query) || expandedItems.has(placement.kind === "inline" ? placement.section.id : `global:${placement.sourceIndex}`)}
                  query={query}
                  themeVersion={themeVersion}
                  onExpand={() => { const key = placement.kind === "inline" ? placement.section.id : `global:${placement.sourceIndex}`; setExpandedItems((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }}
                  globalSections={globalSections}
                  selection={selection}
                  activeGlobalId={activeGlobalId}
                  onSelect={onSelect}
                  onGlobalSelect={onGlobalSelect}
                  onAddBlock={onAddBlock}
                  onMove={onReorder ? (_id, direction) => {
                    const target = groups[region][index + (direction === "up" ? -1 : 1)];
                    if (target) onReorder(placement.sourceIndex, target.sourceIndex);
                  } : onMove}
                  onToggle={onToggle}
                  onRemove={onRemove}
                  onBlockAction={onBlockAction}
                  index={index}
                  count={groups[region].length}
                  region={region}
                />
                </SortablePlacement>
              ))}
              </SortableContext>
              {groups[region].length === 0 && !query && (
                <p className="px-2 py-2 text-[11px] text-[var(--ink-soft)]">No {region} sections.</p>
              )}
              {onAddSection && !query && (
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
        </DndContext>
      </div>
    </aside>
  );
}
