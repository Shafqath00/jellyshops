"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Copy, LayoutTemplate, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { pageTypeLabel } from "@jelly/storefront-registry";
import type { StorefrontTemplateRecord, StorefrontTemplateType, TemplateMutationResult } from "../api/types";
import { isAssignableTemplateType, isMainTemplate, selectableTemplates, templateHandleFromName, withFreshSectionIds } from "../template-names";

/** The template calls this panel makes; the editor's store API provides all of them. */
export interface TemplateActionsApi {
  cloneTemplate(storeId: string, templateId: string, input: { name: string; handle: string }): Promise<TemplateMutationResult>;
  createTemplate(storeId: string, input: { type: StorefrontTemplateType; name: string; handle?: string; layout: Record<string, unknown> }): Promise<TemplateMutationResult>;
  updateTemplate(storeId: string, templateId: string, expectedRevision: number, patch: { name?: string }): Promise<TemplateMutationResult>;
  deleteTemplate(storeId: string, templateId: string, expectedRevision: number): Promise<{ templateId: string; generation: number }>;
}

const nouns: Record<string, string> = { product: "product", collection: "collection", page: "page", blog: "blog", article: "blog post" };

const usedBy: Record<string, string> = {
  product: "products",
  collection: "collections",
  page: "pages",
  blog: "blogs",
  article: "blog posts",
};

const button = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-muted disabled:opacity-50";
const primary = "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50";
const field = "mt-1 h-9 w-full rounded-lg border border-border bg-card px-2 text-[13px] text-foreground";

/**
 * Create, rename and delete the templates of the page type being edited. Every change waits for
 * pending edits to save first, so a template is never copied or renamed from a stale revision.
 */
