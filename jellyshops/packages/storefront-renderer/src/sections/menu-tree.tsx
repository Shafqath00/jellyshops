import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { readMenuImage, safeRichTextHref, type MenuImage, type RuntimeMenuV4 } from "@jelly/storefront-schema";

export type MenuTreeItem = RuntimeMenuV4["items"][number];
/** "bar": desktop links with dropdowns; "panel": the phone menu with fold-out groups; "flat": top-level links only (footer). */
export type MenuVariant = "bar" | "panel" | "flat";
type HrefFor = (item: MenuTreeItem) => string | null;
type ShownItem = { item: MenuTreeItem; href: string | null; image?: MenuImage; children: ShownItem[] };
/** The large ("mega") menu: a full-width panel with columns of links and photo tiles. */
export interface MegaMenuOptions { photoShape?: "landscape" | "square" | "portrait" }

/** Keeps items that lead somewhere: their own link, or a child that has one. */
export function shownMenuItems(items: MenuTreeItem[], hrefFor: HrefFor): ShownItem[] {
  return items.flatMap((item) => {
    const href = hrefFor(item);
    const children = shownMenuItems(item.children ?? [], hrefFor);
    const image = readMenuImage(item.image);
    const url = image ? safeRichTextHref(image.url) : null;
    const safeImage = image && url && !url.startsWith("#") ? { ...image, url } : undefined;
    return href || children.length > 0 ? [{ item, href, ...(safeImage ? { image: safeImage } : {}), children }] : [];
  });
}

function Chevron() {
  return <svg className="jelly-menu-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>;
}

function Label({ entry }: { entry: ShownItem }) {
  return entry.href ? <a href={entry.href}>{entry.item.label}</a> : <span className="jelly-menu-label">{entry.item.label}</span>;
}

/** Links under a dropdown heading; a third level sits indented under its parent. */
function SubmenuLinks({ entries }: { entries: ShownItem[] }) {
  return <>{entries.map((entry) => <li key={entry.item.id}>
    <Label entry={entry} />
    {entry.children.length > 0 && <ul className="jelly-submenu-group">{entry.children.map((child) => <li key={child.item.id}><Label entry={child} /></li>)}</ul>}
  </li>)}</>;
}

/**
 * Splits a top link's children for the large menu: a child with links inside becomes a column (its own link is
 * the column heading), a child with a photo and nothing inside becomes a picture tile, and the rest are plain links.
 */
export function megaMenuParts(entries: ShownItem[]): { columns: ShownItem[]; links: ShownItem[]; tiles: ShownItem[] } {
  const columns: ShownItem[] = [], links: ShownItem[] = [], tiles: ShownItem[] = [];
  for (const entry of entries) {
    if (entry.children.length > 0) columns.push(entry);
    else if (entry.image && entry.href) tiles.push(entry);
    else links.push(entry);
  }
  return { columns, links, tiles };
}

