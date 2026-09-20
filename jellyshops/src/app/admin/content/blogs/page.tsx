"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { createContentApi, type ArticleResource, type BlogResource, type ContentTemplate, type TemplateAssignment } from "@/features/content/api";
import { ResourceForm } from "@/features/content/resource-form";



function editable(article: ArticleResource) {
  return {
    id: article.id,
    title: article.title,
    handle: article.handle,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    socialMediaId: article.socialMediaId,
    noindex: article.noindex,
    canonicalOverride: article.canonicalOverride,
  };
}

export default function BlogsAdminPage() {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id ?? "";
  const token = session?.access_token;
  const api = useMemo(() => (token && storeId) ? createContentApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
  }) : null, [token, storeId]);
  const [blogs, setBlogs] = useState<BlogResource[]>([]);
  const [articles, setArticles] = useState<ArticleResource[]>([]);
  const [articleTemplates, setArticleTemplates] = useState<ContentTemplate[]>([]);
  const [activeBlogId, setActiveBlogId] = useState("");
  const [activeArticleId, setActiveArticleId] = useState("");
  const [assignment, setAssignment] = useState<TemplateAssignment | null>(null);
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!api) return;
    let active = true;
    void Promise.all([api.listBlogs(storeId), api.listTemplates(storeId, "article")]).then(([nextBlogs, nextTemplates]) => {
      if (!active) return;
      setBlogs(nextBlogs);
      setArticleTemplates(nextTemplates);
      setActiveBlogId((current) => current || nextBlogs[0]?.id || "");
    }).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load blogs"));
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!api || !activeBlogId) {
      setArticles([]);
      setActiveArticleId("");
      return;
    }
    let active = true;
    void api.listArticles(storeId, activeBlogId).then((next) => {
      if (!active) return;
      setArticles(next);
      setActiveArticleId((current) => next.some((article) => article.id === current) ? current : next[0]?.id || "");
    }).catch(() => { if (active) setArticles([]); });
    return () => { active = false; };
  }, [api, activeBlogId]);

  useEffect(() => {
    if (!api || !activeArticleId) {
      setAssignment(null);
      return;
    }
    let active = true;
    void api.getAssignment(storeId, "article", activeArticleId)
      .then((value) => { if (active) setAssignment(value); })
      .catch(() => { if (active) setAssignment(null); });
    return () => { active = false; };
  }, [api, activeArticleId]);

  const article = articles.find((entry) => entry.id === activeArticleId);

  if (!api) return <main className="p-8">Blog manager is unavailable until merchant authentication is connected.</main>;

  return (
    <main className="mx-auto max-w-7xl p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" aria-label="Back to admin" className="grid size-9 place-items-center rounded-lg border border-[#d7d7d7] bg-white"><ArrowLeft size={16} /></Link>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">Content</p><h1 className="text-2xl font-semibold tracking-[-0.03em]">Blogs & articles</h1></div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 xl:grid-cols-[260px_280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-xl border border-[#e3e3e3] bg-white p-2">
            {blogs.map((blog) => (
              <button key={blog.id} type="button" onClick={() => setActiveBlogId(blog.id)} className={`min-h-10 w-full rounded-lg px-3 text-left text-[12px] font-medium ${blog.id === activeBlogId ? "bg-[#eeeeee]" : "hover:bg-[#f6f6f7]"}`}>{blog.title}</button>
            ))}
          </section>
          <form className="rounded-xl border border-[#e3e3e3] bg-white p-4" onSubmit={(event) => {
            event.preventDefault();
            if (!title.trim() || !handle.trim()) return;
            void api.createBlog(storeId, { title, handle }).then((blog) => {
              setBlogs((current) => [...current, blog]);
              setActiveBlogId(blog.id);
              setTitle("");
              setHandle("");
            }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to create blog"));
          }}>
            <h2 className="text-sm font-semibold">Create blog</h2>
            <input aria-label="Blog title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Blog title" className="mt-3 h-9 w-full rounded-lg border border-[#d7d7d7] px-3 text-[12px]" />
            <input aria-label="Blog handle" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="blog-handle" className="mt-2 h-9 w-full rounded-lg border border-[#d7d7d7] px-3 text-[12px]" />
            <button type="submit" className="mt-3 h-8 rounded-md bg-[#303030] px-3 text-[11px] font-semibold text-white">Create</button>
          </form>
        </aside>

        <section className="rounded-xl border border-[#e3e3e3] bg-white">
          <header className="border-b border-[#eeeeee] px-4 py-3"><h2 className="text-sm font-semibold">Articles</h2></header>
          <div className="divide-y divide-[#eeeeee]">
            {articles.map((entry) => (
              <button key={entry.id} type="button" onClick={() => setActiveArticleId(entry.id)} className={`flex min-h-12 w-full items-center gap-3 px-4 text-left ${entry.id === activeArticleId ? "bg-[#f6f6f7]" : "hover:bg-[#fafafa]"}`}><span className="min-w-0 flex-1 truncate text-[12px] font-medium">{entry.title}</span><span className="text-[10px] uppercase text-[#8c9196]">{entry.status ?? "DRAFT"}</span></button>
            ))}
            {articles.length === 0 && <p className="p-8 text-center text-sm text-[#8c9196]">No articles in this blog yet.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-[#e3e3e3] bg-white p-5">
          {article ? (
            <>
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-[#eeeeee] pb-4">
                <div><p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Article lifecycle</p><p className="mt-1 text-[12px] font-medium">{article.status ?? "DRAFT"}</p></div>
                <button
                  type="button"
                  onClick={() => {
                    const action = article.status === "PUBLISHED" ? api.unpublishArticle(storeId, article.id) : api.publishArticle(storeId, article.id);
                    void action.then((saved) => setArticles((current) => current.map((entry) => entry.id === saved.id ? saved : entry)));
                  }}
                  className="h-8 rounded-md border border-[#c9cccf] bg-white px-3 text-[11px] font-semibold"
                >
                  {article.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                </button>
              </div>
              <ResourceForm
                key={`${article.id}:${assignment?.revision ?? "new"}:${assignment?.templateId ?? "default"}`}
                resource={editable(article)}
                templates={articleTemplates.map(({ id, name }) => ({ id, name }))}
                assignedTemplateId={assignment?.templateId}
                onSave={async (value) => {
                  const saved = await api.updateArticle(storeId, article.id, {
                    title: value.title,
                    handle: value.handle,
                    seoTitle: value.seoTitle,
                    seoDescription: value.seoDescription,
                    socialMediaId: value.socialMediaId,
                    noindex: value.noindex,
                    canonicalOverride: value.canonicalOverride,
                  });
                  setArticles((current) => current.map((entry) => entry.id === saved.id ? saved : entry));
                }}
                onAssignTemplate={async ({ resourceId, templateId }) => {
                  const result = await api.assignTemplate(storeId, "article", resourceId, templateId, assignment?.revision ?? null);
                  setAssignment(result.assignment);
                }}
                onCustomizeTemplate={({ resourceId, templateId }) => {
                  window.location.assign(`/admin/online-store/editor?templateId=${encodeURIComponent(templateId)}&resourceType=article&resourceId=${encodeURIComponent(resourceId)}`);
                }}
              />
            </>
          ) : <p className="p-8 text-center text-sm text-[#8c9196]">Choose an article to edit.</p>}
        </section>
      </div>
    </main>
  );
}
