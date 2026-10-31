import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import type { RuntimeMenuV4 } from "@jelly/storefront-schema";

export type MenuTreeItem = RuntimeMenuV4["items"][number];
/** "bar": desktop links with dropdowns; "panel": the phone menu with fold-out groups; "flat": top-level links only (footer). */
export type MenuVariant = "bar" | "panel" | "flat";
type HrefFor = (item: MenuTreeItem) => string | null;
type ShownItem = { item: MenuTreeItem; href: string | null; children: ShownItem[] };

/** Keeps items that lead somewhere: their own link, or a child that has one. */
export function shownMenuItems(items: MenuTreeItem[], hrefFor: HrefFor): ShownItem[] {
  return items.flatMap((item) => {
    const href = hrefFor(item);
    const children = shownMenuItems(item.children ?? [], hrefFor);
    return href || children.length > 0 ? [{ item, href, children }] : [];
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

function BarItem({ entry, open, dismissed, onToggle, onClose, onPointerLeave }: { entry: ShownItem; open: boolean; dismissed: boolean; onToggle(): void; onClose(): void; onPointerLeave(): void }) {
  const id = useId();
  const label = entry.item.label;
  const closeWhenFocusLeaves = (event: FocusEvent<HTMLLIElement>) => {
    if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
  };
  // `data-hover-off`: Escape hides a dropdown shown by hovering until the pointer leaves it.
  return <li className="jelly-menu-item" data-item-id={entry.item.id} data-has-children="true" data-open={open ? "true" : undefined} data-hover-off={dismissed ? "true" : undefined} onBlur={closeWhenFocusLeaves} onPointerLeave={onPointerLeave}>
    {entry.href
      ? <><a href={entry.href}>{label}</a><button type="button" className="jelly-menu-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}><Chevron /><span className="jelly-visually-hidden">{`${label} menu`}</span></button></>
      : <button type="button" className="jelly-menu-toggle jelly-menu-toggle-label" aria-expanded={open} aria-controls={id} onClick={onToggle}>{label}<Chevron /></button>}
    <ul id={id} className="jelly-submenu"><SubmenuLinks entries={entry.children} /></ul>
  </li>;
}

function MenuBar({ entries }: { entries: ShownItem[] }) {
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
  return <ul ref={listRef} className="jelly-menu" data-menu="bar">{entries.map((entry) => entry.children.length > 0
    ? <BarItem key={entry.item.id} entry={entry} open={openId === entry.item.id} dismissed={dismissedId === entry.item.id} onToggle={() => toggle(entry.item.id)} onClose={() => setOpenId(null)} onPointerLeave={() => setDismissedId((current) => current === entry.item.id ? null : current)} />
    : <li key={entry.item.id}><Label entry={entry} /></li>)}</ul>;
}

/** Phone menu: an item with children folds open; its own page is the first link inside. */
function PanelList({ entries }: { entries: ShownItem[] }) {
  return <ul>{entries.map((entry) => <li key={entry.item.id}>
    {entry.children.length > 0
      ? <details className="jelly-menu-disclosure">
          <summary>{entry.item.label}<Chevron /></summary>
          {entry.href && <a className="jelly-menu-view-all" href={entry.href} aria-label={`View all ${entry.item.label}`}>View all</a>}
          <PanelList entries={entry.children} />
        </details>
      : <Label entry={entry} />}
  </li>)}</ul>;
}

/** One navigation menu drawn for the header bar, the phone menu or the footer. */
export function MenuTree({ items, hrefFor, variant = "flat" }: { items: MenuTreeItem[]; hrefFor: HrefFor; variant?: MenuVariant }) {
  const entries = shownMenuItems(items, hrefFor);
  if (variant === "bar") return entries.length > 0 ? <MenuBar entries={entries} /> : null;
  if (variant === "panel") return entries.length > 0 ? <PanelList entries={entries} /> : null;
  const links = entries.filter((entry) => entry.href);
  return links.length > 0 ? <ul>{links.map((entry) => <li key={entry.item.id}><Label entry={entry} /></li>)}</ul> : null;
}
