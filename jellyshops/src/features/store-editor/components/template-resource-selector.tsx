import { storefrontPageTypes } from "@jelly/storefront-schema";
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
  const resourceFreeTypes: StorefrontTemplateType[] = ["home", "search", "cart", "not-found", "checkout", "wishlist", "customer-login", "customer-register", "customer-recovery", "customer-account", "customer-orders", "customer-order", "customer-addresses", "order-success"];
  const needsPreviewResource = activeTemplate ? !resourceFreeTypes.includes(activeTemplate.type) : previewResources.length > 0;
  const pageType = activeTemplate?.type ? `${activeTemplate.type.charAt(0).toUpperCase()}${activeTemplate.type.slice(1)}` : "Home";
  const pageTypes: readonly StorefrontTemplateType[] = storefrontPageTypes;

  return (
    <div className="grid gap-3 border-b border-border bg-card p-4 sm:grid-cols-3" aria-label="Template and preview resource">
      <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground"><span>Page type</span><select aria-label="Page type" value={activeTemplate?.type ?? "home"} onChange={(event) => onPageTypeChange?.(event.target.value as StorefrontTemplateType)} className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border">{pageTypes.map((type) => <option key={type} value={type}>{type.charAt(0).toUpperCase()}{type.slice(1)}</option>)}</select><span className="sr-only">Page type: {pageType}</span></label>
      <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span>Template</span>
        <select
          aria-label="Template"
          value={activeTemplateId}
          onChange={(event) => onTemplateChange(event.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span>Preview resource</span>
        <select
          aria-label="Preview resource"
          value={previewResourceId ?? ""}
          disabled={!needsPreviewResource || previewResources.length === 0}
          onChange={(event) => onPreviewResourceChange(event.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border disabled:bg-muted/50 disabled:text-muted-foreground"
        >
          {!previewResourceId && <option value="">Select resource</option>}
          {previewResources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.label}
            </option>
          ))}
        </select>
      </label>

      {activeTemplate?.type === "search" && <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span>Preview query</span>
        <input
          aria-label="Preview query"
          value={previewQuery ?? ""}
          onChange={(event) => onPreviewQueryChange?.(event.target.value)}
          placeholder="Search products"
          className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border"
        />
      </label>}
    </div>
  );
}
