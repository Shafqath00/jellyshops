"use client";

import { useCallback, useState } from "react";
import { ImageIcon } from "lucide-react";
import { Button, Field, HelpTip, Picker } from "@/components/admin";
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
  if (value.seoTitle && value.seoTitle.length > TITLE_MAX) issues.seoTitle = "Keep the title to 70 characters or fewer";
  if (value.seoDescription && value.seoDescription.length > DESCRIPTION_MAX) issues.seoDescription = "Keep the description to 160 characters or fewer";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.handle)) issues.handle = "Use only lowercase letters, numbers and hyphens, like about-us";
  if (value.canonicalOverride) {
    try {
      const url = new URL(value.canonicalOverride);
      if (url.protocol !== "https:" && url.protocol !== "http:") issues.canonicalOverride = "The address must start with https:// or http://";
    } catch {
      issues.canonicalOverride = "Enter a full web address, starting with https://";
    }
  }
  return issues;
}

const count = (text: string | null, max: number) => `${text?.length ?? 0} of ${max} characters`;

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
    <fieldset className="jk-stack-sm">
      <legend className="jk-subheading">Search engine listing</legend>
      <div className="jk-search-preview" aria-label="Search result preview">
        <p className="jk-cell-sub">How it may look in search results</p>
        <p className="jk-search-preview-title">{title}</p>
        <p className="jk-search-preview-address">{address}</p>
        <p className="jk-search-preview-text">{value.seoDescription || "Add a description to tell shoppers what this page is about."}</p>
      </div>
      <Field id="seo-title" label="Title in search results" help={count(value.seoTitle, TITLE_MAX)} error={issues.seoTitle}>
        <input id="seo-title" aria-label="SEO title" value={value.seoTitle ?? ""} placeholder={fallbackTitle} onChange={(event) => onChange({ ...value, seoTitle: event.target.value || null })} />
      </Field>
      <Field id="seo-description" label="Description in search results" help={count(value.seoDescription, DESCRIPTION_MAX)} error={issues.seoDescription}>
        <textarea id="seo-description" aria-label="SEO description" rows={3} value={value.seoDescription ?? ""} onChange={(event) => onChange({ ...value, seoDescription: event.target.value || null })} />
      </Field>
      <Field id="seo-handle" label={<>Web address ending <HelpTip>The last part of the page address. Changing it breaks links people already shared.</HelpTip></>} error={issues.handle}>
        <span className="jk-prefixed"><span className="jk-prefixed-text">{pathPrefix}</span>
          <input id="seo-handle" aria-label="Handle" value={value.handle} onChange={(event) => onChange({ ...value, handle: event.target.value })} /></span>
      </Field>
      <div className="jk-field">
        <span className="jk-strong">Social sharing image <HelpTip>Shown when someone shares this page on social media or in a chat.</HelpTip></span>
        <div className="jk-row">
          {value.socialMediaId ? image?.id === value.socialMediaId ? <img src={image.url} alt="Chosen social sharing image" className="jk-thumb jk-thumb-lg" /> : <span className="jk-thumb jk-thumb-lg"><ImageIcon size={18} aria-hidden="true" /></span> : null}
          {listImages && <Button onClick={() => setPicking(true)}>{value.socialMediaId ? "Change image" : "Choose image"}</Button>}
          {value.socialMediaId && <Button variant="quiet" onClick={() => { onChange({ ...value, socialMediaId: null }); setImage(null); }}>Remove</Button>}
          {value.socialMediaId && image?.id !== value.socialMediaId && <span className="jk-muted">An image is chosen.</span>}
        </div>
      </div>
      <details className="jk-disclosure">
        <summary>Advanced</summary>
        <div className="jk-stack-sm">
          <Field id="seo-canonical" label={<>Original page address (optional) <HelpTip>Only if the same content lives at another address and search engines should use that one.</HelpTip></>} error={issues.canonicalOverride}>
            <input id="seo-canonical" aria-label="Canonical override" placeholder="https://" value={value.canonicalOverride ?? ""} onChange={(event) => onChange({ ...value, canonicalOverride: event.target.value || null })} />
          </Field>
          <label className="jk-check">
            <input aria-label="Hide from search engines" type="checkbox" checked={value.noindex} onChange={(event) => onChange({ ...value, noindex: event.target.checked })} />
            <span>Hide from search engines<span className="jk-cell-sub">The page still works for anyone with the link.</span></span>
          </label>
        </div>
      </details>
      <Picker open={picking} onOpenChange={setPicking} title="Choose a social sharing image" searchLabel="Search images" multiple={false} doneLabel="Use image" load={loadImages}
        onDone={(items) => { const picked = items[0]; if (!picked) return; onChange({ ...value, socialMediaId: picked.id }); void listImages?.().then((media) => { const found = media.find((item) => item.id === picked.id); if (found) setImage({ id: found.id, url: found.url }); }); }} />
    </fieldset>
  );
}
