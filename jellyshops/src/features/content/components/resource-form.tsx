"use client";

import { useState } from "react";
import { Banner, Card, Field } from "@/components/admin";
import { SeoFields, validateSeoFields, type SeoFieldsValue } from "./seo-fields";
import type { MediaRecord } from "@/features/store-editor/api/types";

export interface EditableContentResource extends SeoFieldsValue {
  id: string;
  title: string;
}

export function ResourceForm({
  resource,
  templates,
  assignedTemplateId,
  onSave,
  onAssignTemplate,
  onCustomizeTemplate,
  listImages,
  storeSlug,
  pathPrefix,
}: {
  resource: EditableContentResource;
  templates: Array<{ id: string; name: string }>;
  assignedTemplateId?: string;
  onSave(value: EditableContentResource): void | Promise<void>;
  onAssignTemplate(input: { resourceId: string; templateId: string }): void | Promise<void>;
  onCustomizeTemplate(input: { resourceId: string; templateId: string }): void;
  listImages?: () => Promise<MediaRecord[]>;
  storeSlug?: string;
  pathPrefix?: string;
}) {
  const [value, setValue] = useState(resource);
  const [templateId, setTemplateId] = useState(assignedTemplateId ?? templates[0]?.id ?? "");
  const [submitted, setSubmitted] = useState(false);
  const issues = validateSeoFields(value);

  return (
    <form
      className="jk-form"
      onSubmit={(event) => {
        event.preventDefault();
        setSubmitted(true);
        if (Object.keys(issues).length > 0) return;
        void onSave(value);
      }}
    >
      <Card>
        <Field id={`resource-title-${resource.id}`} label="Title">
          <input id={`resource-title-${resource.id}`} aria-label="Title" value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} />
        </Field>
      </Card>

      <Card>
        <SeoFields value={value} fallbackTitle={value.title} listImages={listImages} storeSlug={storeSlug} pathPrefix={pathPrefix} onChange={(next) => setValue({ ...value, ...next })} />
      </Card>

      <Card title="Page layout" description="The store design layout this page uses.">
        <div className="jk-row">
          <label className="jk-field min-w-[180px] flex-1"><span className="sr-only">Template</span>
            <select aria-label="Template" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            aria-label="Assign template"
            disabled={!templateId || templateId === assignedTemplateId}
            onClick={() => templateId && void onAssignTemplate({ resourceId: resource.id, templateId })}
            className="jk-button"
          >
            Use this layout
          </button>
          <button
            type="button"
            aria-label="Customize template"
            disabled={!templateId}
            onClick={() => templateId && onCustomizeTemplate({ resourceId: resource.id, templateId })}
            className="jk-button jk-button-plain"
          >
            Edit in store designer
          </button>
        </div>
      </Card>

      {submitted && Object.keys(issues).length > 0 && <Banner tone="critical">Fix the search engine fields before saving.</Banner>}
      <div className="jk-row" style={{ justifyContent: "flex-end" }}><button type="submit" className="jk-button jk-button-primary">Save</button></div>
    </form>
  );
}
