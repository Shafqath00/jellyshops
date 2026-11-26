"use client";

import "./content-admin.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminRouter, useShopAdminHref } from "@/features/admin/admin-routing";
import { AdminPage, Banner, Button, Card, CardSkeleton, ConfirmDialog, Field, StatusBadge, useToast, type PageAction } from "@/components/admin";
import { storeUrl, type RichTextDocument } from "@jelly/storefront-schema";
import type { ArticleResource, BlogResource, ContentTemplate, HandleCheck, PageResource, TemplateAssignment } from "@/features/content/api/client";
import { ContentEditor } from "@/features/content-editor/content-editor";
import { useAutosave } from "@/features/content-editor/use-autosave";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { BlogsDialog } from "./blogs-dialog";
import { blankContent, changesBetween, contentProblems, editableFrom, type EditableContent } from "./editable";
import { BlogCard, ExcerptCard, FeaturedImageCard, NavigationCard, OrganisationCard, SearchListingCard, StatusCard, TemplateCard } from "./editor-sidebar";
import { PreviewDialog } from "./preview-dialog";
import { KIND, STATE_BADGE, contentState, problem, useContentApi, whenLabel, type ContentItem, type ContentKind } from "./shared";

/** A title as a web address ending, the same way the server makes one. */
export function slugify(value: string): string {
  return value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100).replace(/-+$/g, "");
}

interface Loaded { item: ContentItem | null; blogs: BlogResource[]; templates: ContentTemplate[]; assignment: TemplateAssignment | null; knownTags: string[] }

/** The full-page editor for one page or blog post (`id` null = a new one). Loads, then hands over to the form. */
export function ContentItemEditor({ kind, id }: { kind: ContentKind; id: string | null }) {
  const words = KIND[kind];
  const { api, storeId } = useContentApi();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!api || !storeId) return;
    let active = true;
    const templateType = kind === "page" ? "page" : "article";
    Promise.all([
      id ? (kind === "page" ? api.getPage(storeId, id) : api.getArticle(storeId, id)) : Promise.resolve(null),
      kind === "post" ? api.listBlogs(storeId) : Promise.resolve([]),
      api.listTemplates(storeId, templateType).catch(() => []),
      id ? api.getAssignment(storeId, templateType, id).catch(() => null) : Promise.resolve(null),
      kind === "post" ? api.browseArticles(storeId, { limit: 1, state: "all" }).then((result) => result.facets?.tags ?? []).catch(() => []) : Promise.resolve([]),
    ]).then(([item, blogs, templates, assignment, knownTags]) => {
      if (active) { setLoaded({ item: item as ContentItem | null, blogs, templates, assignment, knownTags }); setError(""); }
    }).catch((reason: unknown) => { if (active) setError(problem(reason, `This ${words.singular} could not be loaded.`)); });
    return () => { active = false; };
  }, [api, storeId, kind, id, attempt, words.singular]);

  if (!api) return <AdminPage title={words.title}><Banner tone="warning">Sign in to edit your {words.plural}.</Banner></AdminPage>;
  if (error) {
    return (
      <AdminPage title={id ? `Edit ${words.singular}` : words.add} back={{ href: words.listPath, label: words.title }}>
        <Banner tone="critical" title={`The ${words.singular} did not load`} action={<Button size="small" onClick={() => { setError(""); setAttempt((count) => count + 1); }}>Try again</Button>}>{error}</Banner>
      </AdminPage>
    );
  }
  if (!loaded) {
    return (
      <AdminPage title={id ? `Edit ${words.singular}` : words.add} back={{ href: words.listPath, label: words.title }}>
        <div className="jk-detail" aria-busy="true"><div className="jk-detail-main"><CardSkeleton /><CardSkeleton /></div><div className="jk-detail-side"><CardSkeleton /></div></div>
      </AdminPage>
    );
  }
  return <EditorForm key={loaded.item?.id ?? "new"} kind={kind} loaded={loaded} onBlogsChanged={async () => {
    const blogs = await api.listBlogs(storeId).catch(() => loaded.blogs);
    setLoaded((current) => current ? { ...current, blogs } : current);
  }} />;
}

