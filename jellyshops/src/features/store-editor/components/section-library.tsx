"use client";

import { useMemo, useState } from "react";
import { LayoutPanelTop, Search } from "lucide-react";
import type { SectionNode } from "@jelly/storefront-schema";

export interface SectionLibraryPreset {
  id: string;
  name: string;
  section: SectionNode;
}

export interface BuiltInSectionOption {
  id: string;
  name: string;
  category: string;
}

export function SectionLibrary({
  presets,
  builtIns = [],
  onInsertPreset,
  onInsertBuiltIn,
}: {
  presets: SectionLibraryPreset[];
  builtIns?: BuiltInSectionOption[];
  onInsertPreset(section: SectionNode): void;
  onInsertBuiltIn?(presetId: string): void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? builtIns.filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(normalized))
      : builtIns;
  }, [builtIns, query]);
  const categories = useMemo(() => [...new Set(filtered.map((item) => item.category))], [filtered]);

  return (
    <section aria-label="Section library" className="min-h-0 bg-white">
      {builtIns.length > 0 && (
        <div className="sticky top-0 z-10 border-b border-[#e7e7e7] bg-white p-3">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-[#c9cccf] px-3 shadow-sm focus-within:border-[#7b61a8] focus-within:ring-2 focus-within:ring-[#7b61a8]/15">
            <Search size={16} className="text-[#777]" />
            <span className="sr-only">Search sections</span>
            <input
              type="search"
              aria-label="Search sections"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sections"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-[#9a9a9a]"
            />
          </label>
        </div>
      )}

      <div className="space-y-5 p-3">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="mb-2 text-[11px] font-semibold text-[#616161]">{category}</h3>
            <div className="space-y-1">
              {filtered.filter((item) => item.category === category).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Add ${item.name}`}
                  onClick={() => onInsertBuiltIn?.(item.id)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium text-[#303030] transition hover:bg-[#f2eff7] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#7b61a8]"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#e3e3e3] bg-[#fafafa] text-[#6f5b92]"><LayoutPanelTop size={16} /></span>
                  <span className="truncate">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {builtIns.length > 0 && filtered.length === 0 && (
          <p className="py-8 text-center text-[12px] text-[#8c9196]">No sections match “{query}”.</p>
        )}

        {presets.length > 0 && (
          <div className="border-t border-[#eeeeee] pt-4">
            <h3 className="mb-2 text-[11px] font-semibold text-[#616161]">Saved sections</h3>
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
          </div>
        )}

        {builtIns.length === 0 && presets.length === 0 && (
          <p className="px-1 py-4 text-[12px] text-[#8c9196]">No sections are available for this template.</p>
        )}
      </div>
    </section>
  );
}
