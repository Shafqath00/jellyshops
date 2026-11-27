"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "@/features/admin/admin-routing";
import { AdminPage, Banner, Button, EmptyState, SaveBar, Tabs, TableSkeleton, useToast, useUnsavedChangesWarning } from "@/components/admin";
import { useAdminCatalog, type CatalogPage } from "@/features/admin/api/catalog-api";
import { useContentApi } from "@/features/content-admin/shared";
import {
  DESCRIPTION_MAX, TITLE_MAX, bulkProblems, currentValue, needsWork, plainStart, toPatch, withEdit,
  type BulkEdit, type BulkKind, type BulkRow,
} from "./bulk-seo";

const PAGE_SIZE = 50;
const KIND_LABEL: Record<BulkKind, string> = { product: "Products", page: "Pages", post: "Blog posts" };
const EDIT_HREF: Record<BulkKind, (id: string) => string> = {
  product: (id) => `/admin/products/${encodeURIComponent(id)}`,
  page: (id) => `/admin/content/pages/${encodeURIComponent(id)}`,
  post: (id) => `/admin/content/blogs/${encodeURIComponent(id)}`,
};

type ProductNode = { id: string; title: string; description?: string; status?: string; seoTitle?: string | null; seoDescription?: string | null };

function SeoRow({ row, value, onChange }: { row: BulkRow; value: BulkEdit; onChange: (patch: Partial<BulkEdit>) => void }) {
  const problems = bulkProblems(value);
  const changed = value.seoTitle !== row.seoTitle || value.seoDescription !== row.seoDescription;
  const idBase = `bulk-${row.key.replace(/[^a-z0-9]/gi, "-")}`;
  return <tr data-changed={changed || undefined}>
    <th scope="row" className="jk-bulk-name">
      <Link href={EDIT_HREF[row.kind](row.id)} className="jk-link">{row.name}</Link>
      {row.status && row.status !== "ACTIVE" && row.status !== "PUBLISHED" && <small className="jk-muted">{row.status.toLowerCase()}</small>}
    </th>
    <td>
      <label className="sr-only" htmlFor={`${idBase}-title`}>Search title for {row.name}</label>
      <input id={`${idBase}-title`} className="jk-input" value={value.seoTitle} placeholder={row.fallbackTitle} aria-invalid={problems.title ? true : undefined} aria-describedby={`${idBase}-title-help`} onChange={(event) => onChange({ seoTitle: event.target.value })} />
      <small id={`${idBase}-title-help`} className={problems.title ? "jk-field-error" : "jk-muted"} role={problems.title ? "alert" : undefined}>{problems.title ?? `${value.seoTitle.length} of ${TITLE_MAX}`}</small>
    </td>
    <td>
      <label className="sr-only" htmlFor={`${idBase}-desc`}>Search description for {row.name}</label>
      <textarea id={`${idBase}-desc`} className="jk-input" rows={2} value={value.seoDescription} placeholder={row.fallbackDescription ? `Uses: ${plainStart(row.fallbackDescription, 90)}` : "Nothing yet. Add a sentence."} aria-invalid={problems.description ? true : undefined} aria-describedby={`${idBase}-desc-help`} onChange={(event) => onChange({ seoDescription: event.target.value })} />
      <small id={`${idBase}-desc-help`} className={problems.description ? "jk-field-error" : "jk-muted"} role={problems.description ? "alert" : undefined}>{problems.description ?? `${value.seoDescription.length} of ${DESCRIPTION_MAX}`}</small>
    </td>
  </tr>;
}

/**
 * Settings > Store preferences > Bulk SEO editor: the search title and description of many products, pages and posts
 * on one screen. Edits are kept while you switch tabs and are saved together with one button.
 */
