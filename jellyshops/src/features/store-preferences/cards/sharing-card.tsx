"use client";

import { useCallback, useRef, useState } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { Button, Card, Field, HelpTip, Picker, useToast, type PickerItem } from "@/components/admin";
import type { PreferenceImage } from "@jelly/storefront-schema";
import { storeUrl } from "@jelly/storefront-schema";
import { useContentApi } from "@/features/content-admin/shared";
import { valueAt } from "../fields";
import type { PreferencesForm } from "../use-preferences-form";

type Kind = "social" | "favicon";
const RULES: Record<Kind, { path: string; types: string[]; typeText: string; maxBytes: number }> = {
  social: { path: "seo.socialImage", types: ["image/png", "image/jpeg", "image/webp"], typeText: "PNG, JPEG or WebP", maxBytes: 5 * 1024 * 1024 },
  favicon: { path: "seo.favicon", types: ["image/png", "image/webp", "image/gif"], typeText: "PNG, WebP or GIF", maxBytes: 1024 * 1024 },
};

/** Checks a file before it is uploaded; the server checks again and also applies the plan's limits. */
export function imageFileProblem(kind: Kind, file: { type: string; size: number }): string | null {
  const rules = RULES[kind];
  if (!rules.types.includes(file.type)) return `Use a ${rules.typeText} file.`;
  if (file.size > rules.maxBytes) return `The file is too large. Keep it under ${rules.maxBytes / 1024 / 1024} MB.`;
  return null;
}

/** Tips about a chosen photo's shape and size (advice only; the server refuses only clear mistakes). */
export function imageAdvice(kind: Kind, image: Pick<PreferenceImage, "width" | "height"> | null): string | null {
  if (!image?.width || !image.height) return null;
  if (kind === "favicon") {
    if (Math.abs(image.width - image.height) > Math.max(image.width, image.height) * 0.1) return "This image isn't square, so it will look squashed in the browser tab.";
    if (image.width < 96) return "Small icons can look blurry on high-resolution screens. 192 × 192 pixels or more works best.";
    return null;
  }
  const ratio = image.width / image.height;
  if (image.width < 1200) return `This image is ${image.width} pixels wide. 1200 × 630 pixels looks sharp everywhere.`;
  if (ratio < 1.6 || ratio > 2.2) return "Most sites crop sharing images to a wide shape (about 1.9 to 1). Keep the important part in the middle.";
  return null;
}

