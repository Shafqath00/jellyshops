"use client";

import { useCallback, useState } from "react";
import { ImageIcon } from "lucide-react";
import { HelpTip, Picker } from "@/components/admin";
import type { MediaRecord } from "@/features/store-editor/api/types";

export interface SeoFieldsValue {
  seoTitle: string | null;
  seoDescription: string | null;
  socialMediaId: string | null;
  noindex: boolean;
  canonicalOverride: string | null;
  handle: string;
}

const TITLE_MAX = 70, DESCRIPTION_MAX = 160;

export function validateSeoFields(value: SeoFieldsValue): Partial<Record<keyof SeoFieldsValue, string>> {
  const issues: Partial<Record<keyof SeoFieldsValue, string>> = {};
  if (value.seoTitle && value.seoTitle.length > TITLE_MAX) issues.seoTitle = "SEO title must be 70 characters or fewer";
  if (value.seoDescription && value.seoDescription.length > DESCRIPTION_MAX) issues.seoDescription = "SEO description must be 160 characters or fewer";
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

const input = "mt-1 h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground";
const count = (text: string | null, max: number) => <span className={`text-[11px] ${(text?.length ?? 0) > max ? "text-destructive" : "text-muted-foreground"}`}>{text?.length ?? 0} of {max} characters</span>;

/**
 * How the page looks in search results and when shared. A preview shows the result as it is typed;
 * the social image is chosen from the store's files; the rarely needed settings sit under Advanced.
 */
export function SeoFields({ value, onChange, fallbackTitle = "", pathPrefix = "/pages/", storeSlug, listImages }: {
  value: SeoFieldsValue;
  onChange(value: SeoFieldsValue): void;
  fallbackTitle?: string;
  pathPrefix?: string;
  storeSlug?: string;
  /** The store's files; without it the image can't be chosen here. */
  listImages?: () => Promise<MediaRecord[]>;
}) {
  const [picking, setPicking] = useState(false);
  const [image, setImage] = useState<{ id: string; url: string } | null>(null);
  const issues = validateSeoFields(value);
  const loadImages = useCallback(async (query: string) => {
    if (!listImages) throw new Error("Sign in to choose an image.");
    const media = await listImages();
    return media.filter((item) => item.mimeType.startsWith("image/") && item.originalName.toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({ id: item.id, label: item.originalName || "Image", detail: `${item.width} × ${item.height}`, media: <img src={item.url} alt="" className="jk-thumb" /> }));
  }, [listImages]);
  const title = value.seoTitle || fallbackTitle || "Page title";
  const address = `${storeSlug ? `/${storeSlug}` : ""}${pathPrefix}${value.handle || "page"}`;

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-foreground">Search engine listing</legend>
      <div className="rounded-lg border border-border bg-muted/40 p-3" aria-label="Search result preview">
        <p className="text-[11px] text-muted-foreground">How it may look in search results</p>
        <p className="mt-1 truncate text-[15px] text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
        <p className="truncate text-[12px] text-[#006621] dark:text-[#7fc492]">{address}</p>
        <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{value.seoDescription || "Add a description to tell shoppers what this page is about."}</p>
      </div>
      <label className="block text-[12px] font-medium text-muted-foreground">
        SEO title
        <input aria-label="SEO title" value={value.seoTitle ?? ""} placeholder={fallbackTitle} onChange={(event) => onChange({ ...value, seoTitle: event.target.value || null })} className={input} />
        {issues.seoTitle ? <span className="mt-1 block text-[11px] text-destructive">{issues.seoTitle}</span> : count(value.seoTitle, TITLE_MAX)}
      </label>
      <label className="block text-[12px] font-medium text-muted-foreground">
        SEO description
        <textarea aria-label="SEO description" value={value.seoDescription ?? ""} onChange={(event) => onChange({ ...value, seoDescription: event.target.value || null })} className={`${input} min-h-20 py-2`} />
        {issues.seoDescription ? <span className="mt-1 block text-[11px] text-destructive">{issues.seoDescription}</span> : count(value.seoDescription, DESCRIPTION_MAX)}
      </label>
      <label className="block text-[12px] font-medium text-muted-foreground">
        URL handle <HelpTip>The last part of the page address. Changing it breaks links people already shared.</HelpTip>
        <span className="mt-1 flex items-center rounded-lg border border-border bg-card"><span className="pl-3 text-[13px] text-muted-foreground">{pathPrefix}</span>
          <input aria-label="Handle" value={value.handle} onChange={(event) => onChange({ ...value, handle: event.target.value })} className="h-9 min-w-0 flex-1 rounded-r-lg bg-transparent pr-3 text-[13px] text-foreground outline-none" /></span>
        {issues.handle && <span className="mt-1 block text-[11px] text-destructive">{issues.handle}</span>}
      </label>
      <div className="text-[12px] font-medium text-muted-foreground">
        <span>Social sharing image</span> <HelpTip>Shown when someone shares this page on social media or in a chat.</HelpTip>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {value.socialMediaId ? image?.id === value.socialMediaId ? <img src={image.url} alt="Chosen social sharing image" className="jk-thumb !size-14" /> : <span className="jk-thumb !size-14"><ImageIcon size={18} aria-hidden="true" /></span> : null}
          {listImages && <button type="button" className="jk-button" onClick={() => setPicking(true)}>{value.socialMediaId ? "Change image" : "Choose image"}</button>}
          {value.socialMediaId && <button type="button" className="jk-button jk-button-plain" onClick={() => { onChange({ ...value, socialMediaId: null }); setImage(null); }}>Remove</button>}
          {value.socialMediaId && image?.id !== value.socialMediaId && <span className="text-[11px]">An image is chosen.</span>}
        </div>
      </div>
      <details className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-[12px] font-medium text-foreground">Advanced</summary>
        <label className="mt-3 block text-[12px] font-medium text-muted-foreground">
          Canonical address (optional) <HelpTip>Only if the same content lives at another address and search engines should use that one.</HelpTip>
          <input aria-label="Canonical override" placeholder="https://" value={value.canonicalOverride ?? ""} onChange={(event) => onChange({ ...value, canonicalOverride: event.target.value || null })} className={input} />
          {issues.canonicalOverride && <span className="mt-1 block text-[11px] text-destructive">{issues.canonicalOverride}</span>}
        </label>
        <label className="mt-3 flex items-center gap-2 text-[12px] font-medium text-muted-foreground">
          <input aria-label="Hide from search engines" type="checkbox" checked={value.noindex} onChange={(event) => onChange({ ...value, noindex: event.target.checked })} />
          Hide from search engines
        </label>
      </details>
      <Picker open={picking} onOpenChange={setPicking} title="Choose a social sharing image" searchLabel="Search images" multiple={false} doneLabel="Use image" load={loadImages}
        onDone={(items) => { const picked = items[0]; if (!picked) return; onChange({ ...value, socialMediaId: picked.id }); void listImages?.().then((media) => { const found = media.find((item) => item.id === picked.id); if (found) setImage({ id: found.id, url: found.url }); }); }} />
    </fieldset>
  );
}