export function BulkSeoEditor() {
  const catalog = useAdminCatalog();
  const { api: content, storeId } = useContentApi();
  const toast = useToast();
  const [kind, setKind] = useState<BulkKind>("product");
  const [rows, setRows] = useState<Record<BulkKind, BulkRow[]>>({ product: [], page: [], post: [] });
  const [more, setMore] = useState<Record<BulkKind, { next: string | number | null; loaded: boolean }>>({ product: { next: null, loaded: false }, page: { next: null, loaded: false }, post: { next: null, loaded: false } });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [onlyWork, setOnlyWork] = useState(false);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedKey, setLoadedKey] = useState("");
  const [edits, setEdits] = useState<Map<string, BulkEdit>>(new Map());
  const [saving, setSaving] = useState(false);
  const [tick, setTick] = useState(0);
  useUnsavedChangesWarning(edits.size > 0);

  // Search as the owner types, after a short pause. A new search starts the lists again.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const { request } = catalog;
  const fetchPage = useCallback(async (which: BulkKind, from: string | number | null): Promise<{ rows: BulkRow[]; next: string | number | null }> => {
    if (which === "product") {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (search) params.set("query", search);
      if (typeof from === "string") params.set("cursor", from);
      const page = await request<CatalogPage<ProductNode>>(`/products?${params}`);
      return {
        next: page.nextCursor,
        rows: page.nodes.filter((item) => item.status !== "ARCHIVED").map((item) => ({
          key: `product:${item.id}`, kind: "product" as const, id: item.id, name: item.title, fallbackTitle: item.title, fallbackDescription: item.description ?? "",
          seoTitle: item.seoTitle ?? "", seoDescription: item.seoDescription ?? "", status: item.status ?? "",
        })),
      };
    }
    if (!content || !storeId) throw new Error("Select a store and sign in to continue.");
    const offset = typeof from === "number" ? from : 0;
    const query = { q: search || undefined, state: "active" as const, limit: PAGE_SIZE, offset };
    if (which === "page") {
      const result = await content.browsePages(storeId, query);
      return { next: offset + result.items.length < result.total ? offset + result.items.length : null, rows: result.items.map((item) => ({ key: `page:${item.id}`, kind: "page" as const, id: item.id, name: item.title, fallbackTitle: item.title, fallbackDescription: "", seoTitle: item.seoTitle ?? "", seoDescription: item.seoDescription ?? "", status: item.status ?? "" })) };
    }
    const result = await content.browseArticles(storeId, query);
    return { next: offset + result.items.length < result.total ? offset + result.items.length : null, rows: result.items.map((item) => ({ key: `post:${item.id}`, kind: "post" as const, id: item.id, name: item.title, fallbackTitle: item.title, fallbackDescription: item.excerpt ?? "", seoTitle: item.seoTitle ?? "", seoDescription: item.seoDescription ?? "", status: item.status ?? "" })) };
  }, [request, content, storeId, search]);

  // Load the first page of the open tab (again after a new search or "Try again").
  const listKey = `${kind}|${search}|${tick}`;
  const loading = loadingMore || loadedKey !== listKey;
  useEffect(() => {
    if (!catalog.ready || !content) return;
    let live = true;
    fetchPage(kind, null).then(
      (result) => { if (!live) return; setRows((current) => ({ ...current, [kind]: result.rows })); setMore((current) => ({ ...current, [kind]: { next: result.next, loaded: true } })); setError(""); setLoadedKey(listKey); },
      (failure: unknown) => { if (!live) return; setError(failure instanceof Error ? failure.message : "Could not load the list."); setLoadedKey(listKey); },
    );
    return () => { live = false; };
  }, [kind, catalog.ready, content, fetchPage, listKey]);

  async function loadMore() {
    const from = more[kind].next;
    if (from === null) return;
    setLoadingMore(true);
    try {
      const result = await fetchPage(kind, from);
      setRows((current) => ({ ...current, [kind]: [...current[kind], ...result.rows.filter((row) => !current[kind].some((existing) => existing.key === row.key))] }));
      setMore((current) => ({ ...current, [kind]: { next: result.next, loaded: true } }));
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : "Could not load more.", { tone: "critical" });
    } finally { setLoadingMore(false); }
  }

  const everyRow = useMemo(() => [...rows.product, ...rows.page, ...rows.post], [rows]);
  const visible = useMemo(() => rows[kind].filter((row) => !onlyWork || needsWork(row)), [rows, kind, onlyWork]);
  const counts = useMemo(() => ({ product: [...edits.keys()].filter((key) => key.startsWith("product:")).length, page: [...edits.keys()].filter((key) => key.startsWith("page:")).length, post: [...edits.keys()].filter((key) => key.startsWith("post:")).length }), [edits]);
  const blocked = useMemo(() => everyRow.filter((row) => edits.has(row.key) && Object.keys(bulkProblems(edits.get(row.key)!)).length > 0).length, [everyRow, edits]);

  async function save() {
    if (!content || !storeId) return;
    if (blocked > 0) { toast(`${blocked} ${blocked === 1 ? "row has" : "rows have"} text that is too long. Fix ${blocked === 1 ? "it" : "them"} first.`, { tone: "critical" }); return; }
    setSaving(true);
    const failed: string[] = [];
    let saved = 0;
    for (const row of everyRow) {
      const value = edits.get(row.key);
      if (!value) continue;
      try {
        const patch = toPatch(value);
        if (row.kind === "product") await request(`/products/${encodeURIComponent(row.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
        else if (row.kind === "page") await content.updatePage(storeId, row.id, patch);
        else await content.updateArticle(storeId, row.id, patch);
        saved += 1;
        // The saved values become the new baseline for the row.
        setRows((current) => ({ ...current, [row.kind]: current[row.kind].map((item) => item.key === row.key ? { ...item, seoTitle: patch.seoTitle ?? "", seoDescription: patch.seoDescription ?? "" } : item) }));
        setEdits((current) => { const next = new Map(current); next.delete(row.key); return next; });
      } catch (failure) {
        failed.push(`${row.name}: ${failure instanceof Error ? failure.message : "could not save"}`);
      }
    }
    setSaving(false);
    if (saved) toast(`${saved} ${saved === 1 ? "item" : "items"} saved`);
    if (failed.length) toast(`${failed.length} could not be saved. ${failed[0]}`, { tone: "critical" });
  }

  const tabs = (["product", "page", "post"] as BulkKind[]).map((id) => ({ id, label: KIND_LABEL[id], count: counts[id] || undefined }));
  return <AdminPage title="Bulk SEO editor" width="full" back={{ href: "/admin/settings/preferences/advanced", label: "Site preferences" }}
    description="Write the search title and description for many products, pages and posts on one screen. Nothing is saved until you press Save.">
    <Banner tone="info">Search results show these instead of the page&apos;s own name and text. Leave a box empty to use the default shown in grey. Counters show Google&apos;s usual limits ({TITLE_MAX} characters for titles, {DESCRIPTION_MAX} for descriptions).</Banner>
    <div className="jk-toolbar">
      <Tabs label="What to edit" tabs={tabs} active={kind} onChange={(id) => setKind(id as BulkKind)} />
      <div className="jk-row">
        <label className="sr-only" htmlFor="bulk-seo-search">Search {KIND_LABEL[kind].toLowerCase()}</label>
        <input id="bulk-seo-search" type="search" className="jk-input" placeholder={`Search ${KIND_LABEL[kind].toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} />
        <label className="jk-check"><input type="checkbox" checked={onlyWork} onChange={(event) => setOnlyWork(event.target.checked)} /><span>Only show ones that need work</span></label>
      </div>
    </div>
    {error ? <Banner tone="critical" title="The list didn't load" action={<Button onClick={() => setTick((value) => value + 1)}>Try again</Button>}>{error}</Banner>
      : loading && !more[kind].loaded ? <TableSkeleton rows={6} columns={3} label={`Loading ${KIND_LABEL[kind].toLowerCase()}`} />
        : visible.length === 0 ? <EmptyState title={onlyWork ? "Nothing needs work here" : `No ${KIND_LABEL[kind].toLowerCase()} found`} description={onlyWork ? "Every item listed has a description. Untick the box to see them all." : search ? "Try a different search." : `Add some ${KIND_LABEL[kind].toLowerCase()} first.`} />
          : <div className="jk-table-scroll"><table className="jk-table jk-bulk-table">
            <caption className="sr-only">Search titles and descriptions for {KIND_LABEL[kind].toLowerCase()}</caption>
            <thead><tr><th scope="col">{KIND_LABEL[kind].slice(0, -1)}</th><th scope="col">Search title</th><th scope="col">Search description</th></tr></thead>
            <tbody>{visible.map((row) => <SeoRow key={row.key} row={row} value={currentValue(row, edits)} onChange={(patch) => setEdits((current) => withEdit(current, row, patch))} />)}</tbody>
          </table></div>}
    {more[kind].next !== null && !error && <div className="jk-row"><Button onClick={() => void loadMore()} loading={loading} loadingLabel="Loading…">Load more</Button></div>}
    <SaveBar dirty={edits.size > 0} saving={saving} onSave={() => void save()} onDiscard={() => setEdits(new Map())} saveLabel={edits.size ? `Save ${edits.size} ${edits.size === 1 ? "change" : "changes"}` : "Save"} />
  </AdminPage>;
}
