"use client";

import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { inputClass, labelClass } from "@/features/commerce/components/product-form-styles";
import { buildCategoryPaths, searchCategoryPaths, type Taxonomy, type TaxonomyCategory } from "../taxonomy";
import { Section } from "./section-parts";

type Props = {
  taxonomy: Taxonomy | null;
  loading: boolean;
  error: string;
  selectedId: string;
  onSelect: (id: string) => void;
  onCreate?: (input: { name: string; parentId: string | null }) => Promise<TaxonomyCategory>;
};

export function CategorySection({ taxonomy, loading, error, selectedId, onSelect, onCreate }: Props) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParent, setNewParent] = useState("");
  const [createError, setCreateError] = useState("");
  const paths = useMemo(() => buildCategoryPaths(taxonomy?.categories ?? []), [taxonomy]);
  const selected = paths.find((path) => path.id === selectedId);
  const matches = useMemo(() => searchCategoryPaths(paths, query).slice(0, 60), [paths, query]);

  async function create() {
    if (!onCreate) return;
    if (!newName.trim()) return setCreateError("Enter a category name.");
    setCreateError("");
    try {
      const category = await onCreate({ name: newName.trim(), parentId: newParent || null });
      onSelect(category.id);
      setAdding(false);
      setNewName("");
      setNewParent("");
    } catch (caught) { setCreateError(caught instanceof Error ? caught.message : "Could not add that category."); }
  }

  return (
    <Section title="Category" hint="Helps shoppers find it, and lets us suggest the right options later.">
      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-tint-border bg-muted/50 px-4 py-3">
          <p className="text-[12px] font-black text-foreground">{selected.label}</p>
          <button type="button" onClick={() => onSelect("")} aria-label="Clear category" className="grid size-7 place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"><X size={13} /></button>
        </div>
      ) : (
        <>
          <label htmlFor="pb-category-search" className="sr-only">Search categories</label>
          <input id="pb-category-search" type="search" className={inputClass} placeholder={loading ? "Loading categories…" : "Search, e.g. t-shirts or beds"} value={query} disabled={loading || Boolean(error)} onChange={(event) => setQuery(event.target.value)} />
          {error && <p role="alert" className="text-[11px] font-bold text-tint-foreground">{error}</p>}
          {!loading && !error && (
            <ul className="max-h-56 overflow-y-auto rounded-2xl border border-border" aria-label="Categories">
              {matches.length === 0 && <li className="px-4 py-3 text-[11px] text-muted-foreground">No match. Add it below.</li>}
              {matches.map((path) => (
                <li key={path.id}>
                  <button type="button" onClick={() => onSelect(path.id)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[12px] font-semibold text-foreground hover:bg-muted/60" style={query ? undefined : { paddingLeft: `${1 + (path.names.length - 1) * 0.9}rem` }}>
                    <span>{query ? path.label : path.names[path.names.length - 1]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {onCreate && !loading && !error && (adding ? (
        <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
          <div>
            <label htmlFor="pb-new-category" className={labelClass}>New category name</label>
            <input id="pb-new-category" className={inputClass} value={newName} onChange={(event) => setNewName(event.target.value)} />
          </div>
          <div>
            <label htmlFor="pb-new-parent" className={labelClass}>Inside</label>
            <select id="pb-new-parent" className={inputClass} value={newParent} onChange={(event) => setNewParent(event.target.value)}>
              <option value="">Top level</option>
              {paths.map((path) => <option key={path.id} value={path.id}>{path.label}</option>)}
            </select>
          </div>
          {createError && <p role="alert" className="text-[11px] font-bold text-tint-foreground">{createError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void create()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[11px] font-black text-primary-foreground"><Check size={13} />Add category</button>
            <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-full px-3 text-[11px] font-bold text-muted-foreground">Cancel</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 text-[11px] font-black text-tint-foreground"><Plus size={13} />Add your own category</button>
      ))}
    </Section>
  );
}
