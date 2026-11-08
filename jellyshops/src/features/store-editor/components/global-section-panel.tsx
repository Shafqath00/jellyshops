import type { SectionNode } from "@jelly/storefront-schema";

export interface GlobalSectionOption {
  id: string;
  name: string;
  section: SectionNode;
}

export function GlobalSectionPanel({
  globalSections,
  localSection,
  attachedGlobalId,
  onMakeGlobal,
  onInsertGlobal,
  onDetachGlobal,
  onSaveToLibrary,
  suggestedName,
}: {
  globalSections: GlobalSectionOption[];
  localSection?: SectionNode;
  attachedGlobalId?: string;
  onMakeGlobal(section: SectionNode): void;
  onInsertGlobal(globalSectionId: string): void;
  onDetachGlobal(section: SectionNode): void;
  /** Saves a copy of the section as a reusable saved section (not linked: later edits don't spread). */
  onSaveToLibrary?(section: SectionNode, name: string): void;
  /** The name suggested when saving. */
  suggestedName?: string;
}) {
  const attached = attachedGlobalId
    ? globalSections.find((global) => global.id === attachedGlobalId)
    : undefined;

  if (attached) {
    return (
      <section aria-label="Shared section" className="p-3">
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Shared section · edits show on every page that uses it</p>
          <p className="mt-1 text-[12px] font-semibold text-foreground">{attached.name}</p>
          <button
            type="button"
            aria-label={`Stop sharing ${attached.name}`}
            onClick={() => onDetachGlobal(structuredClone(attached.section))}
            className="mt-3 h-8 rounded-md border border-border bg-card px-3 text-[11px] font-semibold text-foreground hover:bg-muted/50"
          >
            Make a separate copy
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Shared sections" className="space-y-3 p-3">
      {localSection && (
        <button
          type="button"
          aria-label="Share this section"
          onClick={() => {
            if (!window.confirm("Share this section? You can then add it to other pages, and any edit to it shows everywhere it is used.")) return;
            onMakeGlobal(structuredClone(localSection));
          }}
          className="h-8 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground"
        >
          Share this section
        </button>
      )}
      {localSection && onSaveToLibrary && (
        <button
          type="button"
          aria-label="Save this section to the library"
          onClick={() => {
            const name = window.prompt("Name for this saved section. You can add a copy of it to any page from Add section > Saved sections.", suggestedName ?? "Saved section");
            if (name?.trim()) onSaveToLibrary(structuredClone(localSection), name.trim().slice(0, 80));
          }}
          className="ml-2 h-8 rounded-md border border-border bg-card px-3 text-[11px] font-semibold text-foreground hover:bg-muted/50"
        >
          Save to library
        </button>
      )}

      <div className="space-y-1">
        {globalSections.map((global) => (
          <button
            key={global.id}
            type="button"
            aria-label={`Insert ${global.name}`}
            onClick={() => onInsertGlobal(global.id)}
            className="flex min-h-9 w-full items-center rounded-lg px-2.5 text-left text-[12px] font-medium text-muted-foreground hover:bg-muted/50"
          >
            <span className="truncate">{global.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
