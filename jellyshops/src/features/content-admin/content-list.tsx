"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, FileText } from "lucide-react";
import Link from "@/features/admin/admin-routing";
import { AdminPage, Banner, Button, ConfirmDialog, EmptyState, IndexTable, StatusBadge, useToast, type BulkAction, type IndexColumn, type IndexTab } from "@/components/admin";
import type { ArticleResource, BlogResource, BulkAction as ApiBulkAction, ContentListQuery, ContentListResult, ContentSort } from "@/features/content/api/client";
import { BlogsDialog } from "./blogs-dialog";
import { KIND, STATE_BADGE, contentState, problem, scheduleLabel, useContentApi, whenLabel, type ContentItem, type ContentKind } from "./shared";

const PAGE_SIZE = 25;
const TABS: Array<{ id: NonNullable<ContentListQuery["state"]>; label: string }> = [
  { id: "active", label: "All" }, { id: "published", label: "Published" }, { id: "draft", label: "Drafts" },
  { id: "scheduled", label: "Scheduled" }, { id: "archived", label: "Archived" },
];
const SORTS: Array<{ value: string; label: string }> = [
  { value: "updated:desc", label: "Last changed" }, { value: "created:desc", label: "Newest first" },
  { value: "title:asc", label: "Title A–Z" }, { value: "title:desc", label: "Title Z–A" }, { value: "published:desc", label: "Publish date" },
];

interface Filters { author: string; tag: string; blogId: string; updatedFrom: string; updatedTo: string }
const NO_FILTERS: Filters = { author: "", tag: "", blogId: "", updatedFrom: "", updatedTo: "" };

