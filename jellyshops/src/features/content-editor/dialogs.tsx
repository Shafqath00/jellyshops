"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { Button, Field, buttonClass } from "@/components/admin";
import { parseVideoUrl, safeRichTextHref, safeRichTextImageSrc, type RichTextVideoAttrs } from "@jelly/storefront-schema";

/** A photo the editor can insert: from the store's Files, a new upload, or a web address. */
export interface EditorMediaItem { id: string; url: string; alt?: string; name?: string; width?: number; height?: number }

export interface EditorMediaSource {
  list?: () => Promise<EditorMediaItem[]>;
  upload?: (file: File) => Promise<EditorMediaItem>;
}

/** The dialog frame. Its content mounts when it opens, so each form starts fresh without resetting state by hand. */
function DialogShell({ open, onOpenChange, busy, onClosed, children }: { open: boolean; onOpenChange: (open: boolean) => void; busy?: boolean; onClosed?: () => void; children: ReactNode }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="jk-overlay" />
        <DialogPrimitive.Content className="jk-dialog jce-dialog" aria-describedby={undefined}
          // The editor takes focus back itself (after inserting); returning it to the toolbar button would lose the cursor.
          onCloseAutoFocus={(event) => { event.preventDefault(); onClosed?.(); }}>{children}</DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function DialogForm({ title, description, submitLabel, onSubmit, busy, error, children, extraAction }: {
  title: string; description?: string; submitLabel: string; onSubmit: () => void; busy?: boolean; error?: string; children: ReactNode; extraAction?: ReactNode;
}) {
  return (
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(); }}>
      <DialogPrimitive.Title className="jk-dialog-title">{title}</DialogPrimitive.Title>
      <div className="jk-dialog-body jce-dialog-body">
        {description ? <p className="jk-muted">{description}</p> : null}
        {children}
        {error ? <p className="jk-field-error" role="alert">{error}</p> : null}
      </div>
      <div className="jk-dialog-footer">
        {extraAction ? <span className="jce-dialog-extra">{extraAction}</span> : null}
        <DialogPrimitive.Close asChild><button type="button" className="jk-button" disabled={busy}>Cancel</button></DialogPrimitive.Close>
        <Button type="submit" variant="primary" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------------------- link

export interface LinkValue { href: string; newTab: boolean }

function LinkForm({ close, initial, onApply, onRemove }: {
  close: () => void; initial: LinkValue | null;
  onApply: (value: LinkValue) => void; onRemove?: () => void;
}) {
  const id = useId();
  const [href, setHref] = useState(initial?.href ?? "");
  const [newTab, setNewTab] = useState(initial?.newTab ?? false);
  const [error, setError] = useState("");
  function submit() {
    const value = normaliseHref(href);
    if (!value) { setError("Enter a web address (https://…), a store path (/pages/about), an email (mailto:) or a phone number (tel:)."); return; }
    onApply({ href: value, newTab });
    close();
  }
  return (
    <DialogForm title={initial ? "Edit link" : "Add link"} submitLabel={initial ? "Save link" : "Add link"} onSubmit={submit} error={error}
      extraAction={initial && onRemove ? <button type="button" className={buttonClass("destructive-quiet")} onClick={() => { onRemove(); close(); }}>Remove link</button> : undefined}>
      <Field id={`${id}-href`} label="Link to" help="A page in your store like /pages/about, or a full web address.">
        <input id={`${id}-href`} value={href} onChange={(event) => setHref(event.target.value)} placeholder="https://example.com or /collections/beds" autoFocus autoComplete="off" />
      </Field>
      <label className="jk-check"><input type="checkbox" checked={newTab} onChange={(event) => setNewTab(event.target.checked)} /><span>Open in a new tab</span></label>
    </DialogForm>
  );
}

/** "example.com" becomes "https://example.com"; anything unsafe is refused. */
export function normaliseHref(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(text) || text.startsWith("/") || text.startsWith("#") ? text : `https://${text}`;
  return safeRichTextHref(withProtocol);
}

// ----------------------------------------------------------------------------- photo

export interface ImageValue { src: string; alt: string; caption?: string }

function ImageForm({ close, media, onInsert }: {
  close: () => void; media?: EditorMediaSource; onInsert: (value: ImageValue) => void;
}) {
  const id = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<EditorMediaItem[] | null>(media?.list ? null : []);
  const [loadError, setLoadError] = useState("");
  const [chosen, setChosen] = useState<EditorMediaItem | null>(null);
  const [address, setAddress] = useState("");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!media?.list) return;
    let active = true;
    media.list().then((list) => { if (active) setItems(list); }).catch(() => { if (active) { setItems([]); setLoadError("Your files could not be loaded. You can still upload a photo or use a web address."); } });
    return () => { active = false; };
  }, [media]);

  const shownItems = (items ?? []).filter((item) => safeRichTextImageSrc(item.url)).slice(0, 60);

  async function upload(file: File) {
    if (!media?.upload) return;
    if (!file.type.startsWith("image/")) { setError("Choose a photo (JPG, PNG, WebP or GIF)."); return; }
    setBusy(true); setError("");
    try {
      const item = await media.upload(file);
      setItems((current) => [item, ...(current ?? [])]);
      setChosen(item); setAddress("");
      if (!alt) setAlt(file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " "));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The photo could not be uploaded. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function submit() {
    const src = chosen?.url ?? safeRichTextImageSrc(address.trim());
    if (!src) { setError(address ? "That web address can't be used for a photo. Use an https:// address." : "Choose a photo, upload one, or paste a web address."); return; }
    if (!alt.trim()) { setError("Describe the photo for people who can't see it (alt text). It also helps search engines."); return; }
    onInsert({ src, alt: alt.trim(), ...(caption.trim() ? { caption: caption.trim() } : {}) });
    close();
  }

  return (
    <DialogForm title="Add photo" submitLabel="Add photo" onSubmit={submit} busy={busy} error={error}>
      {media?.upload ? (
        <div className="jce-upload">
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} />
          <button type="button" className="jk-button" onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="jce-spin" size={16} aria-hidden /> : <Upload size={16} aria-hidden />} Upload a photo
          </button>
          <span className="jk-muted">or choose from your files below</span>
        </div>
      ) : null}
      {media?.list ? (
        shownItems.length > 0 ? (
          <div className="jce-media-grid" role="listbox" aria-label="Your photos">
            {shownItems.map((item) => (
              <button key={item.id} type="button" role="option" aria-selected={chosen?.id === item.id} className="jce-media-item"
                onClick={() => { setChosen(item); setAddress(""); if (!alt && item.alt) setAlt(item.alt); }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- store photos, small previews */}
                <img src={item.url} alt={item.alt || item.name || ""} loading="lazy" />
              </button>
            ))}
          </div>
        ) : (
          // Only a list of options when there are options; a message is just text.
          <div className="jce-media-grid" role="status">
            {items === null ? <p className="jk-muted">Loading your photos…</p> : loadError ? <p className="jk-muted">{loadError}</p> : <p className="jk-muted">No photos yet. Upload one to use it here.</p>}
          </div>
        )
      ) : null}
      <Field id={`${id}-address`} label="Or use a web address">
        <input id={`${id}-address`} value={address} onChange={(event) => { setAddress(event.target.value); setChosen(null); }} placeholder="https://…" autoComplete="off" />
      </Field>
      {chosen || safeRichTextImageSrc(address.trim()) ? (
        <div className="jce-image-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- preview of the chosen photo */}
          <img src={chosen?.url ?? address.trim()} alt="" />
        </div>
      ) : <div className="jce-image-preview jce-image-preview--empty"><ImageIcon size={20} aria-hidden /> No photo chosen yet</div>}
      <Field id={`${id}-alt`} label="Alt text" required help="What the photo shows, in a few words. Read aloud by screen readers.">
        <input id={`${id}-alt`} value={alt} onChange={(event) => setAlt(event.target.value)} maxLength={300} />
      </Field>
      <Field id={`${id}-caption`} label="Caption" help="Optional. Shown under the photo.">
        <input id={`${id}-caption`} value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} />
      </Field>
    </DialogForm>
  );
}

