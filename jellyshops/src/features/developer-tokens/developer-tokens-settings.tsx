"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, KeyRound } from "lucide-react";
import { Banner, Button, Card, ConfirmDialog, EmptyState, Field, SkeletonBlock, StatusBadge, useToast } from "@/components/admin";
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

const expired = (token: DeveloperTokenSummary) => Boolean(token.expiresAt && new Date(token.expiresAt).getTime() <= Date.now());
function state(token: DeveloperTokenSummary): string {
  if (token.revokedAt) return `Revoked ${day(token.revokedAt)}`;
  if (expired(token)) return `Expired ${day(token.expiresAt)}`;
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
  const [revoking, setRevoking] = useState<DeveloperTokenSummary | null>(null);
  const [attempt, setAttempt] = useState(0);
  const toast = useToast();

  const fetchList = useCallback((signal?: AbortSignal) => fetcher(url, { signal, headers: { Authorization: `Bearer ${token}` } })
    .then((response) => read<{ tokens: DeveloperTokenSummary[] }>(response, "Could not load the developer tokens."))
    .then((body) => body.tokens), [url, token, fetcher]);

  useEffect(() => {
    const controller = new AbortController();
    fetchList(controller.signal)
      .then((list) => { setTokens(list); setError(""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load the developer tokens."); });
    return () => controller.abort();
  }, [fetchList, attempt]);

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

  /** Throws on failure so the confirm dialog stays open and says why. */
  async function revoke(item: DeveloperTokenSummary) {
    const response = await fetcher(`${url}/${encodeURIComponent(item.id)}/revoke`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) await read(response, "Could not switch the token off. Try again.");
    if (created) setCreated(null);
    setTokens(await fetchList());
    toast(`${item.name} switched off`);
  }

  async function copy() {
    if (!created) return;
    try { await navigator.clipboard.writeText(created.token); setCopied(true); toast("Token copied"); } catch { setCopied(false); }
  }

  if (!tokens) return <Card title="Developer tokens">
    {error
      ? <Banner tone="critical" title="Could not load the tokens" action={<Button size="small" onClick={() => { setError(""); setAttempt((count) => count + 1); }}>Try again</Button>}>{error}</Banner>
      : <div className="jk-stack-sm" role="status" aria-label="Loading developer tokens"><SkeletonBlock width="40%" height={14} /><SkeletonBlock height={34} /><SkeletonBlock height={34} /></div>}
  </Card>;

  return <>
    {error && <Banner tone="critical" onDismiss={() => setError("")}>{error}</Banner>}
    {created && <Banner tone="success" title={`Copy the token for “${created.name}” now`}>
      <p>It will not be shown again. Send it to your developer in a private message.</p>
      <p><code className="jk-code" aria-label="New developer token">{created.token}</code></p>
      <div className="jk-banner-action"><Button size="small" icon={<Copy size={14} aria-hidden="true" />} onClick={() => void copy()}>{copied ? "Copied" : "Copy token"}</Button></div>
    </Banner>}
    <Card title="Create a token" description={<>A developer uses it with <code>jelly-theme upload</code> and <code>jelly-theme install</code>. It works only on this store&apos;s store designs. Treat it like a password: anyone who has it can upload designs to this store.</>}>
      <form className="jk-stack-sm" onSubmit={(event) => void create(event)}>
        <div className="jk-grid-2">
          <Field id="developer-token-name" label="Name" required help="Who or what uses it, so you know which one to switch off later.">
            <input id="developer-token-name" name="name" required maxLength={80} placeholder="Studio laptop" />
          </Field>
          <Field id="developer-token-expiry" label="Stops working" help="A shorter time is safer.">
            <select id="developer-token-expiry" name="expiry" defaultValue="90"><option value="30">After 30 days</option><option value="90">After 90 days</option><option value="365">After a year</option><option value="">Never</option></select>
          </Field>
        </div>
        <div className="jk-row"><Button type="submit" variant="primary" loading={busy}>Create token</Button></div>
      </form>
    </Card>
    <Card title="Your tokens" flush>
      {tokens.length === 0
        ? <EmptyState icon={KeyRound} title="No tokens yet." description="Create one above when a developer needs to upload a store design for you." />
        : <ul className="jk-rows" aria-label="Developer tokens">
          {tokens.map((item) => <li key={item.id} className="jk-rows-item">
            <div className="min-w-0 flex-1">
              <p className="jk-row"><strong>{item.name}</strong><code className="jk-code">{item.prefix}…</code>{item.revokedAt ? <StatusBadge tone="neutral">Switched off</StatusBadge> : expired(item) ? <StatusBadge tone="warning">Expired</StatusBadge> : <StatusBadge tone="success">Working</StatusBadge>}</p>
              <p className="jk-cell-sub">Created {day(item.createdAt)} · {item.lastUsedAt ? `Last used ${day(item.lastUsedAt)}` : "Never used"} · {state(item)}</p>
            </div>
            {!item.revokedAt && <Button size="small" variant="destructive-quiet" onClick={() => setRevoking(item)} aria-label={`Revoke ${item.name}`}>Switch off</Button>}
          </li>)}
        </ul>}
    </Card>
    <ConfirmDialog open={Boolean(revoking)} onOpenChange={(open) => { if (!open) setRevoking(null); }} title={`Switch off “${revoking?.name ?? "this token"}”?`}
      description="Anything that uses this token stops working straight away. This cannot be undone, but you can create a new token at any time."
      confirmLabel="Switch off token" destructive onConfirm={async () => { if (revoking) await revoke(revoking); }} />
  </>;
}
