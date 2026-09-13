"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemoSession } from "@/features/store-editor/api/demo-session";
import { createContentApi, type ArticleResource, type BlogResource } from "@/features/content/api";

const storeId = "store-demo";

export default function BlogsAdminPage() {
  const token = getDemoSession()?.token;
  const api = useMemo(() => token ? createContentApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
  }) : null, [token]);
  const [blogs, setBlogs] = useState<BlogResource[]>([]);
  const [articles, setArticles] = useState<ArticleResource[]>([]);
  const [activeBlogId, setActiveBlogId] = useState("");
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!api) return;
    let active = true;
    void api.listBlogs(storeId).then((next) => {
      if (!active) return;
      setBlogs(next);
      setActiveBlogId((current) => current || next[0]?.id || "");
    }).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load blogs"));
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!api || !activeBlogId) {
      setArticles([]);
      return;
    }
    let active = true;
    void api.listArticles(storeId, activeBlogId).then((next) => { if (active) setArticles(next); }).catch(() => { if (active) setArticles([]); });
    return () => { active = false; };
  }, [api, activeBlogId]);

  if (!api) return <main className="p-8">Blog manager is unavailable until merchant authentication is connected.</main>;

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" aria-label="Back to admin" className="grid size-9 place-items-center rounded-lg border border-[#d7d7d7] bg-white"><ArrowLeft size={16} /></Link>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">Content</p><h1 className="text-2xl font-semibold tracking-[-0.03em]">Blogs & articles</h1></div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
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
            {articles.map((article) => (
              <div key={article.id} className="flex min-h-12 items-center gap-3 px-4"><span className="min-w-0 flex-1 truncate text-[12px] font-medium">{article.title}</span><span className="text-[10px] uppercase text-[#8c9196]">{article.status ?? "DRAFT"}</span></div>
            ))}
            {articles.length === 0 && <p className="p-8 text-center text-sm text-[#8c9196]">No articles in this blog yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
