import type { StorefrontTemplateType } from "../api/types";

export interface TemplateSelectorOption {
  id: string;
  type: StorefrontTemplateType;
  handle: string;
  name: string;
}

export interface PreviewResourceOption {
  id: string;
  label: string;
}

export function TemplateResourceSelector({
  templates,
  activeTemplateId,
  previewResources,
  previewResourceId,
  onTemplateChange,
  onPreviewResourceChange,
}: {
  templates: TemplateSelectorOption[];
  activeTemplateId: string;
  previewResources: PreviewResourceOption[];
  previewResourceId?: string;
  onTemplateChange(templateId: string): void;
  onPreviewResourceChange(resourceId: string): void;
}) {
  const activeTemplate = templates.find((template) => template.id === activeTemplateId);
  const needsPreviewResource = activeTemplate ? activeTemplate.type !== "home" && activeTemplate.type !== "search" && activeTemplate.type !== "cart" : previewResources.length > 0;

  return (
    <div className="grid gap-3 border-b border-[#eeeeee] bg-white p-4 sm:grid-cols-2" aria-label="Template and preview resource">
      <label className="grid gap-1.5 text-[11px] font-semibold text-[#616161]">
        <span>Template</span>
        <select
          aria-label="Template"
          value={activeTemplateId}
          onChange={(event) => onTemplateChange(event.target.value)}
          className="h-9 rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[12px] text-[#303030] outline-none focus:border-[#616161]"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-[11px] font-semibold text-[#616161]">
        <span>Preview resource</span>
        <select
          aria-label="Preview resource"
          value={previewResourceId ?? ""}
          disabled={!needsPreviewResource || previewResources.length === 0}
          onChange={(event) => onPreviewResourceChange(event.target.value)}
          className="h-9 rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[12px] text-[#303030] outline-none focus:border-[#616161] disabled:bg-[#f6f6f7] disabled:text-[#8c9196]"
        >
          {!previewResourceId && <option value="">Select resource</option>}
          {previewResources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
