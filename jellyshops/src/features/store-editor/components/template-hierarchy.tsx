import clsx from "clsx";
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
        return [{ kind: "inline", section: { id: section.id, type: section.type } }];
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
}: {
  placement: TemplatePlacement;
  globalSections: Record<string, GlobalLabel>;
  selection: EditorSelection;
  activeGlobalId?: string;
  onSelect(selection: EditorSelection): void;
  onGlobalSelect?(globalSectionId: string): void;
}) {
  if (placement.kind === "global") {
    const global = globalSections[placement.globalSectionId];
    const selected = activeGlobalId === placement.globalSectionId;
    return (
      <button
        type="button"
        aria-label={global?.name ?? "Missing global section"}
        onClick={() => onGlobalSelect?.(placement.globalSectionId)}
        className={clsx(
          "flex min-h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-left text-[12px]",
          selected ? "border-[#b9b9b9] bg-[#eeeeee] text-[#202223]" : "border-[#e3e3e3] bg-[#fafafa] text-[#454f5b] hover:bg-white",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{global?.name ?? "Missing global section"}</span>
        <span className="rounded bg-[#eeeeee] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-[#616161]">Global</span>
      </button>
    );
  }

  const selected = selection?.kind === "section" && selection.sectionId === placement.section.id;
  const label = sectionLabels[placement.section.type] ?? placement.section.type;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onSelect({ kind: "section", region: "template", sectionId: placement.section.id })}
      className={clsx(
        "flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-[12px] font-medium",
        selected ? "bg-[#eeeeee] text-[#202223]" : "text-[#616161] hover:bg-[#f6f6f7]",
      )}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

export function TemplateHierarchy({
  template,
  globalSections,
  selection,
  activeGlobalId,
  onSelect,
  onGlobalSelect,
}: {
  template: Pick<StorefrontTemplateRecord, "id" | "name" | "layout">;
  globalSections: Record<string, GlobalLabel>;
  selection: EditorSelection;
  activeGlobalId?: string;
  onSelect(selection: EditorSelection): void;
  onGlobalSelect?(globalSectionId: string): void;
}) {
  const templatePlacements = placements(template);
  const groups: Record<HierarchyRegion, TemplatePlacement[]> = {
    header: [],
    template: [],
    footer: [],
  };
  templatePlacements.forEach((placement) => groups[placementRegion(placement, globalSections)].push(placement));

  return (
    <aside className="flex h-full min-h-0 flex-col bg-white" aria-label="Template hierarchy">
      <div className="h-14 shrink-0 border-b border-[#eeeeee] px-4 py-2.5">
        <p className="text-[10px] font-medium text-[#8c9196]">Template</p>
        <h1 className="mt-0.5 truncate text-[13px] font-semibold text-[#303030]">{template.name}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {(["header", "template", "footer"] as const).map((region) => (
          <section key={region} className="mb-3 last:mb-0">
            <h2 className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">
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
                />
              ))}
              {groups[region].length === 0 && (
                <p className="px-2 py-2 text-[11px] text-[#b1b1b1]">No {region} sections.</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
