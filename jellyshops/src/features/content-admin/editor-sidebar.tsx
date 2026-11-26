"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ImageIcon } from "lucide-react";
import Link from "@/features/admin/admin-routing";
import { Button, Card, Field, HelpTip, Picker, StatusBadge, TagInput } from "@/components/admin";
import type { BlogResource, ContentState, ContentTemplate, HandleCheck, TemplateAssignment } from "@/features/content/api/client";
import type { MediaRecord } from "@/features/store-editor/api/types";
import { SeoFields } from "@/features/content/components/seo-fields";
import type { EditableContent } from "./editable";
import { STATE_BADGE, fromLocalInput, scheduleLabel, toLocalInput, whenLabel, type ContentKind } from "./shared";

type Patch = (patch: Partial<EditableContent>) => void;

export function StatusCard({ kind, state, publishedAt, scheduledAt, isNew, busy, onPublish, onUnpublish, onSchedule, onCancelSchedule, onRestore }: {
  kind: ContentKind; state: ContentState; publishedAt?: string | null; scheduledAt?: string | null; isNew: boolean; busy: boolean;
  onPublish: () => void; onUnpublish: () => void; onSchedule: (at: string) => void; onCancelSchedule: () => void; onRestore: () => void;
}) {
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(() => toLocalInput(scheduledAt ?? new Date(Date.now() + 86_400_000).toISOString()));
  const [error, setError] = useState("");
  const noun = kind === "page" ? "page" : "post";
  const text: Record<ContentState, string> = {
    draft: isNew ? `Not saved yet. Start typing and your ${noun} is saved as a draft.` : `Draft: only you can see this ${noun}.`,
    published: `Live on your store${publishedAt ? ` since ${whenLabel(publishedAt).toLowerCase()}` : ""}. Changes go live when you save.`,
    scheduled: `Goes live on ${scheduleLabel(scheduledAt)}. Until then only you can see it.`,
    archived: `Archived: hidden from shoppers. It stays in the Archived tab until you restore or delete it.`,
  };
  function schedule() {
    const at = fromLocalInput(when);
    if (!at || new Date(at).getTime() < Date.now()) { setError("Choose a date and time in the future."); return; }
    setError(""); setScheduling(false); onSchedule(at);
  }
  return (
    <Card>
      <div className="jk-stack-sm">
        <div className="jk-row"><h2 className="jk-subheading">Status</h2><StatusBadge kind="content" value={STATE_BADGE[state]} /></div>
        <p className="jca-status-text">{text[state]}</p>
        {state === "archived" ? <div className="jca-actions"><Button onClick={onRestore} loading={busy}>Restore</Button></div> : (
          <div className="jca-actions">
            {state !== "published" && <Button variant="primary" onClick={onPublish} loading={busy} disabled={isNew}>Publish now</Button>}
            {state === "published" && <Button onClick={onUnpublish} loading={busy}>Unpublish</Button>}
            {state === "scheduled" && <Button variant="quiet" onClick={onCancelSchedule} disabled={busy}>Cancel schedule</Button>}
            {state !== "published" && !scheduling && <Button variant="quiet" icon={<CalendarClock size={15} aria-hidden />} onClick={() => setScheduling(true)} disabled={isNew}>{state === "scheduled" ? "Change time" : "Schedule"}</Button>}
          </div>
        )}
        {scheduling && (
          <div className="jk-stack-sm">
            <Field id="schedule-at" label="Publish on" help={`Your time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`} error={error}>
              <input id="schedule-at" type="datetime-local" value={when} min={toLocalInput(new Date().toISOString())} onChange={(event) => setWhen(event.target.value)} />
            </Field>
            <div className="jca-actions"><Button variant="primary" onClick={schedule} loading={busy}>Schedule</Button><Button variant="quiet" onClick={() => setScheduling(false)}>Cancel</Button></div>
          </div>
        )}
        {isNew && <p className="jca-help">Publishing and scheduling become available once the {noun} has a title.</p>}
      </div>
    </Card>
  );
}

export function BlogCard({ value, blogs, onChange, error, onManage }: { value: string; blogs: BlogResource[]; onChange: Patch; error?: string; onManage: () => void }) {
  return (
    <Card>
      <Field id="post-blog" label={<>Blog <HelpTip>Each blog has its own page listing its posts. Moving a post keeps its old address working.</HelpTip></>} error={error}>
        <select id="post-blog" value={value} onChange={(event) => onChange({ blogId: event.target.value })}>
          {!value && <option value="">Choose a blog</option>}
          {blogs.map((blog) => <option key={blog.id} value={blog.id}>{blog.title}</option>)}
        </select>
      </Field>
      <Button variant="quiet" size="small" onClick={onManage}>Manage blogs</Button>
    </Card>
  );
}

export function ExcerptCard({ value, onChange }: { value: string; onChange: Patch }) {
  return (
    <Card>
      <Field id="post-excerpt" label={<>Summary <HelpTip>Shown under the title in your blog&apos;s list of posts and, if your design shows it, at the top of the post.</HelpTip></>} help={`${value.length} of 1000 characters`}>
        <textarea id="post-excerpt" rows={3} maxLength={1000} value={value} onChange={(event) => onChange({ excerpt: event.target.value })} placeholder="One or two sentences about the post" />
      </Field>
    </Card>
  );
}

