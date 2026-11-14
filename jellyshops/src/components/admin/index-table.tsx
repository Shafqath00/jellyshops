"use client";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Banner, TableSkeleton } from "./feedback";
import { Button } from "./button";
import { Tabs } from "./tabs";

export type IndexColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: "start" | "end";
  /** On phones each row becomes a card: `primary` is its heading, `hidden` columns are left out. */
  mobile?: "primary" | "show" | "hidden";
  hideHeader?: boolean;
  /** Set to let merchants sort by this column from its heading. The page does the sorting (usually the API). */
  sortKey?: string;
  /**
   * Set to make the column optional in the "Columns" menu: true = hidden until the merchant turns it on,
   * false = shown but can be turned off. Leave unset for columns that always show.
   */
  defaultHidden?: boolean;
};

export type SortDirection = "asc" | "desc";
export type IndexSort = { key: string; direction: SortDirection; onChange: (key: string, direction: SortDirection) => void };

export type BulkAction = { label: string; onAction: (ids: string[]) => void | Promise<void>; destructive?: boolean };
export type IndexTab = { id: string; label: string; count?: number };

export type IndexTableProps<T> = {
  /** What the rows are, for screen readers: "Orders". */
  label: string;
  rows: T[];
  rowKey: (row: T) => string;
  /** Name of one row for its checkbox: "Order JS-1001". */
  rowLabel: (row: T) => string;
  columns: IndexColumn<T>[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  tabs?: IndexTab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  search?: { value: string; onChange: (value: string) => void; placeholder: string; label: string; onSubmit?: () => void };
  /** Extra filter and sort controls shown beside the search box. Keep it to one or two plus sort. */
  filters?: ReactNode;
  /** Less used filters, behind a "More filters" button. `moreFiltersActive` counts the ones in use. */
  moreFilters?: ReactNode;
  moreFiltersActive?: number;
  /**
   * Which column the rows are sorted by. Column headings are hidden on phones, so a page that
   * must sort on phones also keeps a "Sort" select in `filters`.
   */
  sort?: IndexSort;
  bulkActions?: BulkAction[];
  emptyState: ReactNode;
  pagination?: { summary?: string; hasPrevious: boolean; hasNext: boolean; onPrevious: () => void; onNext: () => void };
};

/** Clicking anywhere on a row opens it, unless the click was on a control inside the row. */
function openRow(event: MouseEvent<HTMLTableRowElement>) {
  const target = event.target as HTMLElement;
  if (target.closest("a,button,input,select,textarea,label")) return;
  event.currentTarget.querySelector<HTMLAnchorElement>("a[href]")?.click();
}

/** Which optional columns the merchant has turned on or off, remembered per list in this browser. */
function useColumnChoices<T>(label: string, columns: IndexColumn<T>[]) {
  const storageKey = `jelly-admin-columns:${label}`;
  const [choices, setChoices] = useState<Record<string, boolean>>({});
  // Read after the first render so the server and the browser draw the same table first.
  useEffect(() => {
    try { setChoices(JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<string, boolean>); } catch { /* keep the defaults */ }
  }, [storageKey]);
  const isShown = (column: IndexColumn<T>) => column.defaultHidden === undefined ? true : choices[column.id] ?? !column.defaultHidden;
  const setShown = (id: string, shown: boolean) => setChoices((current) => {
    const next = { ...current, [id]: shown };
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* the choice still applies until the page is reloaded */ }
    return next;
  });
  return { isShown, setShown };
}

/** A small menu that opens under its button. Escape or a click outside closes it. */
function ToolbarMenu({ label, count, children, align = "end" }: { label: string; count?: number; children: ReactNode; align?: "start" | "end" }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const menu = ref.current;
      if (!menu?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", close); };
  }, []);
  return <details ref={ref} className={`jk-toolbar-menu is-${align}`}>
    <summary className="jk-button">{label}{count ? <span className="jk-tab-count">{count}</span> : null}</summary>
    <div className="jk-toolbar-menu-panel">{children}</div>
  </details>;
}

