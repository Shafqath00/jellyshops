"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Home, Search } from "lucide-react";
import type { StorefrontTemplateType } from "../api/types";
import { isRetainedTemplate } from "../template-selection";
import { BUILT_IN_PAGES_NOTE, pagePickerButtonLabel, pagePickerGroups, pagePickerTemplateLabel, previewResourceNoun } from "../page-picker-groups";
import type { PreviewResourceOption, TemplateSelectorOption } from "./template-resource-selector";

const resourceFreeTypes: readonly StorefrontTemplateType[] = ["home", "search", "cart", "not-found", "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"];

export function EditorPagePicker({ templates, activeTemplateId, previewResources, previewResourceId, previewQuery, onTemplateChange, onPreviewResourceChange, onPageTypeChange, onPreviewQueryChange }: {
  templates: TemplateSelectorOption[];
  activeTemplateId: string;
  previewResources: PreviewResourceOption[];
  previewResourceId?: string;
  previewQuery?: string;
  onTemplateChange(id: string): void;
  onPreviewResourceChange(id: string): void;
  onPageTypeChange(type: StorefrontTemplateType): void;
  onPreviewQueryChange(query: string): void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const [query, setQuery] = useState("");
  const [showOlder, setShowOlder] = useState(false);
  const active = templates.find((item) => item.id === activeTemplateId);
  const groups = pagePickerGroups(templates, query);
  const olderCount = groups.reduce((total, group) => total + group.older.length, 0);
  const olderVisible = showOlder || Boolean(active && isRetainedTemplate(active));
  const choose = (id: string) => { onTemplateChange(id); setOpen(false); setQuery(""); };
  const itemClass = "flex min-h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-[13px] hover:bg-muted aria-[current=page]:bg-muted aria-[current=page]:font-semibold";
  const buttonLabel = pagePickerButtonLabel(active);
  return <div ref={root} className="relative min-w-0 max-w-[120px] sm:max-w-[220px]" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)} className="flex h-9 w-full min-w-0 max-w-[220px] items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><Home size={15} className="shrink-0" /><span className="hidden min-w-0 flex-1 truncate sm:inline">{buttonLabel}</span><span className="min-w-0 flex-1 truncate sm:hidden">{buttonLabel.replace(/ page$/i, "")}</span><ChevronDown size={14} className="shrink-0" /></button>
    {open && <div role="dialog" aria-label="Choose a page" className="absolute left-0 top-full z-[80] mt-2 w-[min(300px,85vw)] sm:left-1/2 sm:w-[340px] sm:-translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card p-2 text-foreground shadow-xl">
      <label className="flex h-9 items-center gap-2 rounded-lg border border-border px-2"><Search size={15} className="text-muted-foreground" /><input autoFocus type="search" aria-label="Search pages" placeholder="Search pages" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" /></label>
      <div className="mt-2 max-h-[min(50vh,400px)] overflow-y-auto">
        {groups.map((group) => {
          const single = group.current.length === 1 && !(olderVisible && group.older.length);
          return <section key={group.type} className="border-b border-border/70 py-1 last:border-0">
            {single ? <button type="button" onClick={() => choose(group.current[0].id)} className={itemClass} aria-current={group.current[0].id === activeTemplateId ? "page" : undefined}>{group.label}</button> : <>
              <h2 className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">{group.label}</h2>
              {group.current.map((item) => <button key={item.id} type="button" onClick={() => choose(item.id)} className={itemClass} aria-current={item.id === activeTemplateId ? "page" : undefined}><span className="truncate">{pagePickerTemplateLabel(item)}</span></button>)}
              {!group.current.length && <button type="button" onClick={() => { onPageTypeChange(group.type as StorefrontTemplateType); setOpen(false); setQuery(""); }} className={itemClass}>Set up {group.label.toLowerCase()}</button>}
              {olderVisible && group.older.map((item, index) => <button key={item.id} type="button" onClick={() => choose(item.id)} className={`${itemClass} text-muted-foreground`} aria-current={item.id === activeTemplateId ? "page" : undefined}><span className="truncate">{pagePickerTemplateLabel(item, group.older.length > 1 ? index : undefined)}</span><span className="text-[11px]">not live</span></button>)}
            </>}
          </section>;
        })}
        {!groups.length && <p className="p-3 text-xs text-muted-foreground">No matching pages.</p>}
      </div>
      {olderCount > 0 && !(active && isRetainedTemplate(active)) && <button type="button" onClick={() => setShowOlder(!showOlder)} className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-muted">{showOlder ? "Hide earlier versions" : `Show earlier versions (${olderCount})`}</button>}
      <p className="mt-1 border-t border-border px-2 pt-2 text-[11px] leading-4 text-muted-foreground">{BUILT_IN_PAGES_NOTE}</p>
      {active && !resourceFreeTypes.includes(active.type) && <label className="mt-2 block border-t border-border pt-2 text-xs font-medium text-muted-foreground">{`Which ${previewResourceNoun(active.type)} to show`}<select aria-label={`Which ${previewResourceNoun(active.type)} to show`} value={previewResourceId ?? ""} disabled={!previewResources.length} onChange={(event) => onPreviewResourceChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-foreground disabled:opacity-50">{!previewResourceId && <option value="">Choose a {previewResourceNoun(active.type)}</option>}{previewResources.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
      {active?.type === "search" && <label className="mt-2 block border-t border-border pt-2 text-xs font-medium text-muted-foreground">Show results for<input aria-label="Show results for" value={previewQuery ?? ""} onChange={(event) => onPreviewQueryChange(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-foreground" /></label>}
    </div>}
  </div>;
}
