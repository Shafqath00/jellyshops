"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";

export interface UpgradeOffer {
  themeId: string;
  name: string;
  generation: number;
  current: { versionId: string; version: string };
  newer: Array<{ versionId: string; version: string; createdAt: string }>;
  lastUpgrade: { id: string; fromVersion: string; toVersion: string; createdAt: string } | null;
}
export interface UpgradePreview { from: string; to: string; generation: number; changes: Array<{ where: string; what: string }>; problems: string[] }

async function read<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? fallback);
  return body;
}

const primary = "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50";
const secondary = "inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:bg-muted disabled:opacity-50";

/**
 * Store designs > Theme updates: for a draft on one of the merchant's uploaded themes, newer
 * versions, what upgrading would change (preview first), the upgrade itself and undoing it. Only
 * the draft changes; the live store follows when the merchant publishes. Draws nothing for
 * drafts on built-in themes.
 */
export function ThemeUpgradePanel({ storeId, token, fetcher = fetch, onChanged }: { storeId: string; token: string; fetcher?: typeof fetch; onChanged?: () => void }) {
  const base = `${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/theme-upgrade`;
  const [offer, setOffer] = useState<UpgradeOffer | null | undefined>(undefined);
  const [target, setTarget] = useState("");
  const [preview, setPreview] = useState<UpgradePreview | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const fetchOffer = useCallback((signal?: AbortSignal) => fetcher(base, { signal, headers: { Authorization: `Bearer ${token}` } })
    .then((response) => read<{ offer: UpgradeOffer | null }>(response, "Could not check for theme updates."))
    .then((body) => body.offer), [base, token, fetcher]);

  useEffect(() => {
    const controller = new AbortController();
    fetchOffer(controller.signal)
      .then((next) => { setOffer(next); setTarget(next?.newer.at(-1)?.versionId ?? ""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { setOffer(null); setError(failure instanceof Error ? failure.message : "Could not check for theme updates."); } });
    return () => controller.abort();
  }, [fetchOffer]);

  async function post<T>(path: string, body?: unknown): Promise<T> {
    return fetcher(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) })
      .then((response) => read<T>(response, "Something went wrong. Try again."));
  }

  async function refresh() {
    const next = await fetchOffer();
    setOffer(next); setTarget(next?.newer.at(-1)?.versionId ?? ""); setPreview(null);
    onChanged?.();
  }

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label); setError(""); setNotice("");
    try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Something went wrong. Try again."); } finally { setBusy(""); }
  }

  if (!offer) return error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null;
  const chosen = offer.newer.find((entry) => entry.versionId === target);

  return <section aria-labelledby="theme-updates" className="rounded-3xl border border-border bg-card p-5 sm:p-7">
    <div className="mb-5 flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-tint-foreground"><ArrowUpCircle size={19} /></span>
      <div>
        <h2 id="theme-updates" className="text-xl font-bold tracking-tight">Theme updates</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">Your draft uses <strong className="font-semibold text-foreground">{offer.name} {offer.current.version}</strong>. Upgrading changes only your draft; your live store changes when you publish.</p>
      </div>
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"><CheckCircle2 className="mt-0.5 shrink-0" size={16} />{notice}</p>}

    {offer.newer.length === 0
      ? <p className="text-sm text-muted-foreground">This is the newest version you have uploaded.</p>
      : <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-semibold">Upgrade to
            <select value={target} onChange={(event) => { setTarget(event.target.value); setPreview(null); }} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-normal">
              {offer.newer.map((entry) => <option key={entry.versionId} value={entry.versionId}>Version {entry.version}</option>)}
            </select>
          </label>
          <button type="button" className={secondary} disabled={!target || Boolean(busy)} onClick={() => run("preview", async () => {
            const body = await post<{ preview: UpgradePreview }>(`/${encodeURIComponent(target)}/preview`);
            setPreview(body.preview);
          })}>{busy === "preview" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : null}See what changes</button>
        </div>
        {preview && preview.to === chosen?.version && <div className="grid gap-3 rounded-2xl bg-muted/60 p-4" aria-label={`Changes from ${preview.from} to ${preview.to}`}>
          {preview.changes.length === 0
            ? <p className="text-sm">Nothing in your draft needs to change. Your settings and sections stay as they are.</p>
            : <><p className="text-sm font-semibold">{preview.changes.length} change{preview.changes.length === 1 ? "" : "s"} to your draft</p>
              <ul className="grid gap-1 text-sm">{preview.changes.map((change, index) => <li key={index}><span className="font-medium">{change.where}:</span> {change.what}</li>)}</ul></>}
          {preview.problems.length > 0 && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={15} />This version can&apos;t be used yet</p>
            <ul className="mt-1 list-disc pl-5">{preview.problems.slice(0, 5).map((problem) => <li key={problem}>{problem}</li>)}</ul>
            <p className="mt-1">Ask the theme&apos;s developer for a fixed version.</p>
          </div>}
          <div><button type="button" className={primary} disabled={preview.problems.length > 0 || Boolean(busy)} onClick={() => run("apply", async () => {
            const result = await post<{ version: string }>(`/${encodeURIComponent(target)}/apply`, { expectedGeneration: preview.generation });
            await refresh();
            setNotice(`Your draft now uses version ${result.version}. Check it in the editor, then publish when you're happy. You can undo this upgrade until then.`);
          })}>{busy === "apply" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : null}Upgrade draft to {preview.to}</button></div>
        </div>}
      </div>}

    {offer.lastUpgrade && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
      <p className="text-sm text-muted-foreground">Upgraded from {offer.lastUpgrade.fromVersion} to {offer.lastUpgrade.toVersion}. Undo puts your draft back as it was before.</p>
      <button type="button" className={secondary} disabled={Boolean(busy)} onClick={() => run("undo", async () => {
        const result = await post<{ version: string }>("/rollback", { expectedGeneration: offer.generation });
        await refresh();
        setNotice(`Your draft is back on version ${result.version}.`);
      })}>{busy === "undo" ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" /> : <RotateCcw size={15} />}Undo upgrade</button>
    </div>}
  </section>;
}
