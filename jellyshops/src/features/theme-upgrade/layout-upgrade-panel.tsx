"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Banner, Button, Card } from "@/components/admin";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";

export interface LayoutUpgradeOffer {
  themeId: string;
  draft: { revision: number; label: string; recognised: boolean };
  current: { revision: number; label: string };
  behind: boolean;
  generation: number;
  lastUpgrade: { id: string; fromRevision: number; toRevision: number; createdAt: string } | null;
}
interface PageSummary { page: string; added: string[]; carried: Array<{ section: string; settings: string[]; blocks: boolean }>; kept: string[]; removed: string[]; skipped: string[]; combined?: string[] }
export interface LayoutUpgradePreview {
  from: { revision: number; label: string };
  to: { revision: number; label: string };
  generation: number;
  shared: Pick<PageSummary, "added" | "carried" | "kept">;
  pages: PageSummary[];
  problems: string[];
}

async function read<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? fallback);
  return body;
}

const list = (items: string[]) => [...new Set(items)].join(", ");

function Line({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return <li><span className="jk-strong">{label}:</span> {list(items)}</li>;
}

/**
 * Store designs > Page layout: when the draft was built from an earlier starter layout of its theme,
 * shows what moving to the current layout would do (preview first), does it, and can undo it. The
 * merchant's own changes and sections are kept; only the draft changes until they publish. Draws
 * nothing when the draft already uses the current layout and there is nothing to undo.
 */
export function LayoutUpgradePanel({ storeId, token, fetcher = fetch, onChanged }: { storeId: string; token: string; fetcher?: typeof fetch; onChanged?: () => void }) {
  const base = `${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/storefront/layout-upgrade`;
  const [offer, setOffer] = useState<LayoutUpgradeOffer | null | undefined>(undefined);
  const [preview, setPreview] = useState<LayoutUpgradePreview | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchOffer = useCallback((signal?: AbortSignal) => fetcher(base, { signal, headers: { Authorization: `Bearer ${token}` } })
    .then((response) => read<{ offer: LayoutUpgradeOffer | null }>(response, "Could not check the page layout."))
    .then((body) => body.offer), [base, token, fetcher]);

  useEffect(() => {
    const controller = new AbortController();
    fetchOffer(controller.signal)
      .then(setOffer)
      // A store whose backend has no layout upgrades yet simply shows nothing.
      .catch(() => { if (!controller.signal.aborted) setOffer(null); });
    return () => controller.abort();
  }, [fetchOffer]);

  async function post<T>(path: string, body?: unknown): Promise<T> {
    return fetcher(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) })
      .then((response) => read<T>(response, "Something went wrong. Try again."));
  }

  async function refresh() {
    setOffer(await fetchOffer());
    setPreview(null);
    onChanged?.();
  }

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label); setError(""); setNotice("");
    try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Something went wrong. Try again."); } finally { setBusy(""); }
  }

  if (!offer || (!offer.behind && !offer.lastUpgrade && !notice)) return null;

  return <Card title="Page layout" description={offer.behind
    ? <>Your store&apos;s pages use an earlier layout of this design (<strong>{offer.draft.label}</strong>). The design&apos;s styles were made for the current layout, so some pages may look out of place. Upgrading rebuilds your draft pages in the current layout and keeps your own changes.</>
    : <>Your draft uses the current layout of this design.</>}>
    <div className="jk-stack-sm">
      {error && <Banner tone="critical" onDismiss={() => setError("")}>{error}</Banner>}
      {notice && <Banner tone="success" onDismiss={() => setNotice("")}>{notice}</Banner>}

      {offer.behind && <>
        <div><Button disabled={Boolean(busy)} loading={busy === "preview"} loadingLabel="See what changes" onClick={() => run("preview", async () => {
          setPreview((await post<{ preview: LayoutUpgradePreview }>("/preview")).preview);
        })}>See what changes</Button></div>
        {preview && <div className="jk-changes" aria-label="Changes to your draft pages">
          {(preview.shared.carried.length > 0 || preview.shared.kept.length > 0) && <div>
            <p className="jk-strong">Header, footer and announcement bar</p>
            <ul>
              <Line label="Your changes kept" items={preview.shared.carried.map((entry) => entry.section)} />
              <Line label="Kept as they are" items={preview.shared.kept} />
            </ul>
          </div>}
          {preview.pages.map((page) => <div key={page.page}>
            <p className="jk-strong">{page.page}</p>
            <ul>
              <Line label="Now one section with photos and buying details" items={page.combined ?? []} />
              <Line label="New sections" items={page.added} />
              <Line label="Your changes kept" items={page.carried.map((entry) => entry.section)} />
              <Line label="Your own sections kept (moved to the end of the page)" items={page.kept} />
              <Line label="Replaced (you had not changed them)" items={page.removed} />
              <Line label="Left out (you had removed them)" items={page.skipped} />
            </ul>
          </div>)}
          <p className="jk-muted">Menus, products, pages, extra page layouts and your colours and fonts stay as they are. To get the design&apos;s current look as well, choose a theme style in the editor.</p>
          {preview.problems.length > 0 && <Banner tone="critical" title="This upgrade can't be done yet">
            <ul className="jk-bullets">{preview.problems.slice(0, 5).map((problem) => <li key={problem}>{problem}</li>)}</ul>
          </Banner>}
          <div><Button variant="primary" disabled={preview.problems.length > 0 || Boolean(busy)} loading={busy === "apply"} loadingLabel="Upgrade draft pages" onClick={() => run("apply", async () => {
            await post("/apply", { expectedGeneration: preview.generation });
            await refresh();
            setNotice("Your draft pages now use the current layout. Check them in the editor, then publish when you're happy. You can undo this until then.");
          })}>Upgrade draft pages</Button></div>
        </div>}
      </>}

      {offer.lastUpgrade && <div className="jk-row is-between jk-ruled">
        <p className="jk-muted">Your draft pages were moved to the current layout. Undo puts them back as they were before.</p>
        <Button disabled={Boolean(busy)} loading={busy === "undo"} loadingLabel="Undo layout upgrade" icon={<RotateCcw size={14} aria-hidden="true" />} onClick={() => run("undo", async () => {
          await post("/rollback", { expectedGeneration: offer.generation });
          await refresh();
          setNotice("Your draft pages are back as they were before the upgrade.");
        })}>Undo layout upgrade</Button>
      </div>}
    </div>
  </Card>;
}
