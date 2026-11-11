"use client";

import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { inputClass } from "@/features/commerce/components/product-form-styles";
import type { DraftErrors, ProductDraft } from "../draft";
import { DescriptionEditor } from "./description-editor";
import { Field, Section } from "./section-parts";

type Props = {
  draft: ProductDraft;
  errors: DraftErrors;
  onChange: <K extends keyof ProductDraft>(field: K, value: ProductDraft[K]) => void;
  /** Uploads a file and resolves to its public URL; absent when not signed in. */
  hidePhoto?: boolean;
  onUpload?: (file: File) => Promise<string>;
};

export function BasicsSection({ draft, errors, onChange, onUpload, hidePhoto }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function pick(file: File | undefined) {
    if (!file || !onUpload) return;
    setUploading(true);
    setUploadError("");
    try { onChange("imageUrl", await onUpload(file)); }
    catch (caught) { setUploadError(caught instanceof Error ? caught.message : "Upload failed. Try a smaller image."); }
    finally { setUploading(false); }
  }

  return (
    <Section title="Product details" hint="Start with a clear name and a description that helps customers understand your product.">
      <Field id="pb-title" label="Product name" required error={errors.title}>
        <input id="pb-title" aria-required="true" className={inputClass} value={draft.title} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? "pb-title-error" : undefined} placeholder="e.g. Classic cotton T-shirt" onChange={(event) => onChange("title", event.target.value)} />
      </Field>
      <Field id="pb-description" label="Description" required={false}>
        <DescriptionEditor id="pb-description" value={draft.descriptionDoc ?? null} fallbackText={draft.description} onChange={(document, plainText) => { onChange("descriptionDoc", document); onChange("description", plainText); }} />
      </Field>
      {!hidePhoto && <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Photo</p>
        <div className="mt-2 flex items-center gap-4">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/50 text-[12px] font-bold text-muted-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {draft.imageUrl ? <img src={draft.imageUrl} alt="Product cover" className="size-full object-cover" /> : "No photo"}
          </div>
          <div className="space-y-2">
            {onUpload && (
              <>
                <input ref={fileInput} type="file" accept="image/*" className="sr-only" aria-label="Upload product photo" onChange={(event) => { void pick(event.target.files?.[0]); event.target.value = ""; }} />
                <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3.5 text-[13px] font-semibold text-tint-foreground transition hover:bg-muted disabled:opacity-60">
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {draft.imageUrl ? "Replace photo" : "Upload photo"}
                </button>
              </>
            )}
            {draft.imageUrl && <button type="button" onClick={() => onChange("imageUrl", "")} className="block text-[13px] font-bold text-muted-foreground underline">Remove</button>}
            {uploadError && <p role="alert" className="text-[13px] font-bold text-tint-foreground">{uploadError}</p>}
          </div>
        </div>
      </div>}
    </Section>
  );
}
