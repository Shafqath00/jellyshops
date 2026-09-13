"use client";

import { useState } from "react";
import { SeoFields, validateSeoFields, type SeoFieldsValue } from "./seo-fields";

export interface EditableContentResource extends SeoFieldsValue {
  id: string;
  title: string;
}

export function ResourceForm({
  resource,
  templates,
  assignedTemplateId,
  onSave,
  onCustomizeTemplate,
}: {
  resource: EditableContentResource;
  templates: Array<{ id: string; name: string }>;
  assignedTemplateId?: string;
  onSave(value: EditableContentResource): void | Promise<void>;
  onCustomizeTemplate(input: { resourceId: string; templateId: string }): void;
}) {
  const [value, setValue] = useState(resource);
  const [templateId, setTemplateId] = useState(assignedTemplateId ?? templates[0]?.id ?? "");
  const [submitted, setSubmitted] = useState(false);
  const issues = validateSeoFields(value);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(issues).length > 0) return;
        void onSave(value);
      }}
    >
      <label className="block text-[12px] font-medium text-[#454f5b]">
        Title
        <input aria-label="Title" value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#d7d7d7] px-3" />
      </label>

      <SeoFields value={value} onChange={(next) => setValue({ ...value, ...next })} />

      <section className="rounded-xl border border-[#e3e3e3] bg-[#fafafa] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Template</p>
        <div className="mt-2 flex gap-2">
          <select aria-label="Template" value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[#d7d7d7] bg-white px-3 text-[12px]">
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
          <button
            type="button"
            aria-label="Customize template"
            disabled={!templateId}
            onClick={() => templateId && onCustomizeTemplate({ resourceId: resource.id, templateId })}
            className="h-9 rounded-lg border border-[#c9cccf] bg-white px-3 text-[11px] font-semibold disabled:opacity-40"
          >
            Customize template
          </button>
        </div>
      </section>

      {submitted && Object.keys(issues).length > 0 && <p role="alert" className="text-[12px] text-[#b42318]">Fix the SEO fields before saving.</p>}
      <button type="submit" className="h-9 rounded-lg bg-[#303030] px-4 text-[12px] font-semibold text-white">Save</button>
    </form>
  );
}
