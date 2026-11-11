"use client";

import { useId, useState } from "react";
import { MAX_MENU_IMAGE_ALT, isSafeMenuImageUrl } from "@jelly/storefront-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  return <fieldset className="flex flex-col gap-2 rounded-md border border-border p-3">
    <legend className="px-1 text-sm font-medium">Photo (optional)</legend>
    <p className="text-[12px] text-muted-foreground">Shown as a picture tile when the header uses the Large menu. Best for rooms, bed types or collections.</p>
    {url && (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className="h-24 w-36 rounded object-cover" />
    )}
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={`${id}-photo`} className="cursor-pointer rounded-md border border-border px-3 py-2 text-sm">{url ? "Replace photo" : "Upload photo"}</Label>
      <input id={`${id}-photo`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" disabled={status === "uploading"} onChange={event => { void choose(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      {url && <Button type="button" variant="outline" size="sm" onClick={() => { onUrl(""); onAlt(""); }}>Remove photo</Button>}
      {status === "uploading" && <span role="status" className="text-[12px] text-muted-foreground">Uploading…</span>}
      {status === "error" && <span role="alert" className="text-[12px] text-destructive">The photo could not be uploaded. Try a JPEG, PNG or WebP photo.</span>}
    </div>
    {url && <div className="flex flex-col gap-2"><Label htmlFor={`${id}-alt`}>Photo description</Label><Input id={`${id}-alt`} value={alt} onChange={event => onAlt(event.target.value)} maxLength={MAX_MENU_IMAGE_ALT} placeholder="For example: Grey velvet ottoman bed in a bright bedroom" /></div>}
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
  return <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4" role="group" aria-label={item ? "Edit menu link" : heading ?? "New menu link"}>
    {heading && <p className="text-sm font-semibold">{heading}</p>}
    <div className="flex flex-col gap-2"><Label htmlFor={`${id}-label`}>Link label</Label><Input id={`${id}-label`} value={label} onChange={event => setLabel(event.target.value)} maxLength={120} /></div>
    <div className="flex flex-col gap-2"><Label htmlFor={`${id}-type`}>Destination type</Label><select className="admin-button" id={`${id}-type`} value={kind} onChange={event => { setKind(event.target.value as MenuTarget["kind"]); setDestination(""); setError(""); }}>
      {(["home", "search", "collection", "product", "page", "blog", "article", "external", "anchor"] as const).map(value => <option key={value} value={value}>{value === "external" ? "URL" : value[0].toUpperCase() + value.slice(1)}</option>)}
    </select></div>
    {kind === "collection" ? <>
      <div className="flex flex-col gap-2"><Label htmlFor={`${id}-search`}>Search collections</Label><Input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="flex flex-col gap-2"><Label htmlFor={`${id}-collection`}>Collection</Label><select id={`${id}-collection`} className="admin-button" value={destination} onChange={event => setDestination(event.target.value)}><option value="">Choose a collection</option>{collections.filter(collection => collection.id === destination || `${collection.title} ${collection.handle}`.toLowerCase().includes(query.toLowerCase())).map(collection => <option key={collection.id} value={collection.id}>{collection.title} · {collection.handle}</option>)}</select></div>
    </> : kind !== "home" && kind !== "search" ? <div className="flex flex-col gap-2"><Label htmlFor={`${id}-destination`}>{kind === "external" ? "URL" : kind === "anchor" ? "Anchor" : "Resource ID"}</Label><Input id={`${id}-destination`} value={destination} onChange={event => setDestination(event.target.value)} /></div> : null}
    {uploadImage && <MenuPhotoField id={id} url={photo} alt={photoAlt} onUrl={setPhoto} onAlt={setPhotoAlt} upload={uploadImage} />}
    {!uploadImage && photo && <p className="text-[12px] text-muted-foreground">This link has a photo for the large menu.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="button" onClick={apply}>Apply link</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
  </div>;
}
