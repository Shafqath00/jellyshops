"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/features/admin/admin-routing";
import { Banner, Button, Card, ConfirmDialog, StatusBadge, useToast } from "@/components/admin";
import { POLICY_KINDS, type PolicyKind } from "@jelly/storefront-schema";
import { contentState, type PageResource } from "@/features/content/api/client";
import { useContentApi } from "@/features/content-admin/shared";
import { POLICY_HANDLES, POLICY_TITLES, policyTemplate, type PolicyDetails } from "../policy-templates";
import type { PreferencesForm } from "../use-preferences-form";

const POLICY_HELP: Record<PolicyKind, string> = {
  refund: "How long shoppers have to return items and how refunds work.",
  privacy: "What personal information you collect and how you use it.",
  terms: "The rules for buying from your store.",
  shipping: "Delivery times, costs and where you deliver.",
};

type PageStatus = "PUBLISHED" | "DRAFT" | "SCHEDULED" | "ARCHIVED" | "MISSING";

function statusOf(page: PageResource | undefined): PageStatus {
  if (!page) return "MISSING";
  return contentState(page).toUpperCase() as PageStatus;
}

/**
 * Which page holds each policy. Policies are ordinary pages edited with the same editor as other content; once a
 * policy page is published it is linked from the store footer and checkout automatically.
 */
export function PoliciesCard({ form, details, bare = false }: { form: PreferencesForm; details: PolicyDetails; bare?: boolean }) {
  const { api, storeId } = useContentApi();
  const toast = useToast();
  const [pages, setPages] = useState<PageResource[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState<PolicyKind | null>(null);
  const [confirm, setConfirm] = useState<PolicyKind | null>(null);

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!api || !storeId) return;
    let live = true;
    api.listPages(storeId).then((list) => { if (live) { setError(""); setPages(list); } }, (failure: unknown) => { if (live) setError(failure instanceof Error ? failure.message : "Could not load your pages."); });
    return () => { live = false; };
  }, [api, storeId, attempt]);

  async function create(kind: PolicyKind) {
    if (!api || !storeId) return;
    setCreating(kind);
    try {
      const taken = new Set((pages ?? []).map((page) => page.handle));
      let handle = POLICY_HANDLES[kind];
      for (let n = 2; taken.has(handle); n += 1) handle = `${POLICY_HANDLES[kind]}-${n}`;
      const page = await api.createPage(storeId, { title: POLICY_TITLES[kind], handle, content: policyTemplate(kind, details), showInNavigation: false });
      setPages((current) => [...(current ?? []), page]);
      form.set(`policies.${kind}`, page.handle);
      toast(`${POLICY_TITLES[kind]} created as a draft. Read it, edit it, then publish.`);
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : "Could not create the page.", { tone: "critical" });
    } finally {
      setCreating(null);
    }
  }

  const live = pages?.filter((page) => !page.archivedAt) ?? [];
  const body = <>
    <div className="jk-stack-sm" id="policies">
      {error && <Banner tone="critical" title="Pages didn't load" action={<Button onClick={() => void load()}>Try again</Button>}>{error}</Banner>}
      <ul className="jk-rows">
        {POLICY_KINDS.map((kind) => {
          const handle = form.draft?.policies[kind] ?? "";
          const page = live.find((item) => item.handle === handle);
          const status = statusOf(page);
          const id = `pref-policy-${kind}`;
          return <li key={kind} className="jk-rows-item jk-pref-policy" data-pref-path={`policies.${kind}`}>
            <div className="jk-stack-sm">
              <span className="jk-strong">{POLICY_TITLES[kind]}</span>
              <small className="jk-muted">{POLICY_HELP[kind]}</small>
              <div className="jk-row">
                <label className="sr-only" htmlFor={id}>Page for the {POLICY_TITLES[kind].toLowerCase()}</label>
                <select id={id} className="jk-select" value={page ? handle : ""} disabled={!pages} onChange={(event) => form.set(`policies.${kind}`, event.target.value)}>
                  <option value="">{pages ? "No page chosen" : "Loading pages…"}</option>
                  {live.map((item) => <option key={item.id} value={item.handle}>{item.title} (/{item.handle})</option>)}
                </select>
                {pages && (status === "MISSING" ? handle ? <StatusBadge tone="critical">Page missing</StatusBadge> : <StatusBadge tone="attention">Not set up</StatusBadge> : <StatusBadge kind="content" value={status} />)}
              </div>
              {status === "DRAFT" && <small className="jk-muted">Shoppers can&apos;t see this page yet. Publish it to link it from your footer and checkout.</small>}
              {handle && status === "MISSING" && pages && <small className="jk-field-error">The page /{handle} no longer exists. Choose another or create one.</small>}
            </div>
            <div className="jk-row">
              {page && <Link href={`/admin/content/pages/${page.id}`} className="jk-button">Edit page</Link>}
              {!page && <Button onClick={() => setConfirm(kind)} loading={creating === kind} loadingLabel="Creating…" disabled={!pages}>Create from template</Button>}
            </div>
          </li>;
        })}
      </ul>
    </div>
    <p className="jk-muted jk-pref-note">Templates are a starting point, not legal advice. Read them and adjust them to your business.</p>
    <ConfirmDialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null); }}
      title={confirm ? `Create a ${POLICY_TITLES[confirm].toLowerCase()} from a template?` : ""}
      description="We'll create a draft page with starter wording filled in with your business details. It stays hidden from shoppers until you publish it. The wording is a general starting point, not legal advice: read it and change it to fit your business."
      confirmLabel="Create draft" onConfirm={() => { const kind = confirm; setConfirm(null); if (kind) void create(kind); }} />
  </>;
  return bare ? body : <Card title="Policies" description="Published policies are linked from your store footer and checkout.">{body}</Card>;
}
