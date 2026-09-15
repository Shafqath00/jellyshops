"use client";

export interface SeoFieldsValue {
  seoTitle: string | null;
  seoDescription: string | null;
  socialMediaId: string | null;
  noindex: boolean;
  canonicalOverride: string | null;
  handle: string;
}

export function validateSeoFields(value: SeoFieldsValue): Partial<Record<keyof SeoFieldsValue, string>> {
  const issues: Partial<Record<keyof SeoFieldsValue, string>> = {};
  if (value.seoTitle && value.seoTitle.length > 70) issues.seoTitle = "SEO title must be 70 characters or fewer";
  if (value.seoDescription && value.seoDescription.length > 160) issues.seoDescription = "SEO description must be 160 characters or fewer";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.handle)) issues.handle = "Handle must use lowercase letters, numbers, and hyphens";
  if (value.canonicalOverride) {
    try {
      const url = new URL(value.canonicalOverride);
      if (url.protocol !== "https:" && url.protocol !== "http:") issues.canonicalOverride = "Canonical URL must use http or https";
    } catch {
      issues.canonicalOverride = "Canonical URL must be absolute";
    }
  }
  return issues;
}

export function SeoFields({
  value,
  onChange,
}: {
  value: SeoFieldsValue;
  onChange(value: SeoFieldsValue): void;
}) {
  const issues = validateSeoFields(value);
  const field = (key: "seoTitle" | "seoDescription" | "socialMediaId" | "canonicalOverride") => value[key] ?? "";

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-[#303030]">Search engine listing</legend>
      <label className="block text-[12px] font-medium text-[#454f5b]">
        Handle
        <input aria-label="Handle" value={value.handle} onChange={(event) => onChange({ ...value, handle: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#d7d7d7] px-3" />
        {issues.handle && <span className="mt-1 block text-[11px] text-[#b42318]">{issues.handle}</span>}
      </label>
      <label className="block text-[12px] font-medium text-[#454f5b]">
        SEO title
        <input aria-label="SEO title" value={field("seoTitle")} onChange={(event) => onChange({ ...value, seoTitle: event.target.value || null })} className="mt-1 h-9 w-full rounded-lg border border-[#d7d7d7] px-3" />
        {issues.seoTitle && <span className="mt-1 block text-[11px] text-[#b42318]">{issues.seoTitle}</span>}
      </label>
      <label className="block text-[12px] font-medium text-[#454f5b]">
        SEO description
        <textarea aria-label="SEO description" value={field("seoDescription")} onChange={(event) => onChange({ ...value, seoDescription: event.target.value || null })} className="mt-1 min-h-24 w-full rounded-lg border border-[#d7d7d7] px-3 py-2" />
        {issues.seoDescription && <span className="mt-1 block text-[11px] text-[#b42318]">{issues.seoDescription}</span>}
      </label>
      <label className="block text-[12px] font-medium text-[#454f5b]">
        Social image media ID
        <input aria-label="Social image media ID" value={field("socialMediaId")} onChange={(event) => onChange({ ...value, socialMediaId: event.target.value || null })} className="mt-1 h-9 w-full rounded-lg border border-[#d7d7d7] px-3" />
      </label>
      <label className="block text-[12px] font-medium text-[#454f5b]">
        Canonical override
        <input aria-label="Canonical override" value={field("canonicalOverride")} onChange={(event) => onChange({ ...value, canonicalOverride: event.target.value || null })} className="mt-1 h-9 w-full rounded-lg border border-[#d7d7d7] px-3" />
        {issues.canonicalOverride && <span className="mt-1 block text-[11px] text-[#b42318]">{issues.canonicalOverride}</span>}
      </label>
      <label className="flex items-center gap-2 text-[12px] font-medium text-[#454f5b]">
        <input aria-label="Hide from search engines" type="checkbox" checked={value.noindex} onChange={(event) => onChange({ ...value, noindex: event.target.checked })} />
        Hide from search engines
      </label>
    </fieldset>
  );
}