export function IndexTable<T>({ label, rows, rowKey, rowLabel, columns: allColumns, loading = false, error, onRetry, tabs, activeTab, onTabChange, search, filters, moreFilters, moreFiltersActive, sort, bulkActions = [], emptyState, pagination }: IndexTableProps<T>) {
  const { isShown, setShown } = useColumnChoices(label, allColumns);
  const optionalColumns = allColumns.filter((column) => column.defaultHidden !== undefined);
  const columns = allColumns.filter(isShown);
  const [picked, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState("");
  const [bulkError, setBulkError] = useState("");
  const selectAll = useRef<HTMLInputElement>(null);
  const keys = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  // Selection only covers rows on the page being shown, so rows that left the page drop out.
  const selected = useMemo(() => new Set([...picked].filter((key) => keys.includes(key))), [picked, keys]);
  const selectable = bulkActions.length > 0;
  const allSelected = keys.length > 0 && keys.every((key) => selected.has(key));
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = selected.size > 0 && !allSelected; }, [selected, allSelected]);
  const toggle = (key: string) => setSelected(() => { const next = new Set(selected); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  async function runBulk(action: BulkAction) {
    setBusy(action.label); setBulkError("");
    try { await action.onAction([...selected]); setSelected(new Set()); }
    catch (failure) { setBulkError(failure instanceof Error ? failure.message : `${action.label} did not finish. Try again.`); }
    finally { setBusy(""); }
  }
  const showSkeleton = loading && rows.length === 0;
  return <section className="jk-index" aria-label={label}>
    {tabs && <Tabs label={`${label} views`} tabs={tabs} active={activeTab} onChange={onTabChange} />}
    {selected.size > 0 ? <div className="jk-bulkbar">
      <strong>{selected.size} selected</strong>
      {bulkActions.map((action) => <Button key={action.label} variant={action.destructive ? "destructive-quiet" : "secondary"} loading={busy === action.label} disabled={Boolean(busy)} onClick={() => void runBulk(action)}>{action.label}</Button>)}
      <button type="button" className="jk-button jk-button-plain" onClick={() => setSelected(new Set())}>Clear selection</button>
    </div> : (search || filters || moreFilters || optionalColumns.length > 0) && <div className="jk-toolbar">
      {search && <form className="jk-search" role="search" onSubmit={(event) => { event.preventDefault(); search.onSubmit?.(); }}>
        <Search size={16} aria-hidden="true" />
        <input type="search" aria-label={search.label} placeholder={search.placeholder} value={search.value} onChange={(event) => search.onChange(event.target.value)} />
      </form>}
      {filters && <div className="jk-filters">{filters}</div>}
      {moreFilters && <ToolbarMenu label="More filters" count={moreFiltersActive}><div className="jk-stack-sm">{moreFilters}</div></ToolbarMenu>}
      {optionalColumns.length > 0 && <ToolbarMenu label="Columns">
        <fieldset className="jk-stack-sm"><legend className="sr-only">Columns to show</legend>
          {optionalColumns.map((column) => <label key={column.id} className="jk-check"><input type="checkbox" checked={isShown(column)} onChange={(event) => setShown(column.id, event.target.checked)} />{column.header}</label>)}
        </fieldset>
      </ToolbarMenu>}
    </div>}
    {error && <div className="jk-pad"><Banner tone="critical" title={`Could not load ${label.toLowerCase()}`} action={onRetry && <button type="button" className="jk-button" onClick={onRetry}>Try again</button>}>{error}</Banner></div>}
    {bulkError && <div className="jk-pad"><Banner tone="critical" onDismiss={() => setBulkError("")}>{bulkError}</Banner></div>}
    {showSkeleton ? <TableSkeleton columns={Math.min(columns.length, 6)} label={`Loading ${label.toLowerCase()}`} /> : !rows.length ? (!error && emptyState) :
      <div className="jk-table-scroll"><table className="jk-table" aria-busy={loading}>
        <thead><tr>
          {selectable && <th className="jk-check-cell"><input ref={selectAll} type="checkbox" aria-label={`Select all ${label.toLowerCase()} on this page`} checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(keys))} /></th>}
          {columns.map((column) => { const sorted = sort && column.sortKey === sort.key ? sort.direction : undefined; const Arrow = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
            return <th key={column.id} scope="col" className={column.align === "end" ? "is-end" : ""} aria-sort={sort && column.sortKey ? (sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none") : undefined}>
              {sort && column.sortKey
                ? <button type="button" className={`jk-sort ${sorted ? "is-sorted" : ""}`} onClick={() => sort.onChange(column.sortKey!, sorted === "asc" ? "desc" : "asc")}>{column.header}<Arrow size={13} aria-hidden="true" /></button>
                : column.hideHeader ? <span className="sr-only">{column.header}</span> : column.header}
            </th>; })}
        </tr></thead>
        <tbody>{rows.map((row) => { const key = rowKey(row); return <tr key={key} onClick={openRow} className={selected.has(key) ? "is-selected" : ""}>
          {selectable && <td className="jk-check-cell"><input type="checkbox" aria-label={`Select ${rowLabel(row)}`} checked={selected.has(key)} onChange={() => toggle(key)} /></td>}
          {columns.map((column) => <td key={column.id} data-label={column.hideHeader ? undefined : column.header} data-mobile={column.mobile ?? "show"} className={column.align === "end" ? "is-end" : ""}>{column.cell(row)}</td>)}
        </tr>; })}</tbody>
      </table></div>}
    {pagination && (pagination.hasNext || pagination.hasPrevious || pagination.summary) && rows.length > 0 && <footer className="jk-pagination">
      <span className="jk-muted">{pagination.summary}</span>
      <div className="jk-pagination-buttons">
        <button type="button" className="jk-button" disabled={!pagination.hasPrevious || loading} onClick={pagination.onPrevious}>Previous</button>
        <button type="button" className="jk-button" disabled={!pagination.hasNext || loading} onClick={pagination.onNext}>Next</button>
      </div>
    </footer>}
  </section>;
}