export function TemplateActions({ api, storeId, activeTemplate, templates, latest, blankLayout, flush, disabled, onCreated, onUpdated, onDeleted }: {
  api: TemplateActionsApi;
  storeId: string;
  activeTemplate: StorefrontTemplateRecord;
  templates: StorefrontTemplateRecord[];
  /** The newest saved copy of a template; read after `flush` so its revision is current. */
  latest(templateId: string): StorefrontTemplateRecord | undefined;
  /** Starting layout for "Start with the basic layout". */
  blankLayout: Record<string, unknown>;
  flush(): Promise<boolean>;
  disabled?: boolean;
  onCreated(template: StorefrontTemplateRecord, generation: number): void;
  onUpdated(template: StorefrontTemplateRecord, generation: number): void;
  onDeleted(templateId: string, generation: number): void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "create" | "rename">("menu");
  const [name, setName] = useState("");
  const [start, setStart] = useState<"copy" | "blank">("copy");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const type = activeTemplate.type;
  const assignable = isAssignableTemplateType(type);
  const label = pageTypeLabel(type);
  const siblings = selectableTemplates(templates, type);
  const main = isMainTemplate(activeTemplate);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) { setOpen(false); setMode("menu"); setError(undefined); }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  function close() { setOpen(false); setMode("menu"); setError(undefined); setName(""); }

  async function run(work: () => Promise<void>) {
    setBusy(true); setError(undefined);
    try {
      if (!await flush()) { setError("Your latest edits haven't saved yet. Try again in a moment."); return; }
      await work();
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "That didn't work. Try again.");
    } finally { setBusy(false); }
  }

  const create = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Give the template a name."); return; }
    const handle = templateHandleFromName(trimmed, templates.filter((template) => template.type === type));
    void run(async () => {
      const result = start === "copy"
        ? await api.cloneTemplate(storeId, activeTemplate.id, { name: trimmed, handle })
        : await api.createTemplate(storeId, { type, name: trimmed, handle, layout: withFreshSectionIds(blankLayout) });
      onCreated(result.template, result.generation);
    });
  };

  const rename = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Give the template a name."); return; }
    void run(async () => {
      const current = latest(activeTemplate.id) ?? activeTemplate;
      const result = await api.updateTemplate(storeId, current.id, current.revision, { name: trimmed });
      onUpdated(result.template, result.generation);
    });
  };

  const remove = () => {
    if (!window.confirm(`Delete the "${activeTemplate.name}" template? Your live store doesn't change until you publish.`)) return;
    void run(async () => {
      const current = latest(activeTemplate.id) ?? activeTemplate;
      const result = await api.deleteTemplate(storeId, current.id, current.revision);
      onDeleted(result.templateId, result.generation);
    });
  };

  return <div ref={root} className="relative" onKeyDown={(event) => { if (event.key === "Escape") { close(); trigger.current?.focus(); } }}>
    <button ref={trigger} type="button" aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onClick={() => (open ? close() : setOpen(true))} className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-foreground hover:bg-muted disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <LayoutTemplate size={15} className="shrink-0" /><span className="hidden max-w-[140px] truncate md:inline">{activeTemplate.name}</span><span className="sr-only md:hidden">Templates</span>
    </button>
    {open && <div role="dialog" aria-label={`Templates for ${label.toLowerCase()}`} className="absolute left-0 top-full z-[80] mt-2 w-[min(320px,88vw)] rounded-xl border border-border bg-card p-3 text-foreground shadow-xl">
      <p className="text-[11px] font-semibold text-muted-foreground">Templates for {label.toLowerCase()}</p>
      <p className="mt-1 text-[13px] font-semibold">{activeTemplate.name}{main && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Main</span>}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {assignable
          ? main
            ? `All ${usedBy[type]} use this template unless you choose another one for them.`
            : `Only the ${usedBy[type]} you pick it for use this template. Pick it when you edit a ${nouns[type]} in your admin.`
          : "Your store uses one template for this page."}
      </p>
      {assignable && siblings.length > 1 && mode === "menu" && <p className="mt-1 text-xs text-muted-foreground">{siblings.length} {nouns[type]} templates in total. Switch between them from the page menu.</p>}

      {mode === "menu" && <div className="mt-3 grid gap-2">
        {assignable && <button type="button" className={button} disabled={busy} onClick={() => { setMode("create"); setName(""); setStart("copy"); setError(undefined); }}><Plus size={14} />Create a {nouns[type]} template</button>}
        <button type="button" className={button} disabled={busy} onClick={() => { setMode("rename"); setName(activeTemplate.name); setError(undefined); }}><Pencil size={14} />Rename</button>
        {!main && <button type="button" className={`${button} text-destructive`} disabled={busy} onClick={remove}>{busy ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <Trash2 size={14} />}Delete template</button>}
      </div>}

      {mode === "create" && <form className="mt-3 grid gap-3" onSubmit={create}>
        <label className="text-xs font-medium text-muted-foreground">Template name<input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={type === "product" ? "For example: Mattress" : "For example: Sale"} className={field} /></label>
        <fieldset className="grid gap-1 text-[13px]"><legend className="mb-1 text-xs font-medium text-muted-foreground">Start with</legend>
          <label className="flex items-center gap-2"><input type="radio" name="template-start" checked={start === "copy"} onChange={() => setStart("copy")} /><Copy size={13} />A copy of “{activeTemplate.name}”</label>
          <label className="flex items-center gap-2"><input type="radio" name="template-start" checked={start === "blank"} onChange={() => setStart("blank")} /><LayoutTemplate size={13} />The basic layout</label>
        </fieldset>
        <div className="flex gap-2"><button type="submit" className={primary} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}Create template</button><button type="button" className={button} disabled={busy} onClick={() => setMode("menu")}>Cancel</button></div>
      </form>}

      {mode === "rename" && <form className="mt-3 grid gap-3" onSubmit={rename}>
        <label className="text-xs font-medium text-muted-foreground">Template name<input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} className={field} /></label>
        <div className="flex gap-2"><button type="submit" className={primary} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />}Save name</button><button type="button" className={button} disabled={busy} onClick={() => setMode("menu")}>Cancel</button></div>
      </form>}

      {error && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{error}</p>}
    </div>}
  </div>;
}