// ----------------------------------------------------------------------------- video

function VideoForm({ close, onInsert }: { close: () => void; onInsert: (value: RichTextVideoAttrs) => void }) {
  const id = useId();
  const [address, setAddress] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  function submit() {
    const video = parseVideoUrl(address);
    if (!video) { setError("Paste a YouTube or Vimeo link, for example https://www.youtube.com/watch?v=…"); return; }
    onInsert({ ...video, ...(title.trim() ? { title: title.trim() } : {}) });
    close();
  }
  return (
    <DialogForm title="Add video" description="YouTube and Vimeo videos play on your page. Shoppers' privacy is protected: YouTube only sets cookies once they press play." submitLabel="Add video" onSubmit={submit} error={error}>
      <Field id={`${id}-address`} label="YouTube or Vimeo link" required>
        <input id={`${id}-address`} value={address} onChange={(event) => setAddress(event.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus autoComplete="off" />
      </Field>
      <Field id={`${id}-title`} label="Title" help="Optional. Read aloud by screen readers.">
        <input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} />
      </Field>
    </DialogForm>
  );
}

// ----------------------------------------------------------------------------- button

export interface ButtonValue { label: string; href: string; style: "primary" | "secondary"; newTab: boolean }

function ButtonForm({ close, initial, onApply }: {
  close: () => void; initial: ButtonValue | null; onApply: (value: ButtonValue) => void;
}) {
  const id = useId();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [href, setHref] = useState(initial?.href ?? "");
  const [style, setStyle] = useState<"primary" | "secondary">(initial?.style ?? "primary");
  const [newTab, setNewTab] = useState(initial?.newTab ?? false);
  const [error, setError] = useState("");
  function submit() {
    if (!label.trim()) { setError("Give the button a label, for example Shop beds."); return; }
    const value = normaliseHref(href);
    if (!value) { setError("Enter where the button goes: a store path like /collections/beds or a full web address."); return; }
    onApply({ label: label.trim().slice(0, 80), href: value, style, newTab });
    close();
  }
  return (
    <DialogForm title={initial ? "Edit button" : "Add button"} submitLabel={initial ? "Save button" : "Add button"} onSubmit={submit} error={error}>
      <Field id={`${id}-label`} label="Label" required><input id={`${id}-label`} value={label} onChange={(event) => setLabel(event.target.value)} maxLength={80} autoFocus /></Field>
      <Field id={`${id}-href`} label="Link to" required><input id={`${id}-href`} value={href} onChange={(event) => setHref(event.target.value)} placeholder="/collections/beds" autoComplete="off" /></Field>
      <fieldset className="jce-choice">
        <legend>Style</legend>
        <label className="jk-check"><input type="radio" name={`${id}-style`} checked={style === "primary"} onChange={() => setStyle("primary")} /><span>Main (filled)</span></label>
        <label className="jk-check"><input type="radio" name={`${id}-style`} checked={style === "secondary"} onChange={() => setStyle("secondary")} /><span>Secondary (outlined)</span></label>
      </fieldset>
      <label className="jk-check"><input type="checkbox" checked={newTab} onChange={(event) => setNewTab(event.target.checked)} /><span>Open in a new tab</span></label>
    </DialogForm>
  );
}

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void; /** Called once the dialog has closed (e.g. to put focus back in the editor). */ onClosed?: () => void };

