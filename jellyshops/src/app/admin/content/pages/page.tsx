"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";
import { createContentApi, type ContentTemplate, type PageResource, type TemplateAssignment } from "@/features/content/api";
import { ResourceForm } from "@/features/content/resource-form";

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
  const [pages, setPages] = useState<PageResource[]>([]);
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [activePageId, setActivePageId] = useState("");
  const [assignment, setAssignment] = useState<TemplateAssignment | null>(null);
  const [error, setError] = useState<string>();

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
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load pages"));
    return () => { active = false; };
  }, [api]);

  useEffect(() => {
    if (!api || !activePageId) {
      setAssignment(null);
      return;
    }
    let active = true;
    void api.getAssignment(storeId, "page", activePageId)
      .then((value) => { if (active) setAssignment(value); })
      .catch(() => { if (active) setAssignment(null); });
    return () => { active = false; };
  }, [api, activePageId]);

  const page = pages.find((entry) => entry.id === activePageId);

  if (!api) return <main className="p-8">Page manager is unavailable until merchant authentication is connected.</main>;

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" aria-label="Back to admin" className="grid size-9 place-items-center rounded-lg border border-[#d7d7d7] bg-white"><ArrowLeft size={16} /></Link>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">Content</p><h1 className="text-2xl font-semibold tracking-[-0.03em]">Pages</h1></div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#e3e3e3] bg-white p-2">
          {pages.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setActivePageId(entry.id)} className={`flex min-h-10 w-full items-center rounded-lg px-3 text-left text-[12px] font-medium ${entry.id === activePageId ? "bg-[#eeeeee] text-[#202223]" : "text-[#616161] hover:bg-[#f6f6f7]"}`}>
              <span className="truncate">{entry.title}</span>
              <span className="ml-auto text-[9px] uppercase text-[#8c9196]">{entry.status ?? "DRAFT"}</span>
            </button>
          ))}
          {pages.length === 0 && <p className="p-4 text-center text-[12px] text-[#8c9196]">No pages yet.</p>}
        </aside>

        <section className="rounded-xl border border-[#e3e3e3] bg-white p-5">
          {page ? (
            <ResourceForm
              key={`${page.id}:${assignment?.revision ?? "new"}:${assignment?.templateId ?? "default"}`}
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
          ) : <p className="p-8 text-center text-sm text-[#8c9196]">Choose a page to edit.</p>}
        </section>
      </div>
    </main>
  );
}
