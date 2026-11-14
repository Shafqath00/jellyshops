"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { AdminPage, Banner, Button, Card, EmptyState, SelectList, SplitLayout, StatusBadge } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { createContentApi, type ContentTemplate, type PageResource, type TemplateAssignment } from "@/features/content/api/client";
import { ResourceForm } from "@/features/content/components/resource-form";

function editable(page: PageResource) {
  return {
    id: page.id,
    title: page.title,
    handle: page.handle,
    seoTitle: page.seoTitle,
    seoDescription: page.seoDescription,
    socialMediaId: page.socialMediaId,
    noindex: page.noindex,
    canonicalOverride: page.canonicalOverride,
  };
}

export default function PagesAdminPage() {
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
  const [pages, setPages] = useState<PageResource[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [activePageId, setActivePageId] = useState("");
  const [assignment, setAssignment] = useState<TemplateAssignment | null>(null);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!api || !storeId) return;
    let active = true;
    void Promise.all([api.listPages(storeId), api.listTemplates(storeId, "page")])
      .then(([nextPages, nextTemplates]) => {
        if (!active) return;
        setPages(nextPages);
        setTemplates(nextTemplates);
        setActivePageId((current) => current || nextPages[0]?.id || "");
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "We could not load your pages."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, attempt]);

  useEffect(() => {
    if (!api || !activePageId) {
      return;
    }
    let active = true;
    void api.getAssignment(storeId, "page", activePageId)
      .then((value) => { if (active) setAssignment(value); })
      .catch(() => { if (active) setAssignment(null); });
    return () => { active = false; };
  }, [api, activePageId]);

  const page = pages.find((entry) => entry.id === activePageId);

  if (!api) return <AdminPage title="Pages"><Banner tone="warning">Sign in to manage your pages.</Banner></AdminPage>;

  return (
    <AdminPage title="Pages" description="Information pages such as About, Delivery and Returns. Their content is edited in the store designer.">
      {error && <Banner tone="critical" title="Pages did not load" action={<Button size="small" onClick={() => { setError(undefined); setLoading(true); setAttempt((count) => count + 1); }}>Try again</Button>}>{error}</Banner>}
      <SplitLayout list={<SelectList label="Pages" loading={loading} selectedId={activePageId} onSelect={setActivePageId}
        items={pages.map((entry) => ({ id: entry.id, label: entry.title, sub: `/pages/${entry.handle}`, badge: <StatusBadge kind="content" value={entry.status ?? "DRAFT"} /> }))}
        empty="No pages yet." />}>
          {page ? (
            <ResourceForm
              key={`${page.id}:${assignment?.revision ?? "new"}:${assignment?.templateId ?? "default"}`}
              listImages={listImages} storeSlug={activeStore?.slug} pathPrefix="/pages/"
              resource={editable(page)}
              templates={templates.map(({ id, name }) => ({ id, name }))}
              assignedTemplateId={assignment?.templateId}
              onSave={async (value) => {
                const saved = await api.updatePage(storeId, page.id, {
                  title: value.title,
                  handle: value.handle,
                  seoTitle: value.seoTitle,
                  seoDescription: value.seoDescription,
                  socialMediaId: value.socialMediaId,
                  noindex: value.noindex,
                  canonicalOverride: value.canonicalOverride,
                });
                setPages((current) => current.map((entry) => entry.id === saved.id ? saved : entry));
              }}
              onAssignTemplate={async ({ resourceId, templateId }) => {
                const result = await api.assignTemplate(storeId, "page", resourceId, templateId, assignment?.revision ?? null);
                setAssignment(result.assignment);
              }}
              onCustomizeTemplate={({ resourceId, templateId }) => {
                window.location.assign(`/admin/online-store/editor?templateId=${encodeURIComponent(templateId)}&resourceType=page&resourceId=${encodeURIComponent(resourceId)}`);
              }}
            />
          ) : !loading && <Card><EmptyState icon={FileText} title={pages.length ? "Choose a page" : "No pages yet"} description={pages.length ? "Pick a page on the left to edit its title, search listing and layout." : "Pages are added when you install a store design."} /></Card>}
      </SplitLayout>
    </AdminPage>
  );
}
