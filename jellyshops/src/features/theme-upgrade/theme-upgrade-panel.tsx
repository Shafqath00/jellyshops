"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Banner, Button, Card, Field } from "@/components/admin";
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

  if (!offer) return error ? <Banner tone="critical" title="Could not check for design updates">{error}</Banner> : null;
  const chosen = offer.newer.find((entry) => entry.versionId === target);

  return <Card title="Theme updates" description={<>Your draft uses <strong>{offer.name} {offer.current.version}</strong>. Upgrading changes only your draft; your live store changes when you publish.</>}>
    <div className="jk-stack-sm">
      {error && <Banner tone="critical" onDismiss={() => setError("")}>{error}</Banner>}
      {notice && <Banner tone="success" onDismiss={() => setNotice("")}>{notice}</Banner>}

      {offer.newer.length === 0
        ? <p className="jk-muted">This is the newest version you have uploaded.</p>
        : <>
          <div className="jk-row is-end">
            <Field id="theme-upgrade-target" label="Upgrade to">
              <select id="theme-upgrade-target" value={target} onChange={(event) => { setTarget(event.target.value); setPreview(null); }}>
                {offer.newer.map((entry) => <option key={entry.versionId} value={entry.versionId}>Version {entry.version}</option>)}
              </select>
            </Field>
            <Button disabled={!target || Boolean(busy)} loading={busy === "preview"} loadingLabel="See what changes" onClick={() => run("preview", async () => {
              const body = await post<{ preview: UpgradePreview }>(`/${encodeURIComponent(target)}/preview`);
              setPreview(body.preview);
            })}>See what changes</Button>
          </div>
          {preview && preview.to === chosen?.version && <div className="jk-changes" aria-label={`Changes from ${preview.from} to ${preview.to}`}>
            {preview.changes.length === 0
              ? <p>Nothing in your draft needs to change. Your settings and sections stay as they are.</p>
              : <><p className="jk-strong">{preview.changes.length} change{preview.changes.length === 1 ? "" : "s"} to your draft</p>
                <ul>{preview.changes.map((change, index) => <li key={index}><span className="jk-strong">{change.where}:</span> {change.what}</li>)}</ul></>}
            {preview.problems.length > 0 && <Banner tone="critical" title="This version can't be used yet">
              <ul className="jk-bullets">{preview.problems.slice(0, 5).map((problem) => <li key={problem}>{problem}</li>)}</ul>
              <p>Ask the theme&apos;s developer for a fixed version.</p>
            </Banner>}
            <div><Button variant="primary" disabled={preview.problems.length > 0 || Boolean(busy)} loading={busy === "apply"} loadingLabel={`Upgrade draft to ${preview.to}`} onClick={() => run("apply", async () => {
              const result = await post<{ version: string }>(`/${encodeURIComponent(target)}/apply`, { expectedGeneration: preview.generation });
              await refresh();
              setNotice(`Your draft now uses version ${result.version}. Check it in the editor, then publish when you're happy. You can undo this upgrade until then.`);
            })}>Upgrade draft to {preview.to}</Button></div>
          </div>}
        </>}

      {offer.lastUpgrade && <div className="jk-row is-between jk-ruled">
        <p className="jk-muted">Upgraded from {offer.lastUpgrade.fromVersion} to {offer.lastUpgrade.toVersion}. Undo puts your draft back as it was before.</p>
        <Button disabled={Boolean(busy)} loading={busy === "undo"} loadingLabel="Undo upgrade" icon={<RotateCcw size={14} aria-hidden="true" />} onClick={() => run("undo", async () => {
          const result = await post<{ version: string }>("/rollback", { expectedGeneration: offer.generation });
          await refresh();
          setNotice(`Your draft is back on version ${result.version}.`);
        })}>Undo upgrade</Button>
      </div>}
    </div>
  </Card>;
}
