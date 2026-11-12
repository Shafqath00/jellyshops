"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LayoutTemplate, Loader2, RotateCcw } from "lucide-react";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";

export interface LayoutUpgradeOffer {
  themeId: string;
  draft: { revision: number; label: string; recognised: boolean };
  current: { revision: number; label: string };
  behind: boolean;
  generation: number;
  lastUpgrade: { id: string; fromRevision: number; toRevision: number; createdAt: string } | null;
}
interface PageSummary { page: string; added: string[]; carried: Array<{ section: string; settings: string[]; blocks: boolean }>; kept: string[]; removed: string[]; skipped: string[] }
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

const primary = "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
const secondary = "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50";
const list = (items: string[]) => [...new Set(items)].join(", ");

function Line({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return <li><span className="font-medium">{label}:</span> {list(items)}</li>;
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

  return <section aria-labelledby="layout-updates" className="rounded-3xl border border-border bg-card p-5 sm:p-7">
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-tint-foreground"><LayoutTemplate size={19} /></span>
      <div>
        <h2 id="layout-updates" className="text-xl font-bold tracking-tight">Page layout</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {offer.behind
            ? <>Your store&apos;s pages use an earlier layout of this design (<strong className="font-semibold text-foreground">{offer.draft.label}</strong>). The design&apos;s styles were made for the current layout, so some pages may look out of place. Upgrading rebuilds your draft pages in the current layout and keeps your own changes.</>
            : <>Your draft uses the current layout of this design.</>}
        </p>
      </div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 className="mt-0.5 shrink-0" size={16} />{notice}</p>}

    {offer.behind && <div className="grid gap-4">
      <div><button type="button" className={secondary} disabled={Boolean(busy)} onClick={() => run("preview", async () => {
        setPreview((await post<{ preview: LayoutUpgradePreview }>("/preview")).preview);
      })}>{busy === "preview" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : null}See what changes</button></div>
      {preview && <div className="grid gap-3 rounded-2xl bg-muted/60 p-4" aria-label="Changes to your draft pages">
        {(preview.shared.carried.length > 0 || preview.shared.kept.length > 0) && <div>
          <p className="text-sm font-semibold">Header, footer and announcement bar</p>
          <ul className="mt-1 grid gap-1 text-sm">
            <Line label="Your changes kept" items={preview.shared.carried.map((entry) => entry.section)} />
            <Line label="Kept as they are" items={preview.shared.kept} />
          </ul>
        </div>}
        {preview.pages.map((page) => <div key={page.page}>
          <p className="text-sm font-semibold">{page.page}</p>
          <ul className="mt-1 grid gap-1 text-sm">
            <Line label="New sections" items={page.added} />
            <Line label="Your changes kept" items={page.carried.map((entry) => entry.section)} />
            <Line label="Your own sections kept (moved to the end of the page)" items={page.kept} />
            <Line label="Replaced (you had not changed them)" items={page.removed} />
            <Line label="Left out (you had removed them)" items={page.skipped} />
          </ul>
        </div>)}
        <p className="text-sm text-muted-foreground">Menus, products, pages, extra page layouts and your colours and fonts stay as they are. To get the design&apos;s current look as well, choose a theme style in the editor.</p>
        {preview.problems.length > 0 && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} />This upgrade can&apos;t be done yet</p>
          <ul className="mt-1 list-disc pl-5">{preview.problems.slice(0, 5).map((problem) => <li key={problem}>{problem}</li>)}</ul>
        </div>}
        <div><button type="button" className={primary} disabled={preview.problems.length > 0 || Boolean(busy)} onClick={() => run("apply", async () => {
          await post("/apply", { expectedGeneration: preview.generation });
          await refresh();
          setNotice("Your draft pages now use the current layout. Check them in the editor, then publish when you're happy. You can undo this until then.");
        })}>{busy === "apply" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : null}Upgrade draft pages</button></div>
      </div>}
    </div>}

    {offer.lastUpgrade && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
      <p className="text-sm text-muted-foreground">Your draft pages were moved to the current layout. Undo puts them back as they were before.</p>
      <button type="button" className={secondary} disabled={Boolean(busy)} onClick={() => run("undo", async () => {
        await post("/rollback", { expectedGeneration: offer.generation });
        await refresh();
        setNotice("Your draft pages are back as they were before the upgrade.");
      })}>{busy === "undo" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : <RotateCcw size={15} />}Undo layout upgrade</button>
    </div>}
  </section>;
}
