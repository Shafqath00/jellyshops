"use client";

import { useId, useState } from "react";
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
  return <div className="jk-stack-sm" role="group" aria-label={item ? "Edit menu link" : "New menu link"}>
    <div className="jk-field"><label htmlFor={`${id}-label`}>Link label</label><input id={`${id}-label`} value={label} onChange={event => setLabel(event.target.value)} maxLength={120} /></div>
    <div className="jk-field"><label htmlFor={`${id}-type`}>Destination type</label><select id={`${id}-type`} value={kind} onChange={event => { setKind(event.target.value as MenuTarget["kind"]); setDestination(""); setError(""); }}>
      {(["home", "search", "collection", "product", "page", "blog", "article", "external", "anchor"] as const).map(value => <option key={value} value={value}>{value === "external" ? "URL" : value[0].toUpperCase() + value.slice(1)}</option>)}
    </select></div>
    {kind === "collection" ? <>
      <div className="jk-field"><label htmlFor={`${id}-search`}>Search collections</label><input id={`${id}-search`} type="search" value={query} onChange={event => setQuery(event.target.value)} /></div>
      <div className="jk-field"><label htmlFor={`${id}-collection`}>Collection</label><select id={`${id}-collection`} value={destination} onChange={event => setDestination(event.target.value)}><option value="">Choose a collection</option>{collections.filter(collection => collection.id === destination || `${collection.title} ${collection.handle}`.toLowerCase().includes(query.toLowerCase())).map(collection => <option key={collection.id} value={collection.id}>{collection.title} · {collection.handle}</option>)}</select></div>
    </> : kind !== "home" && kind !== "search" ? <div className="jk-field"><label htmlFor={`${id}-destination`}>{kind === "external" ? "URL" : kind === "anchor" ? "Anchor" : "Resource ID"}</label><input id={`${id}-destination`} value={destination} onChange={event => setDestination(event.target.value)} /></div> : null}
    {error && <p role="alert" className="jk-field-error">{error}</p>}
    <div className="jk-row"><button type="button" className="jk-button jk-button-primary" onClick={apply}>Apply link</button><button type="button" className="jk-button" onClick={onCancel}>Cancel</button></div>
  </div>;
}
