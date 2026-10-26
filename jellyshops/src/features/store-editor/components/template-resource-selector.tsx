import { pageTypeLabel } from "@jelly/storefront-registry";
import { storefrontPageTypes } from "@jelly/storefront-schema";
import type { StorefrontTemplateType } from "../api/types";
import { isRetainedTemplate } from "../template-selection";

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
  const pageType = pageTypeLabel(activeTemplate?.type ?? "home");
  const pageTypes: readonly StorefrontTemplateType[] = storefrontPageTypes;

  return (
    <div className="grid gap-3 border-b border-border bg-card p-4 sm:grid-cols-3" aria-label="Page to edit">
      <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground"><span>Page</span><select aria-label="Page" value={activeTemplate?.type ?? "home"} onChange={(event) => onPageTypeChange?.(event.target.value as StorefrontTemplateType)} className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border">{pageTypes.map((type) => <option key={type} value={type}>{pageTypeLabel(type)}</option>)}</select><span className="sr-only">Page: {pageType}</span></label>
      <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span>Layout</span>
        <select
          aria-label="Layout"
          value={activeTemplateId}
          onChange={(event) => onTemplateChange(event.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border"
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}{isRetainedTemplate(template) ? " (previous template)" : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span>Preview with</span>
        <select
          aria-label="Preview with"
          value={previewResourceId ?? ""}
          disabled={!needsPreviewResource || previewResources.length === 0}
          onChange={(event) => onPreviewResourceChange(event.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border disabled:bg-muted/50 disabled:text-muted-foreground"
        >
          {!previewResourceId && <option value="">{needsPreviewResource ? "Choose an item to preview" : "Not needed for this page"}</option>}
          {previewResources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.label}
            </option>
          ))}
        </select>
      </label>

      {activeTemplate?.type === "search" && <label className="grid gap-1.5 text-[11px] font-semibold text-muted-foreground">
        <span>Preview search for</span>
        <input
          aria-label="Preview search for"
          value={previewQuery ?? ""}
          onChange={(event) => onPreviewQueryChange?.(event.target.value)}
          placeholder="Search products"
          className="h-9 rounded-lg border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-border"
        />
      </label>}
    </div>
  );
}