export function LinkDialog({ open, onOpenChange, onClosed, ...rest }: DialogProps & Omit<Parameters<typeof LinkForm>[0], "close">) {
  return <DialogShell open={open} onOpenChange={onOpenChange} onClosed={onClosed}><LinkForm close={() => onOpenChange(false)} {...rest} /></DialogShell>;
}

export function ImageDialog({ open, onOpenChange, onClosed, ...rest }: DialogProps & Omit<Parameters<typeof ImageForm>[0], "close">) {
  return <DialogShell open={open} onOpenChange={onOpenChange} onClosed={onClosed}><ImageForm close={() => onOpenChange(false)} {...rest} /></DialogShell>;
}

export function VideoDialog({ open, onOpenChange, onClosed, ...rest }: DialogProps & Omit<Parameters<typeof VideoForm>[0], "close">) {
  return <DialogShell open={open} onOpenChange={onOpenChange} onClosed={onClosed}><VideoForm close={() => onOpenChange(false)} {...rest} /></DialogShell>;
}

export function ButtonDialog({ open, onOpenChange, onClosed, ...rest }: DialogProps & Omit<Parameters<typeof ButtonForm>[0], "close">) {
  return <DialogShell open={open} onOpenChange={onOpenChange} onClosed={onClosed}><ButtonForm close={() => onOpenChange(false)} {...rest} /></DialogShell>;
}
