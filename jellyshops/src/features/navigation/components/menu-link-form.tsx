"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MenuItem, MenuTarget } from "../api/client";

export interface CollectionChoice { id: string; title: string; handle: string }
export function MenuLinkForm({ item, collections, onApply, onCancel }: {
  item?: MenuItem; collections: CollectionChoice[]; onApply(item: MenuItem): void; onCancel(): void;
}) {
  const id = useId();
  const [label, setLabel] = useState(item?.label ?? "");
  const [kind, setKind] = useState<MenuTarget["kind"]>(item?.target.kind ?? "home");
  const [destination, setDestination] = useState(item && "resourceId" in item.target ? item.target.resourceId : item && "url" in item.target ? item.target.url : item && "anchor" in item.target ? item.target.anchor : "");
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
    const target: MenuTarget = kind === "home" || kind === "search" ? { kind }
      : kind === "external" ? { kind, url: value }
      : kind === "anchor" ? { kind, anchor: `#${value.replace(/^#/, "")}` }
      : { kind, resourceId: value };
    onApply({ id: item?.id ?? crypto.randomUUID(), label: label.trim(), target, children: item?.children ?? [] });
  }
  return <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4" role="group" aria-label={item ? "Edit menu link" : "New menu link"}>
    <div className="flex flex-col gap-2"><Label htmlFor={`${id}-label`}>Link label</Label><Input id={`${id}-label`} value={label} onChange={event => setLabel(event.target.value)} maxLength={120} /></div>
    <div className="flex flex-col gap-2"><Label htmlFor={`${id}-type`}>Destination type</Label><select className="admin-button" id={`${id}-type`} value={kind} onChange={event => { setKind(event.target.value as MenuTarget["kind"]); setDestination(""); setError(""); }}>
      {(["home", "search", "collection", "product", "page", "blog", "article", "external", "anchor"] as const).map(value => <option key={value} value={value}>{value === "external" ? "URL" : value[0].toUpperCase() + value.slice(1)}</option>)}
    </select></div>
    {kind === "collection" ? <>
      <div className="flex flex-col gap-2"><Label htmlFor={`${id}-search`}>Search collections</Label><Input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="flex flex-col gap-2"><Label htmlFor={`${id}-collection`}>Collection</Label><select id={`${id}-collection`} className="admin-button" value={destination} onChange={event => setDestination(event.target.value)}><option value="">Choose a collection</option>{collections.filter(collection => collection.id === destination || `${collection.title} ${collection.handle}`.toLowerCase().includes(query.toLowerCase())).map(collection => <option key={collection.id} value={collection.id}>{collection.title} · {collection.handle}</option>)}</select></div>
    </> : kind !== "home" && kind !== "search" ? <div className="flex flex-col gap-2"><Label htmlFor={`${id}-destination`}>{kind === "external" ? "URL" : kind === "anchor" ? "Anchor" : "Resource ID"}</Label><Input id={`${id}-destination`} value={destination} onChange={event => setDestination(event.target.value)} /></div> : null}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="button" onClick={apply}>Apply link</Button><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button></div>
  </div>;
}
