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
}: {
  globalSections: GlobalSectionOption[];
  localSection?: SectionNode;
  attachedGlobalId?: string;
  onMakeGlobal(section: SectionNode): void;
  onInsertGlobal(globalSectionId: string): void;
  onDetachGlobal(section: SectionNode): void;
}) {
  const attached = attachedGlobalId
    ? globalSections.find((global) => global.id === attachedGlobalId)
    : undefined;

  if (attached) {
    return (
      <section aria-label="Global section" className="p-3">
        <div className="rounded-lg border border-border bg-muted/50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Synced global section</p>
          <p className="mt-1 text-[12px] font-semibold text-foreground">{attached.name}</p>
          <button
            type="button"
            aria-label={`Detach ${attached.name}`}
            onClick={() => onDetachGlobal(structuredClone(attached.section))}
            className="mt-3 h-8 rounded-md border border-border bg-card px-3 text-[11px] font-semibold text-foreground hover:bg-muted/50"
          >
            Detach
          </button>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Global sections" className="space-y-3 p-3">
      {localSection && (
        <button
          type="button"
          aria-label="Make global"
          onClick={() => {
            if (!window.confirm("Convert this section into a synced global section? Changes will affect every placement.")) return;
            onMakeGlobal(structuredClone(localSection));
          }}
          className="h-8 rounded-md bg-primary px-3 text-[11px] font-semibold text-primary-foreground"
        >
          Make global
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