function Select({ label, value, onChange, all, options }: { label: string; value: string; onChange: (value: string) => void; all: string; options: Array<{ value: string; label: string }> }) {
  if (!options.length) return null;
  return (
    <label><span className="sr-only">{label}</span>
      <select className="jk-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{all}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

/** The list of pages or blog posts: tabs by status, search, filters, sorting, paging and bulk actions. */
export function ContentList({ kind }: { kind: ContentKind }) {
  const words = KIND[kind];
  const toast = useToast();
  const { api, storeId } = useContentApi();
  const [state, setState] = useState<NonNullable<ContentListQuery["state"]>>("active");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("updated:desc");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<ContentListResult<ContentItem> | null>(null);
  const [blogs, setBlogs] = useState<BlogResource[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [blogsOpen, setBlogsOpen] = useState(false);

  // Search waits for a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => { setQuery(search.trim()); setOffset(0); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const [blogsVersion, setBlogsVersion] = useState(0);
  const loadBlogs = useCallback(() => setBlogsVersion((count) => count + 1), []);
  useEffect(() => {
    if (!api || kind !== "post") return;
    let active = true;
    // The list still works without blog names if this fails.
    api.listBlogs(storeId).then((next) => { if (active) setBlogs(next); }).catch(() => undefined);
    return () => { active = false; };
  }, [api, kind, storeId, blogsVersion]);

  useEffect(() => {
    if (!api) return;
    let active = true;
    const [sortKey, direction] = sort.split(":") as [ContentSort, "asc" | "desc"];
    const request: ContentListQuery = { q: query, state, sort: sortKey, direction, limit: PAGE_SIZE, offset, ...filters };
    const load = kind === "page" ? api.browsePages(storeId, request) : api.browseArticles(storeId, request);
    load.then((next) => { if (active) { setResult(next as ContentListResult<ContentItem>); setError(""); } })
      .catch((reason: unknown) => { if (active) setError(problem(reason, `Your ${words.plural} could not be loaded.`)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, storeId, kind, query, state, sort, offset, filters, attempt, words.plural]);

  const reload = () => setAttempt((count) => count + 1);
  const blogName = useMemo(() => new Map(blogs.map((blog) => [blog.id, blog.title])), [blogs]);
  const editHref = (item: ContentItem) => `${words.listPath}/${encodeURIComponent(item.id)}`;

  async function runBulk(action: ApiBulkAction, ids: string[], done: string) {
    if (!api) return;
    try {
      const outcome = kind === "page" ? await api.bulkPages(storeId, action, ids) : await api.bulkArticles(storeId, action, ids);
      reload();
      if (outcome.failed.length) toast(`${outcome.done.length} done. ${outcome.failed.length} could not be changed: ${outcome.failed[0]!.message}`, { tone: "critical" });
      else {
        const count = outcome.done.length;
        const label = `${count} ${count === 1 ? words.singular : words.plural} ${done}`;
        // Archiving is the safe "delete": offer to take it back straight away.
        toast(label, action === "archive" ? { action: { label: "Undo", onAction: () => void runBulk("restore", outcome.done, "restored") } } : undefined);
      }
    } catch (reason) {
      toast(problem(reason), { tone: "critical" });
    }
  }

  const bulkActions: BulkAction[] = state === "archived"
    ? [
      { label: "Restore", onAction: (ids) => runBulk("restore", ids, "restored") },
      { label: "Delete for good", destructive: true, onAction: (ids) => { setConfirmDelete(ids); } },
    ]
    : [
      { label: "Publish", onAction: (ids) => runBulk("publish", ids, "published") },
      { label: "Unpublish", onAction: (ids) => runBulk("unpublish", ids, "unpublished") },
      { label: "Archive", destructive: true, onAction: (ids) => runBulk("archive", ids, "archived") },
    ];

  const columns: IndexColumn<ContentItem>[] = [
    {
      id: "title", header: "Title", mobile: "primary", sortKey: "title",
      cell: (item) => (
        <div className="min-w-0">
          <Link href={editHref(item)} className="jca-title-link">{item.title || "Untitled"}</Link>
          <p className="jk-cell-sub">{kind === "post" ? blogName.get((item as ArticleResource).blogId) ?? "Blog" : `/pages/${item.handle}`}</p>
        </div>
      ),
    },
    {
      id: "status", header: "Status", mobile: "show",
      cell: (item) => {
        const current = contentState(item);
        return <span className="jca-stack-xs"><StatusBadge kind="content" value={STATE_BADGE[current]} />{current === "scheduled" && <span className="jk-cell-sub">{scheduleLabel(item.scheduledAt)}</span>}</span>;
      },
    },
    { id: "author", header: "Author", mobile: "hidden", cell: (item) => item.authorName ? <span>{item.authorName}</span> : <span className="jk-muted">—</span> },
    ...(kind === "post" ? [{ id: "tags", header: "Tags", mobile: "hidden" as const, defaultHidden: false, cell: (item: ContentItem) => {
      const tags = (item as ArticleResource).tags ?? [];
      return tags.length ? <span className="jk-cell-sub">{tags.slice(0, 3).join(", ")}{tags.length > 3 ? ` +${tags.length - 3}` : ""}</span> : <span className="jk-muted">—</span>;
    } }] : []),
    { id: "updated", header: "Last changed", mobile: "show", sortKey: "updated", align: "end", cell: (item) => <span className="jk-cell-sub" title={item.updatedAt ? new Date(item.updatedAt).toLocaleString("en-GB") : undefined}>{whenLabel(item.updatedAt)}</span> },
  ];

  const tabs: IndexTab[] = TABS.map((tab) => ({ id: tab.id, label: tab.label, count: result?.counts[tab.id] }));
  const facets = result?.facets ?? { authors: [], tags: [] };
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const totalEver = result?.counts.all ?? 0;
  const [sortKey, sortDirection] = sort.split(":") as [string, "asc" | "desc"];

  if (!api) return <AdminPage title={words.title}><Banner tone="warning">Sign in to manage your {words.plural}.</Banner></AdminPage>;

  const empty = totalEver === 0 && !query && !activeFilters
    ? <EmptyState icon={kind === "page" ? FileText : BookOpen} title={words.emptyTitle} description={words.emptyText}
      action={<Link href={`${words.listPath}/new`} className="jk-button jk-button-primary">{words.add}</Link>} />
    : <EmptyState icon={kind === "page" ? FileText : BookOpen} title={state === "archived" ? "Nothing archived" : `No ${words.plural} match`}
      description={state === "archived" ? `Archived ${words.plural} are hidden from shoppers and can be restored here.` : "Try other words or clear the filters."}
      action={activeFilters || query ? <Button onClick={() => { setFilters(NO_FILTERS); setSearch(""); }}>Clear search and filters</Button> : undefined} />;

  return (
    <AdminPage title={words.title} description={words.description}
      primaryAction={{ label: words.add, href: `${words.listPath}/new` }}
      secondaryActions={kind === "post" ? [{ label: "Manage blogs", onAction: () => setBlogsOpen(true) }] : []}>
      <IndexTable<ContentItem>
        label={words.title}
        rows={result?.items ?? []}
        rowKey={(item) => item.id}
        rowLabel={(item) => item.title || "Untitled"}
        columns={columns}
        loading={loading && !result}
        error={error || undefined}
        onRetry={() => { setError(""); setLoading(true); reload(); }}
        tabs={tabs}
        activeTab={state}
        onTabChange={(id) => { setState(id as typeof state); setOffset(0); }}
        search={{ value: search, onChange: setSearch, placeholder: `Search ${words.plural} by title, address, author${kind === "post" ? " or tag" : ""}`, label: `Search ${words.plural}` }}
        sort={{ key: sortKey, direction: sortDirection, onChange: (key, direction) => { setSort(`${key}:${direction}`); setOffset(0); } }}
        filters={<>
          <label><span className="sr-only">Sort</span>
            <select className="jk-select" value={sort} onChange={(event) => { setSort(event.target.value); setOffset(0); }}>
              {SORTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {kind === "post" && <Select label="Blog" all="All blogs" value={filters.blogId} onChange={(blogId) => { setFilters({ ...filters, blogId }); setOffset(0); }} options={blogs.map((blog) => ({ value: blog.id, label: blog.title }))} />}
        </>}
        moreFilters={<div className="jca-filter-grid">
          <Select label="Author" all="Any author" value={filters.author} onChange={(author) => { setFilters({ ...filters, author }); setOffset(0); }} options={facets.authors.map((author) => ({ value: author.id, label: author.name }))} />
          {kind === "post" && <Select label="Tag" all="Any tag" value={filters.tag} onChange={(tag) => { setFilters({ ...filters, tag }); setOffset(0); }} options={facets.tags.map((tag) => ({ value: tag, label: tag }))} />}
          <label className="jk-field"><span>Changed from</span><input type="date" value={filters.updatedFrom} max={filters.updatedTo || undefined} onChange={(event) => { setFilters({ ...filters, updatedFrom: event.target.value }); setOffset(0); }} /></label>
          <label className="jk-field"><span>Changed until</span><input type="date" value={filters.updatedTo} min={filters.updatedFrom || undefined} onChange={(event) => { setFilters({ ...filters, updatedTo: event.target.value }); setOffset(0); }} /></label>
          {activeFilters > 0 && <Button variant="quiet" onClick={() => { setFilters(NO_FILTERS); setOffset(0); }}>Clear filters</Button>}
        </div>}
        moreFiltersActive={filters.author || filters.tag || filters.updatedFrom || filters.updatedTo ? [filters.author, filters.tag, filters.updatedFrom, filters.updatedTo].filter(Boolean).length : 0}
        bulkActions={bulkActions}
        emptyState={empty}
        pagination={result && result.total > PAGE_SIZE ? {
          summary: `${offset + 1}–${Math.min(offset + PAGE_SIZE, result.total)} of ${result.total}`,
          hasPrevious: offset > 0, hasNext: offset + PAGE_SIZE < result.total,
          onPrevious: () => setOffset(Math.max(0, offset - PAGE_SIZE)), onNext: () => setOffset(offset + PAGE_SIZE),
        } : undefined}
      />
      <ConfirmDialog open={confirmDelete !== null} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={`Delete ${confirmDelete?.length ?? 0} ${confirmDelete?.length === 1 ? words.singular : words.plural} for good?`}
        description={`This removes ${confirmDelete?.length === 1 ? "it" : "them"} and ${confirmDelete?.length === 1 ? "its" : "their"} old web addresses. It can't be undone.`}
        confirmLabel="Delete for good" destructive
        onConfirm={async () => { if (confirmDelete) await runBulk("delete", confirmDelete, "deleted"); setConfirmDelete(null); }} />
      {kind === "post" && <BlogsDialog open={blogsOpen} onOpenChange={setBlogsOpen} blogs={blogs} onChanged={() => { loadBlogs(); reload(); }} />}
    </AdminPage>
  );
}