export function ImageSetting({ form, kind, label, tip, help }: { form: PreferencesForm; kind: Kind; label: string; tip?: string; help: string }) {
  const { media, listImages } = useContentApi();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const path = RULES[kind].path;
  const image = valueAt<PreferenceImage | null>(form, path);
  const id = `pref-${kind}-image`;
  const advice = imageAdvice(kind, image);

  const loadImages = useCallback(async (query: string): Promise<PickerItem[]> => {
    if (!listImages) throw new Error("Sign in to choose a photo.");
    const items = await listImages();
    return items.filter((item) => RULES[kind].types.includes(item.mimeType) && (item.originalName ?? "").toLowerCase().includes(query.toLowerCase()))
      .map((item) => ({ id: item.id, label: item.originalName || "Photo", detail: item.width && item.height ? `${item.width} × ${item.height}` : undefined, media: <img src={item.url} alt="" className="jk-thumb" /> }));
  }, [kind, listImages]);

  async function choose(items: PickerItem[]) {
    const item = items[0];
    if (!item || !listImages) return;
    const record = (await listImages()).find((entry) => entry.id === item.id);
    if (record) form.set(path, { mediaId: record.id, url: record.url, width: record.width ?? null, height: record.height ?? null, alt: image?.alt ?? "" });
  }

  async function upload(file: File) {
    const problem = imageFileProblem(kind, file);
    if (problem) { toast(problem, { tone: "critical" }); return; }
    if (!media?.upload) { toast("Sign in to upload a photo.", { tone: "critical" }); return; }
    setUploading(true);
    try {
      const saved = await media.upload(file);
      form.set(path, { mediaId: saved.id, url: saved.url, width: saved.width ?? null, height: saved.height ?? null, alt: image?.alt ?? "" });
      toast("Photo uploaded. Save to use it.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not upload the photo.", { tone: "critical" });
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return <div className="jk-field" data-pref-path={path}>
    <span className="jk-strong" id={`${id}-label`}>{label}{tip && <> <HelpTip label={`About the ${label.toLowerCase()}`}>{tip}</HelpTip></>}</span>
    <small className="jk-muted">{help}</small>
    <div className="jk-row">
      {image ? <img src={image.url} alt={image.alt || `Chosen ${label.toLowerCase()}`} className={`jk-thumb jk-thumb-lg ${kind === "favicon" ? "jk-pref-icon" : ""}`} /> : <span className="jk-thumb jk-thumb-lg"><ImageIcon size={18} aria-hidden="true" /></span>}
      <Button onClick={() => input.current?.click()} loading={uploading} loadingLabel="Uploading…"><Upload size={14} aria-hidden="true" /> Upload</Button>
      {listImages && <Button variant="quiet" onClick={() => setPicking(true)}>Choose from files</Button>}
      {image && <Button variant="destructive-quiet" onClick={() => form.set(path, null)}>Remove</Button>}
      <input ref={input} type="file" hidden accept={RULES[kind].types.join(",")} aria-labelledby={`${id}-label`} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
    </div>
    {advice && <small className="jk-muted" role="status">{advice}</small>}
    {form.problem(path) && <small className="jk-field-error" role="alert">{form.problem(path)}</small>}
    {kind === "social" && image && <Field id={`${id}-alt`} label="Image description" help="For screen readers.">
      <input id={`${id}-alt`} maxLength={200} value={image.alt} onChange={(event) => form.set(path, { ...image, alt: event.target.value })} />
    </Field>}
    <Picker open={picking} onOpenChange={setPicking} title={`Choose a ${label.toLowerCase()}`} searchLabel="Search your files" load={loadImages} multiple={false} onDone={(items) => void choose(items)} doneLabel="Use this photo" />
  </div>;
}

/** How a shared link may look in a chat or social post. */
export function SharePreview({ image, title, description, address }: { image: PreferenceImage | null; title: string; description: string; address: string }) {
  return <div className="jk-pref-share" role="group" aria-label="Sharing preview">
    <div className="jk-pref-share-image">{image ? <img src={image.url} alt="" /> : <span className="jk-muted">No sharing image yet: sites may pick a random photo from your store.</span>}</div>
    <div className="jk-pref-share-text">
      <span className="jk-cell-sub">{address.replace(/^https?:\/\//, "").split("/")[0]}</span>
      <span className="jk-strong">{title}</span>
      <span className="jk-muted">{description}</span>
    </div>
  </div>;
}

/** How the browser tab looks with the icon. */
export function TabPreview({ image, title }: { image: PreferenceImage | null; title: string }) {
  return <div className="jk-pref-tab" role="group" aria-label="Browser tab preview">
    {image ? <img src={image.url} alt="" width={16} height={16} /> : <span className="jk-pref-tab-blank" aria-hidden="true" />}
    <span>{title}</span>
  </div>;
}

export function SharingCard({ form, storeName, storeSlug }: { form: PreferencesForm; storeName: string; storeSlug: string }) {
  const title = valueAt<string>(form, "seo.homeTitle") || storeName || "Your store";
  const description = valueAt<string>(form, "seo.homeDescription") || "Your homepage description appears here.";
  return <Card title="Social sharing and browser icon" description="The picture people see when your store is shared, and the small icon in the browser tab.">
    <div className="jk-stack-sm" id="sharing">
      <SharePreview image={valueAt(form, "seo.socialImage")} title={title} description={description} address={storeSlug ? storeUrl(storeSlug) : ""} />
      <ImageSetting form={form} kind="social" label="Sharing image"
        tip="Shown when your homepage is shared on Facebook, X, WhatsApp, iMessage and similar. Pages with their own photo (products, posts) use that instead."
        help="A wide picture, 1200 × 630 pixels, PNG, JPEG or WebP up to 5 MB. Keep words away from the edges." />
      <TabPreview image={valueAt(form, "seo.favicon")} title={title} />
      <ImageSetting form={form} kind="favicon" label="Browser tab icon (favicon)"
        tip="The tiny picture next to your store's name in browser tabs, bookmarks and phone home screens."
        help="A square PNG, WebP or GIF, at least 32 × 32 pixels (192 × 192 or more looks best), up to 1 MB. Simple shapes work best." />
    </div>
  </Card>;
}
