import type { SectionNode } from "@jelly/storefront-schema";

export interface SectionLibraryPreset {
  id: string;
  name: string;
  section: SectionNode;
}

export function SectionLibrary({
  presets,
  onInsertPreset,
}: {
  presets: SectionLibraryPreset[];
  onInsertPreset(section: SectionNode): void;
}) {
  if (presets.length === 0) {
    return <p className="px-3 py-4 text-[12px] text-[#8c9196]">No saved section presets yet.</p>;
  }

  return (
    <section aria-label="Section library" className="space-y-1 p-2">
      {presets.map((preset) => (
        <button
          key={preset.id}
          type="button"
          aria-label={`Insert ${preset.name}`}
          onClick={() => onInsertPreset(structuredClone(preset.section))}
          className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[12px] font-medium text-[#454f5b] hover:bg-[#f6f6f7]"
        >
          <span className="truncate">{preset.name}</span>
        </button>
      ))}
    </section>
  );
}
