"use client";

import { useId, useState } from "react";
import { MAX_MENU_IMAGE_ALT, isSafeMenuImageUrl } from "@jelly/storefront-schema";
import type { MenuItem, MenuTarget } from "../api/client";

export interface CollectionChoice { id: string; title: string; handle: string }

/** Photo for the large menu: upload, a short description for screen readers, remove. */
function MenuPhotoField({ id, url, alt, onUrl, onAlt, upload }: { id: string; url: string; alt: string; onUrl(url: string): void; onAlt(alt: string): void; upload(file: File): Promise<string> }) {
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  async function choose(file: File | undefined) {
    if (!file) return;
    setStatus("uploading");
    try { onUrl(await upload(file)); setStatus("idle"); }
    catch { setStatus("error"); }
  }
  return <fieldset className="jk-stack-sm">
    <legend className="jk-strong">Photo (optional)</legend>
    <p className="jk-muted">Shown as a picture tile when the header uses the Large menu. Best for rooms, bed types or collections.</p>
    {url && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-24 w-36 rounded object-cover" />
    )}
    <div className="jk-row">
      <label htmlFor={`${id}-photo`} className="jk-button cursor-pointer">{url ? "Replace photo" : "Upload photo"}</label>
      <input id={`${id}-photo`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={status === "uploading"} onChange={event => { void choose(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      {url && <button type="button" className="jk-button jk-button-plain" onClick={() => { onUrl(""); onAlt(""); }}>Remove photo</button>}
      {status === "uploading" && <span role="status" className="jk-muted">Uploading…</span>}
      {status === "error" && <span role="alert" className="jk-field-error">The photo could not be uploaded. Try a JPEG, PNG or WebP photo.</span>}
    </div>
    {url && <div className="jk-field"><label htmlFor={`${id}-alt`}>Photo description</label><input id={`${id}-alt`} value={alt} onChange={event => onAlt(event.target.value)} maxLength={MAX_MENU_IMAGE_ALT} placeholder="For example: Grey velvet ottoman bed in a bright bedroom" /></div>}
  </fieldset>;
}

export function MenuLinkForm({ item, heading, collections, uploadImage, onApply, onCancel }: {
  item?: MenuItem; heading?: string; collections: CollectionChoice[]; uploadImage?(file: File): Promise<string>; onApply(item: MenuItem): void; onCancel(): void;
}) {
  const id = useId();
  const [label, setLabel] = useState(item?.label ?? "");
  const [kind, setKind] = useState<MenuTarget["kind"]>(item?.target.kind ?? "home");
  const [destination, setDestination] = useState(item && "resourceId" in item.target ? item.target.resourceId : item && "url" in item.target ? item.target.url : item && "anchor" in item.target ? item.target.anchor : "");
  const [photo, setPhoto] = useState(item?.image?.url ?? "");
  const [photoAlt, setPhotoAlt] = useState(item?.image?.alt ?? "");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  function apply() {
    const value = destination.trim();
    if (!label.trim()) { setError("Enter a link label."); return; }
    if (kind !== "home" && kind !== "search" && !value) { setError("Choose a destination."); return; }
    if (kind === "collection" && !collections.some(collection => collection.id === value)) { setError("Choose an available collection."); return; }
    if (kind === "external") {
      // A path in the store ("/pages/faq", "/search?q=Beds") or a full http(s) address.
      const storePath = value.startsWith("/") && !value.startsWith("//") && !/\s/.test(value);
      try { if (!storePath && !["http:", "https:"].includes(new URL(value).protocol)) throw new Error(); }
      catch { setError("Enter a full web address (https://…) or a page in your store starting with /."); return; }
    }
    if (kind === "anchor" && !/^[A-Za-z][A-Za-z0-9_:\-.]*$/.test(value.replace(/^#/, ""))) { setError("Enter an anchor name starting with a letter."); return; }
    if (photo && !isSafeMenuImageUrl(photo, { allowLocalHttp: true })) { setError("This photo cannot be used. Upload it again."); return; }
    const target: MenuTarget = kind === "home" || kind === "search" ? { kind }
      : kind === "external" ? { kind, url: value }
      : kind === "anchor" ? { kind, anchor: `#${value.replace(/^#/, "")}` }
      : { kind, resourceId: value };
    const alt = photoAlt.trim();
    const image = photo ? (alt ? { url: photo, alt } : { url: photo }) : undefined;
    onApply({ id: item?.id ?? crypto.randomUUID(), label: label.trim(), target, ...(image ? { image } : {}), children: item?.children ?? [] });
  }
  return <div className="jk-stack-sm" role="group" aria-label={item ? "Edit menu link" : heading ?? "New menu link"}>
    {heading && <p className="jk-strong">{heading}</p>}
    <div className="jk-field"><label htmlFor={`${id}-label`}>Link label</label><input id={`${id}-label`} value={label} onChange={event => setLabel(event.target.value)} maxLength={120} /></div>
    <div className="jk-field"><label htmlFor={`${id}-type`}>Destination type</label><select id={`${id}-type`} value={kind} onChange={event => { setKind(event.target.value as MenuTarget["kind"]); setDestination(""); setError(""); }}>
      {(["home", "search", "collection", "product", "page", "blog", "article", "external", "anchor"] as const).map(value => <option key={value} value={value}>{value === "external" ? "URL" : value[0].toUpperCase() + value.slice(1)}</option>)}
    </select></div>
    {kind === "collection" ? <>
      <div className="jk-field"><label htmlFor={`${id}-search`}>Search collections</label><input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="jk-field"><label htmlFor={`${id}-collection`}>Collection</label><select id={`${id}-collection`} value={destination} onChange={event => setDestination(event.target.value)}><option value="">Choose a collection</option>{collections.filter(collection => collection.id === destination || `${collection.title} ${collection.handle}`.toLowerCase().includes(query.toLowerCase())).map(collection => <option key={collection.id} value={collection.id}>{collection.title} · {collection.handle}</option>)}</select></div>
    </> : kind !== "home" && kind !== "search" ? <div className="jk-field"><label htmlFor={`${id}-destination`}>{kind === "external" ? "URL" : kind === "anchor" ? "Anchor" : "Resource ID"}</label><input id={`${id}-destination`} value={destination} onChange={event => setDestination(event.target.value)} /></div> : null}
    {uploadImage && <MenuPhotoField id={id} url={photo} alt={photoAlt} onUrl={setPhoto} onAlt={setPhotoAlt} upload={uploadImage} />}
    {!uploadImage && photo && <p className="jk-muted">This link has a photo for the large menu.</p>}
    {error && <p role="alert" className="jk-field-error">{error}</p>}
    <div className="jk-row"><button type="button" className="jk-button jk-button-primary" onClick={apply}>Apply link</button><button type="button" className="jk-button" onClick={onCancel}>Cancel</button></div>
  </div>;
}
