"use client";

import { AnimatedDetails } from "../animated-details";
import { useSyncExternalStore } from "react";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import { slugify } from "@/lib/domain";
import { DESCRIPTION_LIMIT, DESCRIPTION_RECOMMENDED_MAX, TITLE_LIMIT, TITLE_RECOMMENDED_MAX, descriptionAdvice, productMetaDescription, productMetaTitle, titleAdvice } from "@/lib/seo";
import { effectiveHandle, type DraftErrors, type ProductDraft } from "../draft";
import { Field, Section } from "./section-parts";

type Props = {
  draft: ProductDraft;
  errors: DraftErrors;
  storeName: string;
  storeSlug: string;
  /** True once the product is live: its handle is part of web addresses people may already have. */
  saved: boolean;
  onChange: <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => void;
};

const noop = () => () => undefined;
/** The address this editor is served from, so the preview looks like the real result. Empty while rendering on the server. */
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");

function Counter({ id, length, recommended, limit }: { id: string; length: number; recommended: number; limit: number }) {
  return <span id={id} className={`text-[12px] tabular-nums ${length > recommended ? "font-semibold text-tint-foreground" : "text-muted-foreground"}`}>{length} of {recommended} recommended ({limit} maximum)</span>;
}

/** How the product will look in search results, with the fields that control it. */
export function SeoSection({ draft, errors, storeName, storeSlug, saved, onChange }: Props) {
  const origin = useOrigin();
  const handle = effectiveHandle(draft);
  const name = draft.title.trim() || "Product name";
  const title = productMetaTitle({ name, seoTitle: draft.seoTitle }, storeName);
  const description = productMetaDescription({ description: draft.description || "Your product description appears here.", seoDescription: draft.seoDescription });
  const titleHint = titleAdvice(draft.seoTitle);
  const descriptionHint = descriptionAdvice(draft.seoDescription);
  const path = `/${storeSlug || "your-store"}/products/${handle || "product-handle"}`;
  const handleChanged = saved && draft.handleManual && draft.handle.trim() !== draft.initialHandle;
  const hasContent = Boolean(draft.seoTitle || draft.seoDescription || (draft.handleManual && draft.handle !== slugify(draft.title)));

  return (
    <Section title="Search engine listing" hint="Add a title and description to control how this product appears in search results and when it is shared.">
      <div role="img" aria-label="Preview of the search result" className="rounded-xl border border-border bg-card p-4">
        <p className="truncate text-[12px] text-muted-foreground">{origin || "https://yourstore.com"}{path}</p>
        <p className="mt-1 truncate text-[18px] leading-6 text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
        <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-muted-foreground">{description}</p>
      </div>

      <AnimatedDetails open={hasContent || Boolean(errors.handle)} className="rounded-xl border border-border/80 bg-muted/25 px-4 py-3.5">
        <summary className="cursor-pointer text-[13px] font-semibold text-foreground">Edit search engine listing</summary>
        <div className="space-y-4 pt-4">
          <div>
            <label htmlFor="pb-seo-title" className="text-[13px] font-semibold text-foreground">Page title</label>
            <input id="pb-seo-title" className={inputClass} value={draft.seoTitle} maxLength={TITLE_LIMIT} aria-describedby="pb-seo-title-count" placeholder={`${name} · ${storeName || "Your store"}`} onChange={(event) => onChange("seoTitle", event.target.value)} />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <Counter id="pb-seo-title-count" length={draft.seoTitle.trim().length} recommended={TITLE_RECOMMENDED_MAX} limit={TITLE_LIMIT} />
              {titleHint && <span role="status" className={`text-[12px] ${titleHint.level === "warning" ? "font-semibold text-tint-foreground" : "text-muted-foreground"}`}>{titleHint.message}</span>}
            </div>
          </div>

          <div>
            <label htmlFor="pb-seo-description" className="text-[13px] font-semibold text-foreground">Meta description</label>
            <textarea id="pb-seo-description" rows={3} className={`${inputClass} h-auto py-2`} value={draft.seoDescription} maxLength={DESCRIPTION_LIMIT} aria-describedby="pb-seo-description-count" placeholder="Left empty, the start of your product description is used." onChange={(event) => onChange("seoDescription", event.target.value)} />
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <Counter id="pb-seo-description-count" length={draft.seoDescription.trim().length} recommended={DESCRIPTION_RECOMMENDED_MAX} limit={DESCRIPTION_LIMIT} />
              {descriptionHint && <span role="status" className={`text-[12px] ${descriptionHint.level === "warning" ? "font-semibold text-tint-foreground" : "text-muted-foreground"}`}>{descriptionHint.message}</span>}
            </div>
          </div>

          <Field id="pb-handle" label="URL handle" error={errors.handle} hint={`The web address of this product: ${path}`}>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[13px] text-muted-foreground">/products/</span>
              <input id="pb-handle" className={inputClass} value={handle} aria-invalid={Boolean(errors.handle)} aria-describedby={errors.handle ? "pb-handle-error" : undefined}
                onChange={(event) => { onChange("handleManual", true); onChange("handle", event.target.value.toLowerCase().replace(/\s+/g, "-")); }} />
            </div>
          </Field>
          {handleChanged && <p role="note" className="text-[12px] leading-5 text-tint-foreground">Changing the handle of a product that is already in your store means old links to it, including ones in search results, will stop working.</p>}
        </div>
      </AnimatedDetails>
    </Section>
  );
}
