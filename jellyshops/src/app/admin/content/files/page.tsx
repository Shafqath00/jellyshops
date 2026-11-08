"use client";

import { FileImage, Upload } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { AdminPage, ConfirmDialog, EmptyState, IndexTable, StatusBadge, useToast, type IndexColumn, type IndexTab } from "@/components/admin";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";
import { useAdminQuery } from "@/features/admin/hooks/use-admin-query";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import type { MediaRecord } from "@/features/store-editor/api/types";

const TABS: IndexTab[] = [{ id: "", label: "All" }, { id: "used", label: "In use" }, { id: "unused", label: "Not used" }];
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function FilesPage() {
  const { session, activeStore } = useAuth();
  const toast = useToast();
  const token = session?.access_token;
  const api = useMemo(() => token ? createStoreEditorApi({ baseUrl: authApiOrigin(), token }) : null, [token]);
  const load = useCallback(() => api!.listMedia!(activeStore!.id), [api, activeStore]);
  const query = useAdminQuery(api?.listMedia && activeStore ? `media:${activeStore.id}` : null, load);
  const [extra, setExtra] = useState<MediaRecord[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [view, setView] = useState(""), [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(0);
  const [deleting, setDeleting] = useState<MediaRecord[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const files = [...extra, ...(query.data ?? [])].filter((file, index, all) => !removed.includes(file.id) && all.findIndex((item) => item.id === file.id) === index);
  const needle = search.trim().toLowerCase();
  const rows = files.filter((file) => (!view || (view === "used") === file.referenced) && (!needle || file.originalName.toLowerCase().includes(needle)));

  async function upload(list: FileList | null) {
    if (!api || !activeStore || !list?.length) return;
    const chosen = [...list];
    setUploading(chosen.length);
    let done = 0;
    for (const file of chosen) {
      try { const saved = await api.uploadMedia(activeStore.id, file); setExtra((current) => [saved, ...current]); done += 1; }
      catch (failure) { toast(`${file.name}: ${failure instanceof Error ? failure.message : "could not be uploaded"}`, { tone: "critical" }); }
      setUploading((count) => count - 1);
    }
    if (done) toast(`${done} ${done === 1 ? "file" : "files"} uploaded`);
    if (input.current) input.current.value = "";
  }
  async function remove(targets: MediaRecord[]) {
    if (!api || !activeStore) return;
    for (const file of targets) await api.deleteMedia(activeStore.id, file.id);
    setRemoved((current) => [...current, ...targets.map((file) => file.id)]);
    toast(`${targets.length} ${targets.length === 1 ? "file" : "files"} deleted`);
  }
  async function copyLink(file: MediaRecord) {
    try { await navigator.clipboard.writeText(file.url); toast("Link copied"); }
    catch { toast("Your browser did not allow copying. Open the file and copy its address instead.", { tone: "critical" }); }
  }

  const columns: IndexColumn<MediaRecord>[] = [
    { id: "file", header: "File", mobile: "primary", cell: (file) => <a href={file.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-3"><img src={file.url} alt="" className="jk-thumb" loading="lazy" /><span className="min-w-0"><span className="jk-strong block truncate">{file.originalName || "Untitled image"}</span><span className="jk-cell-sub">{file.width} × {file.height}</span></span></a> },
    { id: "size", header: "Size", align: "end", cell: (file) => fileSize(file.byteSize) },
    { id: "used", header: "Use", cell: (file) => file.referenced ? <StatusBadge tone="info">In use</StatusBadge> : <StatusBadge tone="neutral">Not used</StatusBadge> },
    { id: "date", header: "Added", mobile: "hidden", cell: (file) => new Date(file.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
    { id: "copy", header: "Copy link", hideHeader: true, align: "end", cell: (file) => <button type="button" className="jk-button" onClick={() => void copyLink(file)} aria-label={`Copy link to ${file.originalName || "image"}`}>Copy link</button> },
  ];

  return <AdminPage title="Files" description="Every photo uploaded to your store. Upload images here to use them in products, pages and your store design."
    primaryAction={{ label: uploading ? `Uploading ${uploading}…` : "Upload files", onAction: () => input.current?.click(), disabled: uploading > 0 || !api }}>
    <input ref={input} type="file" accept={ACCEPT} multiple hidden aria-label="Choose files to upload" onChange={(event) => void upload(event.target.files)} />
    <IndexTable label="Files" rows={rows} rowKey={(file) => file.id} rowLabel={(file) => file.originalName || "image"} columns={columns}
      loading={query.loading} error={query.error?.message} onRetry={query.retry} tabs={TABS} activeTab={view} onTabChange={setView}
      search={{ value: search, onChange: setSearch, label: "Search files", placeholder: "Search by file name" }}
      bulkActions={[{ label: "Delete", destructive: true, onAction: (ids) => setDeleting(files.filter((file) => ids.includes(file.id))) }]}
      emptyState={files.length
        ? <EmptyState icon={FileImage} title="No matching files" description="Try another search, or choose All." />
        : <EmptyState icon={FileImage} title="Upload your first image" description="JPG, PNG, WebP, GIF or AVIF. Images you add to products also appear here." action={<button type="button" className="jk-button jk-button-primary" onClick={() => input.current?.click()}><Upload size={14} aria-hidden="true" />Upload files</button>} />}
      pagination={rows.length ? { summary: `${rows.length} ${rows.length === 1 ? "file" : "files"}`, hasPrevious: false, hasNext: false, onPrevious: () => undefined, onNext: () => undefined } : undefined} />
    <ConfirmDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }}
      title={deleting?.length === 1 ? `Delete ${deleting[0].originalName || "this image"}?` : `Delete ${deleting?.length ?? 0} files?`}
      description={deleting?.some((file) => file.referenced)
        ? "Some of these are used by a product, page or your store design. Those places will show no image. This cannot be undone."
        : "They are removed from your store. This cannot be undone."}
      confirmLabel="Delete" destructive onConfirm={() => remove(deleting ?? [])} />
  </AdminPage>;
}
