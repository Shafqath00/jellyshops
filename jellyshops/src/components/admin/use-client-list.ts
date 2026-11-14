"use client";
import { useMemo, useState } from "react";
import type { IndexSort, SortDirection } from "./index-table";

/** Sorts two values the way a merchant expects: numbers by size, words A to Z without regard to case. */
export function compareValues(a: string | number, b: string | number): number {
  return typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { sensitivity: "base", numeric: true });
}

/**
 * Search, sort and paging for a list the page already holds in full (collections, reviews, messages).
 * Lists that can grow large are searched and paged by the API instead.
 * Spread `search`, `sort` and `pagination` onto `IndexTable` and pass it `rows`.
 */
export function useClientList<T>(all: T[], options: {
  /** The words a row is found by. */
  text: (row: T) => string;
  /** What each sortable column sorts by, keyed by the column's `sortKey`. */
  sortBy?: Record<string, (row: T) => string | number>;
  initialSort?: { key: string; direction: SortDirection };
  pageSize?: number;
  /** What the rows are called in the count: ["collection", "collections"]. */
  noun: [string, string];
  searchLabel: string;
}) {
  const { text, sortBy, initialSort, pageSize = 25, noun, searchLabel } = options;
  const [query, setQueryText] = useState("");
  const [sort, setSort] = useState(initialSort);
  const [pageIndex, setPageIndex] = useState(0);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const found = needle ? all.filter((row) => text(row).toLowerCase().includes(needle)) : [...all];
    const value = sort && sortBy?.[sort.key];
    if (value) found.sort((a, b) => compareValues(value(a), value(b)) * (sort.direction === "asc" ? 1 : -1));
    return found;
    // `text` and `sortBy` are plain functions of the row; listing them would re-sort on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, query, sort]);
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(pageIndex, pages - 1);
  const rows = matches.slice(page * pageSize, (page + 1) * pageSize);
  const count = `${matches.length} ${matches.length === 1 ? noun[0] : noun[1]}`;
  return {
    rows,
    total: matches.length,
    filtered: Boolean(query.trim()),
    search: { value: query, onChange: (value: string) => { setQueryText(value); setPageIndex(0); }, label: searchLabel, placeholder: searchLabel },
    sort: sort && sortBy ? { ...sort, onChange: (key: string, direction: SortDirection) => { setSort({ key, direction }); setPageIndex(0); } } satisfies IndexSort : undefined,
    pagination: { summary: pages > 1 ? `${count} · Page ${page + 1} of ${pages}` : count, hasPrevious: page > 0, hasNext: page < pages - 1, onPrevious: () => setPageIndex(page - 1), onNext: () => setPageIndex(page + 1) },
  };
}