function EditorForm({ kind, loaded, onBlogsChanged }: { kind: ContentKind; loaded: Loaded; onBlogsChanged: () => Promise<void> }) {
  const words = KIND[kind];
  const { api: maybeApi, storeId, storeSlug, media, listImages } = useContentApi();
  const api = maybeApi!;
  const { session } = useAuth();
  const router = useAdminRouter();
  const adminHref = useShopAdminHref();
  const toast = useToast();
  const defaultAuthor = session?.user?.user_metadata?.full_name ?? session?.user?.email?.split("@")[0] ?? "";

  const initial = useMemo(() => loaded.item ? editableFrom(loaded.item) : blankContent(loaded.blogs[0]?.id ?? "", defaultAuthor), [loaded.item, loaded.blogs, defaultAuthor]);
  const [record, setRecord] = useState<ContentItem | null>(loaded.item);
  const [value, setValue] = useState<EditableContent>(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [handleTouched, setHandleTouched] = useState(Boolean(loaded.item));
  const [handleCheck, setHandleCheck] = useState<HandleCheck | null>(null);
  const [assignment, setAssignment] = useState(loaded.assignment);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [blogsOpen, setBlogsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const serverValue = useRef<EditableContent>(initial);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; });

  const state = record ? contentState(record) : "draft";
  const live = state === "published";
  const isNew = !record;
  const problems = contentProblems(value, kind);
  const blog = loaded.blogs.find((entry) => entry.id === value.blogId);

  const persist = useCallback(async (next: EditableContent) => {
    if (!record) return;
    const nextProblems = contentProblems(next, kind);
    const first = nextProblems.title ?? nextProblems.handle ?? nextProblems.blogId;
    if (first) throw new Error(first);
    const patch = changesBetween(kind, serverValue.current, next);
    if (!Object.keys(patch).length) return;
    const saved = kind === "page" ? await api.updatePage(storeId, record.id, patch) : await api.updateArticle(storeId, record.id, patch);
    serverValue.current = next;
    setRecord(saved);
  }, [api, kind, record, storeId]);

  // Drafts save themselves; a live page keeps changes on this device until Save, so half-typed text never goes live.
  const autosave = useAutosave<EditableContent>({
    key: `jelly-content:${storeId}:${kind}:${record?.id ?? "new"}`,
    saved: initial,
    save: persist,
    enabled: !live && !isNew,
  });

  /** The first save of a new item: as soon as it has a title (and, for a post, a blog). The address then changes to the item's own. */
  const createTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const create = useCallback(async () => {
    const current = valueRef.current;
    if (record || creating || contentProblems(current, kind).title || (kind === "post" && !current.blogId)) return;
    setCreating(true); setCreateError("");
    try {
      const common = {
        title: current.title.trim(), handle: current.handle || undefined, content: current.content as unknown as Record<string, unknown>,
        authorName: current.authorName.trim() || null, seoTitle: current.seoTitle, seoDescription: current.seoDescription,
        socialMediaId: current.socialMediaId, noindex: current.noindex, canonicalOverride: current.canonicalOverride, featuredMediaId: current.featuredMediaId,
      };
      const created: ContentItem = kind === "page"
        ? await api.createPage(storeId, { ...common, showInNavigation: current.showInNavigation })
        : await api.createArticle(storeId, { ...common, blogId: current.blogId, excerpt: current.excerpt, tags: current.tags });
      serverValue.current = { ...current, handle: created.handle };
      setRecord(created);
      setValue((latest) => ({ ...latest, handle: latest.handle || created.handle }));
      // Keeps this form (and anything typed meanwhile) while the address becomes the item's own.
      window.history.replaceState(window.history.state, "", adminHref(`${words.listPath}/${encodeURIComponent(created.id)}`));
      toast(`${kind === "page" ? "Page" : "Post"} saved as a draft`);
    } catch (reason) {
      setCreateError(problem(reason));
    } finally {
      setCreating(false);
    }
  }, [adminHref, api, creating, kind, record, storeId, toast, words.listPath]);

  // Once created, anything typed while the first save ran is saved like any other change.
  useEffect(() => {
    if (record && JSON.stringify(valueRef.current) !== JSON.stringify(serverValue.current)) autosave.change(valueRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  const change = useCallback((patch: Partial<EditableContent>) => {
    const next = { ...valueRef.current, ...patch };
    if (patch.title !== undefined && !handleTouched && !record) next.handle = slugify(patch.title);
    valueRef.current = next;
    setValue(next);
    if (record) autosave.change(next);
    else {
      if (createTimer.current) clearTimeout(createTimer.current);
      createTimer.current = setTimeout(() => { void create(); }, 800);
    }
    if (patch.handle !== undefined && patch.title === undefined) setHandleTouched(true);
  }, [autosave, create, handleTouched, record]);

  useEffect(() => () => { if (createTimer.current) clearTimeout(createTimer.current); }, []);

  // A post with no blog yet takes the first one as soon as there is one (e.g. right after adding a blog here).
  const firstBlogId = loaded.blogs[0]?.id;
  useEffect(() => {
    if (kind === "post" && firstBlogId && !valueRef.current.blogId) change({ blogId: firstBlogId });
  }, [change, firstBlogId, kind]);

  // Is the web address free? Checked after a pause in typing, only when it differs from the saved one.
  useEffect(() => {
    const handle = value.handle;
    if (!handle || handle === serverValue.current.handle || problems.handle) return;
    const timer = setTimeout(() => {
      const check = kind === "page" ? api.checkPageHandle(storeId, handle, record?.id) : value.blogId ? api.checkArticleHandle(storeId, value.blogId, handle, record?.id) : null;
      void check?.then(setHandleCheck).catch(() => undefined);
    }, 400);
    return () => clearTimeout(timer);
  }, [api, kind, problems.handle, record?.id, storeId, value.blogId, value.handle]);

  // Ctrl/Cmd+S saves now.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveNow(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  async function saveNow(): Promise<boolean> {
    if (!record) { await create(); return true; }
    const ok = await autosave.flush();
    if (ok && live) toast("Changes are live on your store");
    return ok;
  }

  async function lifecycle(run: () => Promise<ContentItem>, done: string, options?: { undo?: () => Promise<ContentItem> }) {
    setBusy(true);
    try {
      if (!(await autosave.flush())) { setBusy(false); return; }
      const next = await run();
      setRecord(next);
      autosave.reset(valueRef.current);
      serverValue.current = valueRef.current;
      toast(done, options?.undo ? { action: { label: "Undo archive", onAction: () => void options.undo!().then(setRecord).catch((reason) => toast(problem(reason), { tone: "critical" })) } } : undefined);
    } catch (reason) {
      toast(problem(reason), { tone: "critical" });
    } finally {
      setBusy(false);
    }
  }

  const id = record?.id ?? "";
  const publish = () => lifecycle(() => kind === "page" ? api.publishPage(storeId, id) : api.publishArticle(storeId, id), `${kind === "page" ? "Page" : "Post"} published`);
  const unpublish = () => lifecycle(() => kind === "page" ? api.unpublishPage(storeId, id) : api.unpublishArticle(storeId, id), "Unpublished: shoppers can't see it now");
  const schedule = (at: string) => lifecycle(() => kind === "page" ? api.schedulePage(storeId, id, at) : api.scheduleArticle(storeId, id, at), "Scheduled");
  const cancelSchedule = () => lifecycle(() => kind === "page" ? api.updatePage(storeId, id, { scheduledAt: null }) : api.updateArticle(storeId, id, { scheduledAt: null }), "Schedule cancelled");
  const restore = () => lifecycle(() => kind === "page" ? api.restorePage(storeId, id) : api.restoreArticle(storeId, id), "Restored as a draft");
  const archive = () => lifecycle(() => kind === "page" ? api.archivePage(storeId, id) : api.archiveArticle(storeId, id), `${kind === "page" ? "Page" : "Post"} archived`,
    { undo: () => kind === "page" ? api.restorePage(storeId, id) : api.restoreArticle(storeId, id) });

  async function duplicate() {
    setBusy(true);
    try {
      await autosave.flush();
      const copy = kind === "page" ? await api.duplicatePage(storeId, id) : await api.duplicateArticle(storeId, id);
      toast(`Copy made: “${copy.title}”`);
      router.push(`${words.listPath}/${encodeURIComponent(copy.id)}`);
    } catch (reason) { toast(problem(reason), { tone: "critical" }); } finally { setBusy(false); }
  }

  async function deleteForGood() {
    if (kind === "page") await api.deletePage(storeId, id); else await api.deleteArticle(storeId, id);
    autosave.reset(valueRef.current);
    toast(`${kind === "page" ? "Page" : "Post"} deleted`);
    router.push(words.listPath);
  }

  function restoreRecovered() {
    const recovered = autosave.recovered;
    if (!recovered) return;
    setValue(recovered.value);
    setEditorKey((count) => count + 1);
    autosave.dismissRecovered();
    autosave.change(recovered.value);
  }

  const status = creating ? "saving" : autosave.status;
  const saveLabel = isNew
    ? (createError ? createError : problems.title ? "Not saved yet: add a title" : creating ? "Saving…" : "Not saved yet")
    : { saved: autosave.lastSavedAt ? `Saved ${whenLabel(new Date(autosave.lastSavedAt).toISOString()).toLowerCase()}` : "Saved", saving: "Saving…", unsaved: live ? "Unsaved changes" : "Saving soon…", error: autosave.error ?? "Not saved" }[status];
  const saveState = isNew ? (createError ? "error" : "unsaved") : status;
  const liveUrl = record && live ? storeUrl(storeSlug, kind === "page" ? `/pages/${record.handle}` : `/blogs/${blog?.handle ?? ""}/${record.handle}`) : null;

  const moreActions: PageAction[] = isNew ? [] : [
    ...(liveUrl ? [{ label: "View on your store", onAction: () => window.open(liveUrl, "_blank", "noopener") }] : []),
    { label: "Duplicate", onAction: () => void duplicate(), disabled: busy },
    ...(state === "archived"
      ? [{ label: "Delete for good", destructive: true, onAction: () => setConfirmDelete(true) }]
      : [{ label: "Archive", destructive: true, onAction: () => void archive(), disabled: busy }]),
  ];

  return (
    <AdminPage
      title={value.title.trim() || (isNew ? words.add : "Untitled")}
      back={{ href: words.listPath, label: words.title }}
      badges={<>
        {!isNew && <StatusBadge kind="content" value={STATE_BADGE[state]} />}
        <span className="jca-save-state" data-state={saveState} role="status" aria-live="polite"><span className="jca-dot" aria-hidden />{saveLabel}</span>
      </>}
      primaryAction={live
        ? { label: "Save", onAction: () => void saveNow(), disabled: status === "saved" || status === "saving" }
        : state === "archived" ? { label: "Restore", onAction: () => void restore(), disabled: busy }
          : { label: "Publish", onAction: () => void publish(), disabled: isNew || busy || Boolean(problems.title) }}
      secondaryActions={[{ label: "Preview", onAction: () => setPreviewOpen(true) }]}
      moreActions={moreActions}
    >
      {autosave.recovered && (
        <Banner tone="warning" title="You have changes that weren't saved"
          action={<div className="jca-actions"><Button size="small" variant="primary" onClick={restoreRecovered}>Restore them</Button><Button size="small" variant="quiet" onClick={autosave.dismissRecovered}>Discard</Button></div>}>
          Kept on this device from {whenLabel(new Date(autosave.recovered.savedAt).toISOString()).toLowerCase()}.
        </Banner>
      )}
      {kind === "post" && !loaded.blogs.length && (
        <Banner tone="info" title="Add a blog first" action={<Button size="small" variant="primary" onClick={() => setBlogsOpen(true)}>Add a blog</Button>}>
          Posts live in a blog, such as News or Journal. Add one, then write your post.
        </Banner>
      )}
      <div className="jk-detail">
        <div className="jk-detail-main">
          <Card>
            <Field id="content-title" label="Title" required>
              <input id="content-title" className="jca-title-input" value={value.title} maxLength={255} placeholder={kind === "page" ? "e.g. Delivery and returns" : "e.g. How to choose a mattress"}
                onChange={(event) => change({ title: event.target.value })} autoFocus={!record} />
            </Field>
            {!isNew && problems.title && <p className="jk-field-error" role="alert">{problems.title}</p>}
          </Card>
          <ContentEditor key={editorKey} initialValue={value.content} onChange={(content) => change({ content })}
            label={kind === "page" ? "Page content" : "Post content"} media={media}
            importHtml={async (html) => (await api.importHtml(storeId, html)) as unknown as RichTextDocument} />
        </div>
        <div className="jk-detail-side">
          <StatusCard kind={kind} state={state} isNew={isNew} busy={busy} publishedAt={record?.publishedAt} scheduledAt={record?.scheduledAt}
            onPublish={() => void publish()} onUnpublish={() => void unpublish()} onSchedule={(at) => void schedule(at)} onCancelSchedule={() => void cancelSchedule()} onRestore={() => void restore()} />
          {kind === "post" && <BlogCard value={value.blogId} blogs={loaded.blogs} onChange={change} error={loaded.blogs.length ? problems.blogId : undefined} onManage={() => setBlogsOpen(true)} />}
          {kind === "post" && <ExcerptCard value={value.excerpt} onChange={change} />}
          {kind === "post" && <FeaturedImageCard value={value.featuredMediaId} onChange={change} listImages={listImages} />}
          <OrganisationCard kind={kind} value={value} onChange={change} knownTags={loaded.knownTags} />
          {kind === "page" && <NavigationCard value={value.showInNavigation} onChange={change} />}
          {record && <TemplateCard templates={loaded.templates} assignment={assignment}
            onAssign={async (templateId) => {
              const result = await api.assignTemplate(storeId, kind === "page" ? "page" : "article", record.id, templateId, assignment?.revision ?? null);
              setAssignment(result.assignment);
              toast("Layout changed. It shows on your store after you publish your store design.");
            }}
            onCustomise={(templateId) => window.location.assign(adminHref(`/admin/online-store/editor?templateId=${encodeURIComponent(templateId)}&resourceType=${kind === "page" ? "page" : "article"}&resourceId=${encodeURIComponent(record.id)}`))} />}
          <SearchListingCard kind={kind} value={value} onChange={change} storeSlug={storeSlug} blogHandle={blog?.handle} handleCheck={handleCheck} listImages={listImages} wasLive={Boolean(record?.publishedAt)} />
        </div>
      </div>
      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} storeSlug={storeSlug}
        draft={{ kind: kind === "page" ? "page" : "article", title: value.title, handle: value.handle, content: value.content as unknown as Record<string, unknown>, excerpt: value.excerpt, authorName: value.authorName || null, tags: value.tags, publishedAt: record?.publishedAt ?? null, ...(blog ? { blog: { id: blog.id, handle: blog.handle, title: blog.title } } : {}) }} />
      {kind === "post" && <BlogsDialog open={blogsOpen} onOpenChange={setBlogsOpen} blogs={loaded.blogs} onChanged={() => void onBlogsChanged()} />}
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete “${value.title || "Untitled"}” for good?`}
        description={`The ${words.singular} and its old web addresses are removed. This can't be undone.`} confirmLabel="Delete for good" destructive onConfirm={deleteForGood} />
    </AdminPage>
  );

}

export type { PageResource, ArticleResource };
