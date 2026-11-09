"use client";

import { useEffect, useMemo, useState } from "react";
import { Newspaper } from "lucide-react";
import { AdminPage, Banner, Card, EmptyState, Field, SelectList, SplitLayout, StatusBadge } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { createContentApi, type ArticleResource, type BlogResource, type ContentTemplate, type TemplateAssignment } from "@/features/content/api/client";
import { ResourceForm } from "@/features/content/components/resource-form";

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
  // The store's files, for choosing a social sharing image.
  const mediaApi = useMemo(() => token ? createStoreEditorApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token }) : null, [token]);
  const listImages = mediaApi?.listMedia && storeId ? () => mediaApi.listMedia!(storeId) : undefined;
  const [blogs, setBlogs] = useState<BlogResource[]>([]);
  const [articles, setArticles] = useState<ArticleResource[]>([]);
  const [articleTemplates, setArticleTemplates] = useState<ContentTemplate[]>([]);
  const [activeBlogId, setActiveBlogId] = useState("");
  const [activeArticleId, setActiveArticleId] = useState("");
  const [assignment, setAssignment] = useState<TemplateAssignment | null>(null);
  const [title, setTitle] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!api) return;
    let active = true;
    void Promise.all([api.listBlogs(storeId), api.listTemplates(storeId, "article")]).then(([nextBlogs, nextTemplates]) => {
      if (!active) return;
      setBlogs(nextBlogs);
      setArticleTemplates(nextTemplates);
      setActiveBlogId((current) => current || nextBlogs[0]?.id || "");
    }).catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load blogs"))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!api || !activeBlogId) {
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
      return;
    }
    let active = true;
    void api.getAssignment(storeId, "article", activeArticleId)
      .then((value) => { if (active) setAssignment(value); })
      .catch(() => { if (active) setAssignment(null); });
    return () => { active = false; };
  }, [api, activeArticleId]);

  const article = articles.find((entry) => entry.id === activeArticleId);

  if (!api) return <AdminPage title="Blog posts"><Banner tone="warning">Sign in to manage your blog.</Banner></AdminPage>;

  const createBlog = (
    <form className="jk-stack-sm" onSubmit={(event) => {
      event.preventDefault();
      if (!title.trim() || !handle.trim()) return;
      void api.createBlog(storeId, { title, handle }).then((blog) => {
        setBlogs((current) => [...current, blog]);
        setActiveBlogId(blog.id);
        setTitle("");
        setHandle("");
      }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to create blog"));
    }}>
      <h3 className="jk-subheading">Add a blog</h3>
      <Field id="blog-title" label="Blog name"><input id="blog-title" aria-label="Blog title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="News" /></Field>
      <Field id="blog-handle" label="Web address" help="Lowercase letters, numbers and hyphens."><input id="blog-handle" aria-label="Blog handle" value={handle} onChange={(event) => setHandle(event.target.value)} placeholder="news" /></Field>
      <button type="submit" className="jk-button">Add blog</button>
    </form>
  );

  return (
    <AdminPage title="Blog posts" description="Your blogs and the posts in them. Write the post itself in the store designer.">
      {error && <Banner tone="critical" title="Something went wrong" onDismiss={() => setError(undefined)}>{error}</Banner>}
      <SplitLayout list={<SelectList label="Blogs" title="Blogs" loading={loading} selectedId={activeBlogId} onSelect={setActiveBlogId}
        items={blogs.map((blog) => ({ id: blog.id, label: blog.title, sub: `/blogs/${blog.handle}` }))} empty="No blogs yet." footer={createBlog} />}>
        <SelectList label="Posts" title="Posts" selectedId={activeArticleId} onSelect={setActiveArticleId}
          items={articles.map((entry) => ({ id: entry.id, label: entry.title, badge: <StatusBadge kind="content" value={entry.status ?? "DRAFT"} /> }))}
          empty={activeBlogId ? "No posts in this blog yet." : "Choose a blog to see its posts."} />
        {article ? (
          <>
            <Card title="Visibility" actions={<button
              type="button"
              onClick={() => {
                const action = article.status === "PUBLISHED" ? api.unpublishArticle(storeId, article.id) : api.publishArticle(storeId, article.id);
                void action.then((saved) => setArticles((current) => current.map((entry) => entry.id === saved.id ? saved : entry)));
              }}
              className={`jk-button ${article.status === "PUBLISHED" ? "" : "jk-button-primary"}`}
            >
              {article.status === "PUBLISHED" ? "Unpublish" : "Publish"}
            </button>}>
              <div className="jk-row"><StatusBadge kind="content" value={article.status ?? "DRAFT"} /><span className="jk-muted">{article.status === "PUBLISHED" ? "Shoppers can read this post." : "Only you can see this post."}</span></div>
            </Card>
            <ResourceForm
              key={`${article.id}:${assignment?.revision ?? "new"}:${assignment?.templateId ?? "default"}`}
              listImages={listImages} storeSlug={activeStore?.slug} pathPrefix="/blogs/"
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
        ) : articles.length > 0 && <Card><EmptyState icon={Newspaper} title="Choose a post" description="Pick a post above to edit its title, search listing and layout." /></Card>}
      </SplitLayout>
    </AdminPage>
  );
}
