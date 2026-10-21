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
    <section aria-label="Section library" className="min-h-0 bg-card">
      {builtIns.length > 0 && (
        <div className="sticky top-0 z-10 border-b border-border bg-card p-3">
          <label className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 shadow-sm focus-within:border-border focus-within:ring-2 focus-within:ring-ring/40">
            <Search size={16} className="text-muted-foreground" />
            <span className="sr-only">Search sections</span>
            <input
              type="search"
              aria-label="Search sections"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sections"
              className="min-w-0 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
      )}

      <div className="space-y-5 p-3">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="mb-2 text-[11px] font-semibold text-muted-foreground">{category}</h3>
            <div className="space-y-1">
              {filtered.filter((item) => item.category === category).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Add ${item.name}`}
                  onClick={() => onInsertBuiltIn?.(item.id)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-muted/50 text-muted-foreground"><LayoutPanelTop size={16} /></span>
                  <span className="truncate">{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {builtIns.length > 0 && filtered.length === 0 && (
          <p className="py-8 text-center text-[12px] text-muted-foreground">No sections match “{query}”.</p>
        )}

        {presets.length > 0 && (
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-[11px] font-semibold text-muted-foreground">Saved sections</h3>
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-label={`Insert ${preset.name}`}
                onClick={() => onInsertPreset(structuredClone(preset.section))}
                className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[12px] font-medium text-muted-foreground hover:bg-muted/50"
              >
                <span className="truncate">{preset.name}</span>
              </button>
            ))}
          </div>
        )}

        {builtIns.length === 0 && presets.length === 0 && (
          <p className="px-1 py-4 text-[12px] text-muted-foreground">No sections are available for this template.</p>
        )}
      </div>
    </section>
  );
}