export function FeaturedImageCard({ value, onChange, listImages }: { value: string | null; onChange: Patch; listImages?: () => Promise<MediaRecord[]> }) {
  const [picking, setPicking] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!value || !listImages) return;
    let active = true;
    void listImages().then((media) => { if (active) setUrl(media.find((item) => item.id === value)?.url ?? null); }).catch(() => undefined);
    return () => { active = false; };
  }, [value, listImages]);
  return (
    <Card>
      <div className="jk-stack-sm">
        <h2 className="jk-subheading">Featured image <HelpTip>Shown with the post in lists and when it&apos;s shared.</HelpTip></h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- store photo preview */}
        {value && url ? <img src={url} alt="Featured image" className="jca-featured" /> : <span className="jca-featured-empty"><ImageIcon size={20} aria-hidden />{value ? "Image chosen" : "No image yet"}</span>}
        <div className="jca-actions">
          {listImages && <Button size="small" onClick={() => setPicking(true)}>{value ? "Change" : "Choose image"}</Button>}
          {value && <Button size="small" variant="quiet" onClick={() => onChange({ featuredMediaId: null })}>Remove</Button>}
        </div>
      </div>
      <Picker open={picking} onOpenChange={setPicking} title="Choose a featured image" searchLabel="Search images" multiple={false} doneLabel="Use image"
        load={async (query) => (await listImages!()).filter((item) => item.mimeType.startsWith("image/") && item.originalName.toLowerCase().includes(query.toLowerCase()))
          // eslint-disable-next-line @next/next/no-img-element -- small preview
          .map((item) => ({ id: item.id, label: item.originalName || "Image", detail: `${item.width} × ${item.height}`, media: <img src={item.url} alt="" className="jk-thumb" /> }))}
        onDone={(items) => { const picked = items[0]; if (picked) onChange({ featuredMediaId: picked.id }); }} />
    </Card>
  );
}

export function OrganisationCard({ kind, value, onChange, knownTags }: { kind: ContentKind; value: EditableContent; onChange: Patch; knownTags: string[] }) {
  return (
    <Card>
      <div className="jk-stack-sm">
        <h2 className="jk-subheading">Organisation</h2>
        <Field id="content-author" label="Author" help={kind === "post" ? "Shown on the post if your design shows authors." : "For your team; not shown on the page."}>
          <input id="content-author" value={value.authorName} maxLength={120} onChange={(event) => onChange({ authorName: event.target.value })} placeholder="Your name" />
        </Field>
        {kind === "post" && <TagInput label="Tags" value={value.tags} onChange={(tags) => onChange({ tags })} known={knownTags} help="Group posts by topic, e.g. Sleep tips. Up to 50." />}
      </div>
    </Card>
  );
}

export function NavigationCard({ value, onChange }: { value: boolean; onChange: Patch }) {
  return (
    <Card>
      <div className="jk-stack-sm">
        <h2 className="jk-subheading">Navigation</h2>
        <label className="jk-check"><input type="checkbox" checked={value} onChange={(event) => onChange({ showInNavigation: event.target.checked })} />
          <span>Suggest in menus<span className="jk-cell-sub">Offered first when you add links to your header or footer.</span></span></label>
        <Link href="/admin/content/menus" className="jk-link">Edit your menus</Link>
      </div>
    </Card>
  );
}

export function TemplateCard({ templates, assignment, onAssign, onCustomise }: {
  templates: ContentTemplate[]; assignment: TemplateAssignment | null; onAssign: (templateId: string) => Promise<void>; onCustomise: (templateId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (templates.length < 2 && !assignment) {
    return null;
  }
  const current = assignment?.templateId ?? templates[0]?.id ?? "";
  return (
    <Card>
      <div className="jk-stack-sm">
        <Field id="content-template" label={<>Layout <HelpTip>Which of your store design&apos;s layouts draws this. Make more in the store designer.</HelpTip></>} error={error}>
          <select id="content-template" value={current} disabled={busy} onChange={async (event) => {
            setBusy(true); setError("");
            try { await onAssign(event.target.value); } catch (reason) { setError(reason instanceof Error ? reason.message : "The layout could not be changed."); } finally { setBusy(false); }
          }}>
            {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select>
        </Field>
        {current && <Button size="small" variant="quiet" onClick={() => onCustomise(current)}>Customise this layout</Button>}
      </div>
    </Card>
  );
}

export function SearchListingCard({ kind, value, onChange, storeSlug, blogHandle, handleCheck, listImages, wasLive }: {
  kind: ContentKind; value: EditableContent; onChange: Patch; storeSlug: string; blogHandle?: string; handleCheck: HandleCheck | null;
  listImages?: () => Promise<MediaRecord[]>; wasLive: boolean;
}) {
  const taken = handleCheck && !handleCheck.available && handleCheck.handle === value.handle;
  return (
    <Card>
      <SeoFields
        value={{ handle: value.handle, seoTitle: value.seoTitle, seoDescription: value.seoDescription, socialMediaId: value.socialMediaId, noindex: value.noindex, canonicalOverride: value.canonicalOverride }}
        onChange={(next) => onChange({ handle: next.handle.toLowerCase(), seoTitle: next.seoTitle, seoDescription: next.seoDescription, socialMediaId: next.socialMediaId, noindex: next.noindex, canonicalOverride: next.canonicalOverride })}
        fallbackTitle={value.title}
        pathPrefix={kind === "page" ? "/pages/" : `/blogs/${blogHandle ?? "blog"}/`}
        storeSlug={storeSlug}
        listImages={listImages}
      />
      {taken && (
        <p className="jk-field-error" role="alert">
          Another {kind === "page" ? "page" : "post"} already uses “{value.handle}”.{" "}
          <button type="button" className="jk-link" onClick={() => onChange({ handle: handleCheck!.suggestion })}>Use {handleCheck!.suggestion}</button>
        </p>
      )}
      {wasLive && <p className="jca-help">Changing the web address keeps the old one working: shoppers are sent to the new one.</p>}
    </Card>
  );
}
