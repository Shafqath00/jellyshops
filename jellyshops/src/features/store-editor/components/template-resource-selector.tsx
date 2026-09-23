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
  onPageTypeChange,
  previewQuery,
  onPreviewQueryChange,
}: {
  templates: TemplateSelectorOption[];
  activeTemplateId: string;
  previewResources: PreviewResourceOption[];
  previewResourceId?: string;
  onTemplateChange(templateId: string): void;
  onPreviewResourceChange(resourceId: string): void;
  onPageTypeChange?(pageType: StorefrontTemplateType): void;
  previewQuery?: string;
  onPreviewQueryChange?(query: string): void;
}) {
  const activeTemplate = templates.find((template) => template.id === activeTemplateId);
  const needsPreviewResource = activeTemplate ? activeTemplate.type !== "home" && activeTemplate.type !== "search" && activeTemplate.type !== "cart" && activeTemplate.type !== "not-found" : previewResources.length > 0;
  const pageType = activeTemplate?.type ? `${activeTemplate.type.charAt(0).toUpperCase()}${activeTemplate.type.slice(1)}` : "Home";
  const pageTypes: StorefrontTemplateType[] = ["home", "product", "collection", "cart", "search", "page", "blog", "article", "not-found"];

  return (
    <div className="grid gap-3 border-b border-[#eeeeee] bg-white p-4 sm:grid-cols-3" aria-label="Template and preview resource">
      <label className="grid gap-1.5 text-[11px] font-semibold text-[#616161]"><span>Page type</span><select aria-label="Page type" value={activeTemplate?.type ?? "home"} onChange={(event) => onPageTypeChange?.(event.target.value as StorefrontTemplateType)} className="h-9 rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[12px] text-[#303030] outline-none focus:border-[#616161]">{pageTypes.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase()}{type.slice(1)}</option>)}</select><span className="sr-only">Page type: {pageType}</span></label>
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

      {activeTemplate?.type === "search" && <label className="grid gap-1.5 text-[11px] font-semibold text-[#616161]">
        <span>Preview query</span>
        <input
          aria-label="Preview query"
          value={previewQuery ?? ""}
          onChange={(event) => onPreviewQueryChange?.(event.target.value)}
          placeholder="Search products"
          className="h-9 rounded-lg border border-[#c9cccf] bg-white px-2.5 text-[12px] text-[#303030] outline-none focus:border-[#616161]"
        />
      </label>}
    </div>
  );
}
