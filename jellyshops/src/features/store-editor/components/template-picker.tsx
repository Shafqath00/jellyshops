"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { StorefrontTemplateRecord, StorefrontTemplateType, TemplateAssignmentRecord } from "../api/types";
import { isMainTemplate, selectableTemplates, type AssignableTemplateType } from "../template-names";

/** The calls the picker makes; the editor's store API provides all of them. */
export interface TemplatePickerApi {
  listTemplates(storeId: string, type?: StorefrontTemplateType): Promise<StorefrontTemplateRecord[]>;
  getAssignment(storeId: string, resourceType: AssignableTemplateType, resourceId: string): Promise<TemplateAssignmentRecord | null>;
  assignTemplate(storeId: string, resourceType: AssignableTemplateType, resourceId: string, templateId: string, expectedRevision: number | null): Promise<{ assignment: TemplateAssignmentRecord }>;
  removeAssignment(storeId: string, resourceType: AssignableTemplateType, resourceId: string, expectedRevision: number): Promise<unknown>;
}

const nouns: Record<AssignableTemplateType, string> = { product: "product", collection: "collection", page: "page", blog: "blog", article: "blog post" };

/**
 * "Page layout" choice for one product, collection or page. Saving is immediate; the live store
 * changes the next time the merchant publishes, like every other storefront change.
 */
export function TemplatePicker({ api, storeId, resourceType, resourceId, className }: {
  api: TemplatePickerApi;
  storeId: string;
  resourceType: AssignableTemplateType;
  resourceId: string;
  className?: string;
}) {
  const [templates, setTemplates] = useState<StorefrontTemplateRecord[]>();
  const [assignment, setAssignment] = useState<TemplateAssignmentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const noun = nouns[resourceType];

  useEffect(() => {
    let active = true;
    void Promise.all([api.listTemplates(storeId, resourceType), api.getAssignment(storeId, resourceType, resourceId)])
      .then(([nextTemplates, nextAssignment]) => {
        if (!active) return;
        setTemplates(selectableTemplates(nextTemplates, resourceType));
        setAssignment(nextAssignment);
      })
      .catch(() => { if (active) { setTemplates([]); setError("Page layouts couldn't be loaded."); } });
    return () => { active = false; };
  }, [api, storeId, resourceType, resourceId]);

  const main = templates?.find(isMainTemplate);
  // An assignment to a template that is no longer offered still shows, so the merchant can see and change it.
  const assigned = assignment ? templates?.find((template) => template.id === assignment.templateId) : undefined;
  const orphaned = Boolean(assignment && !assigned);
  const value = orphaned ? assignment!.templateId : assigned && !isMainTemplate(assigned) ? assigned.id : "";

  async function choose(templateId: string) {
    setSaving(true); setError(undefined); setNotice(undefined);
    try {
      const chosen = templates?.find((template) => template.id === templateId);
      if (!templateId || (chosen && isMainTemplate(chosen))) {
        if (assignment) await api.removeAssignment(storeId, resourceType, resourceId, assignment.revision);
        setAssignment(null);
      } else {
        const result = await api.assignTemplate(storeId, resourceType, resourceId, templateId, assignment?.revision ?? null);
        setAssignment(result.assignment);
      }
      setNotice("Saved. Your live store shows it after you publish.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The page layout couldn't be saved. Try again.");
    } finally { setSaving(false); }
  }

  if (!templates) return <div className={className}><p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={13} className="animate-spin motion-reduce:animate-none" />Loading page layouts…</p></div>;

  const others = templates.filter((template) => !isMainTemplate(template));
  return <div className={className}>
    <label className="block text-sm font-medium" htmlFor={`template-${resourceType}-${resourceId}`}>Page layout</label>
    {others.length || assignment ? <>
      <select id={`template-${resourceType}-${resourceId}`} value={value} disabled={saving} onChange={(event) => void choose(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-border bg-card px-2 text-sm disabled:opacity-60">
        <option value="">{main ? `${main.name} (main ${noun} template)` : `Main ${noun} template`}</option>
        {others.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        {orphaned && <option value={assignment!.templateId} disabled>Layout from a previous store design</option>}
      </select>
      <p className="mt-1 text-xs text-muted-foreground">Choose how this {noun} page is laid out. Edit layouts in the <Link href="/admin/online-store/editor" className="underline">theme editor</Link>.</p>
    </> : <p className="mt-1 text-xs leading-5 text-muted-foreground">This {noun} uses the main {noun} template. To give it a different layout, create another {noun} template in the <Link href="/admin/online-store/editor" className="underline">theme editor</Link>.</p>}
    {notice && <p role="status" className="mt-1 text-xs text-muted-foreground">{notice}</p>}
    {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
  </div>;
}