function MenuTile({ tile }: { tile: ShownItem }) {
  return <a className="jelly-mega-tile" href={tile.href ?? undefined}>
    {/* Merchant media URLs may be served by the API and are not Next Image assets. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={tile.image?.url} alt={tile.image?.alt ?? ""} loading="lazy" decoding="async" />
    <span>{tile.item.label}</span>
  </a>;
}

function MegaPanel({ entry, id, photoShape }: { entry: ShownItem; id: string; photoShape: NonNullable<MegaMenuOptions["photoShape"]> }) {
  const { columns, links, tiles } = megaMenuParts(entry.children);
  return <div id={id} className="jelly-mega" data-photo-shape={photoShape}>
    <div className="jelly-mega-inner">
      {(columns.length > 0 || links.length > 0) && <div className="jelly-mega-columns">
        {columns.map((column) => <div key={column.item.id} className="jelly-mega-column">
          <p className="jelly-mega-heading"><Label entry={column} /></p>
          <ul className="jelly-mega-links">{column.children.map((child) => <li key={child.item.id}><Label entry={child} /></li>)}</ul>
        </div>)}
        {links.length > 0 && <div className="jelly-mega-column"><ul className="jelly-mega-links">{links.map((child) => <li key={child.item.id}><Label entry={child} /></li>)}</ul></div>}
      </div>}
      {tiles.length > 0 && <ul className="jelly-mega-tiles" data-count={Math.min(tiles.length, 4)}>{tiles.map((tile) => <li key={tile.item.id}><MenuTile tile={tile} /></li>)}</ul>}
      {entry.href && <a className="jelly-mega-all" href={entry.href}>{`Shop all ${entry.item.label}`}</a>}
    </div>
  </div>;
}

function BarItem({ entry, open, dismissed, mega, onToggle, onClose, onPointerLeave }: { entry: ShownItem; open: boolean; dismissed: boolean; mega?: MegaMenuOptions; onToggle(): void; onClose(): void; onPointerLeave(): void }) {
  const id = useId();
  const label = entry.item.label;
  const closeWhenFocusLeaves = (event: FocusEvent<HTMLLIElement>) => {
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
  };
  // `data-hover-off`: Escape hides a dropdown shown by hovering until the pointer leaves it.
  return <li className="jelly-menu-item" data-item-id={entry.item.id} data-has-children="true" data-mega={mega ? "true" : undefined} data-open={open ? "true" : undefined} data-hover-off={dismissed ? "true" : undefined} onBlur={closeWhenFocusLeaves} onPointerLeave={onPointerLeave}>
    {entry.href
      ? <><a href={entry.href}>{label}</a><button type="button" className="jelly-menu-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}><Chevron /><span className="jelly-visually-hidden">{`${label} menu`}</span></button></>
      : <button type="button" className="jelly-menu-toggle jelly-menu-toggle-label" aria-expanded={open} aria-controls={id} onClick={onToggle}>{label}<Chevron /></button>}
    {mega ? <MegaPanel entry={entry} id={id} photoShape={mega.photoShape ?? "landscape"} /> : <ul id={id} className="jelly-submenu"><SubmenuLinks entries={entry.children} /></ul>}
  </li>;
}

function MenuBar({ entries, mega }: { entries: ShownItem[]; mega?: MegaMenuOptions }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    const doc = list?.ownerDocument;
    if (!list || !doc) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const item = list.querySelector<HTMLElement>(".jelly-menu-item[data-open='true'], .jelly-menu-item:hover");
      if (!item) return;
      if (item.dataset.open === "true" || item.contains(doc.activeElement)) item.querySelector<HTMLButtonElement>(":scope > .jelly-menu-toggle")?.focus();
      setOpenId(null);
      setDismissedId(item.dataset.itemId ?? null);
    };
    doc.addEventListener("keydown", closeOnEscape);
    return () => doc.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    const list = listRef.current;
    const doc = list?.ownerDocument;
    if (!openId || !list || !doc) return;
    const closeOutside = (event: Event) => { if (!list.contains(event.target as Node)) setOpenId(null); };
    doc.addEventListener("pointerdown", closeOutside);
    return () => doc.removeEventListener("pointerdown", closeOutside);
  }, [openId]);
  const toggle = (id: string) => { setDismissedId(null); setOpenId((current) => current === id ? null : id); };
  return <ul ref={listRef} className="jelly-menu" data-menu="bar" data-mega-menu={mega ? "true" : undefined}>{entries.map((entry) => entry.children.length > 0
    ? <BarItem key={entry.item.id} entry={entry} mega={mega} open={openId === entry.item.id} dismissed={dismissedId === entry.item.id} onToggle={() => toggle(entry.item.id)} onClose={() => setOpenId(null)} onPointerLeave={() => setDismissedId((current) => current === entry.item.id ? null : current)} />
    : <li key={entry.item.id}><Label entry={entry} /></li>)}</ul>;
}

/**
 * Phone menu: an item with children folds open; its own page is the first link inside.
 * With the large menu, children with a photo show as a two-column grid of picture tiles above the other links.
 */
function PanelList({ entries, mega }: { entries: ShownItem[]; mega?: MegaMenuOptions }) {
  return <ul>{entries.map((entry) => {
    const tiles = mega ? entry.children.filter((child) => child.children.length === 0 && child.image && child.href) : [];
    const rest = tiles.length > 0 ? entry.children.filter((child) => !tiles.includes(child)) : entry.children;
    return <li key={entry.item.id}>
      {entry.children.length > 0
        ? <details className="jelly-menu-disclosure">
            <summary>{entry.item.label}<Chevron /></summary>
            {entry.href && <a className="jelly-menu-view-all" href={entry.href} aria-label={`View all ${entry.item.label}`}>View all</a>}
            {tiles.length > 0 && <ul className="jelly-menu-tiles" data-photo-shape={mega?.photoShape ?? "landscape"}>{tiles.map((tile) => <li key={tile.item.id}><MenuTile tile={tile} /></li>)}</ul>}
            {rest.length > 0 && <PanelList entries={rest} mega={mega} />}
          </details>
        : <Label entry={entry} />}
    </li>;
  })}</ul>;
}

/** One navigation menu drawn for the header bar, the phone menu or the footer. */
export function MenuTree({ items, hrefFor, variant = "flat", mega }: { items: MenuTreeItem[]; hrefFor: HrefFor; variant?: MenuVariant; mega?: MegaMenuOptions }) {
  const entries = shownMenuItems(items, hrefFor);
  if (variant === "bar") return entries.length > 0 ? <MenuBar entries={entries} mega={mega} /> : null;
  if (variant === "panel") return entries.length > 0 ? <PanelList entries={entries} mega={mega} /> : null;
  const links = entries.filter((entry) => entry.href);
  return links.length > 0 ? <ul>{links.map((entry) => <li key={entry.item.id}><Label entry={entry} /></li>)}</ul> : null;
}
