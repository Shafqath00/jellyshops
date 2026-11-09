"use client";
import type { ReactNode } from "react";

export type SelectListItem = { id: string; label: string; sub?: ReactNode; badge?: ReactNode };

/**
 * A card listing items to pick one from (pages, blogs, menus…). The chosen row is marked with
 * aria-current; on phones the list sits above the detail it controls.
 */
export function SelectList({ label, title, items, selectedId, onSelect, empty, footer, loading = false }: {
  /** What the items are, for screen readers: "Pages". */
  label: string;
  /** Optional visible heading on the card. */
  title?: string;
  items: SelectListItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  empty?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
}) {
  return <section className="jk-card is-flush jk-select-card" aria-label={title ? undefined : label}>
    {title && <div className="jk-card-header"><h2>{title}</h2></div>}
    {loading ? <div className="jk-select-loading" role="status" aria-label={`Loading ${label.toLowerCase()}`}>{[0, 1, 2].map((key) => <span key={key} className="jk-skeleton" style={{ height: 14, width: `${70 - key * 15}%` }} />)}</div> :
      items.length ? <ul className="jk-select-list" aria-label={label}>{items.map((item) => <li key={item.id}>
        <button type="button" className="jk-select-row" aria-current={item.id === selectedId ? "true" : undefined} onClick={() => onSelect(item.id)}>
          <span className="min-w-0 flex-1"><span className="jk-select-label">{item.label}</span>{item.sub && <span className="jk-cell-sub truncate">{item.sub}</span>}</span>
          {item.badge}
        </button>
      </li>)}</ul> : <p className="jk-select-empty">{empty ?? "Nothing here yet."}</p>}
    {footer && <div className="jk-select-footer">{footer}</div>}
  </section>;
}

/** List on the left, the chosen item on the right; stacked below 1024px. */
export function SplitLayout({ list, children, wideList = false }: { list: ReactNode; children: ReactNode; wideList?: boolean }) {
  return <div className={`jk-split ${wideList ? "is-wide" : ""}`}><div className="jk-split-list">{list}</div><div className="jk-split-main">{children}</div></div>;
}
