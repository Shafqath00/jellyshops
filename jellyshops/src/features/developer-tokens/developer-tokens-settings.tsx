"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Copy } from "lucide-react";
import { authApiOrigin } from "@/features/auth/providers/auth-provider";

export interface DeveloperTokenSummary {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

async function read<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (response.status === 403) throw new Error("Only the store owner or a developer can manage developer tokens.");
  if (!response.ok) throw new Error(body.error?.message ?? fallback);
  return body;
}

const day = (value: string | null) => value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;

function state(token: DeveloperTokenSummary): string {
  if (token.revokedAt) return `Revoked ${day(token.revokedAt)}`;
  if (token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now()) return `Expired ${day(token.expiresAt)}`;
  return token.expiresAt ? `Expires ${day(token.expiresAt)}` : "Never expires";
}

/**
 * Settings > Developer tokens: keys for `jelly-theme upload` and `install`, so a theme developer does
 * not have to copy a sign-in token. A token is shown once, works only on this store's themes, and
 * stops working when it is revoked, expires, or its creator leaves the store.
 */
export function DeveloperTokensSettings({ storeId, token, fetcher = fetch }: { storeId: string; token: string; fetcher?: typeof fetch }) {
  const url = `${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/developer-tokens`;
  const [tokens, setTokens] = useState<DeveloperTokenSummary[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchList = useCallback((signal?: AbortSignal) => fetcher(url, { signal, headers: { Authorization: `Bearer ${token}` } })
    .then((response) => read<{ tokens: DeveloperTokenSummary[] }>(response, "Could not load the developer tokens."))
    .then((body) => body.tokens), [url, token, fetcher]);

  useEffect(() => {
    const controller = new AbortController();
    fetchList(controller.signal)
      .then((list) => { setTokens(list); setError(""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load the developer tokens."); });
    return () => controller.abort();
  }, [fetchList]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const expiry = String(data.get("expiry") ?? "");
    setBusy(true); setError(""); setCreated(null); setCopied(false);
    try {
      const body = await fetcher(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ name: String(data.get("name") ?? ""), expiresInDays: expiry ? Number(expiry) : null }) })
        .then((response) => read<{ token: string; summary: DeveloperTokenSummary }>(response, "Could not create the token."));
      setCreated({ name: body.summary.name, token: body.token });
      form.reset();
      setTokens(await fetchList());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create the token.");
    } finally { setBusy(false); }
  }

  async function revoke(item: DeveloperTokenSummary) {
    setBusy(true); setError("");
    try {
      const response = await fetcher(`${url}/${encodeURIComponent(item.id)}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) await read(response, "Could not revoke the token.");
      if (created) setCreated(null);
      setTokens(await fetchList());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not revoke the token.");
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.token); setCopied(true); } catch { setCopied(false); }
  }

  return <section className="form-card" aria-labelledby="developer-tokens-title">
    <div className="form-card-title"><div><span>Themes</span><h2 id="developer-tokens-title">Developer tokens</h2></div></div>
    <p className="muted">For <code>jelly-theme upload</code> and <code>jelly-theme install</code>. A token works only on this store&apos;s themes. Treat it like a password: anyone who has it can upload themes to this store.</p>
    {error && <div role="alert" className="error-banner">{error}</div>}
    {created && <div className="success-banner" role="status">
      <CheckCircle2 size={18} />
      <div>
        <p><strong>Copy the token for “{created.name}” now.</strong> It will not be shown again.</p>
        <p><code aria-label="New developer token">{created.token}</code></p>
        <button type="button" className="button button-secondary" onClick={copy}><Copy size={16} /> {copied ? "Copied" : "Copy token"}</button>
      </div>
    </div>}
    {tokens && <form className="field-grid" onSubmit={create}>
      <label className="field"><span>Name</span><input name="name" required maxLength={80} placeholder="Studio laptop" /><small>Who or what uses it, so you know which one to revoke later.</small></label>
      <label className="field"><span>Expires</span><select name="expiry" defaultValue="90"><option value="30">After 30 days</option><option value="90">After 90 days</option><option value="365">After a year</option><option value="">Never</option></select></label>
      <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? "Working…" : "Create token"}</button></div>
    </form>}
    {!tokens && !error && <p aria-live="polite">Loading developer tokens…</p>}
    {tokens && (tokens.length === 0
      ? <p className="muted">No tokens yet.</p>
      : <ul className="developer-token-list" aria-label="Developer tokens">
        {tokens.map((item) => <li key={item.id}>
          <div>
            <strong>{item.name}</strong> <code>{item.prefix}…</code>
            <small>Created {day(item.createdAt)} · {item.lastUsedAt ? `Last used ${day(item.lastUsedAt)}` : "Never used"} · {state(item)}</small>
          </div>
          {!item.revokedAt && <button type="button" className="button button-secondary" disabled={busy} onClick={() => revoke(item)} aria-label={`Revoke ${item.name}`}>Revoke</button>}
        </li>)}
      </ul>)}
  </section>;
}
