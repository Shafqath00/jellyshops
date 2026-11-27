"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowRight, FileUp } from "lucide-react";
import { AdminPage, Banner, Button, ConfirmDialog, EmptyState, Field, HelpTip, IndexTable, useToast, type IndexColumn } from "@/components/admin";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { normaliseRedirectFrom, redirectProblem, storeUrl } from "@jelly/storefront-schema";
import { useStorePreferencesApi, type RedirectImportResult, type UrlRedirect } from "./api";

const PAGE_SIZE = 50;

/** The store's own addresses, so a pasted full link to the store becomes a path. */
function ownHosts(slug: string): string[] {
  try { return slug ? [new URL(storeUrl(slug)).host] : []; } catch { return []; }
}

function RedirectDialog({ open, onOpenChange, editing, slug, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; editing: UrlRedirect | null; slug: string; onSaved: (redirect: UrlRedirect) => void }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="jk-overlay" />
      <DialogPrimitive.Content className="jk-dialog" aria-describedby={undefined}>
        {/* The form mounts each time the dialog opens, so it always starts from the redirect being edited. */}
        {open && <RedirectForm editing={editing} slug={slug} onSaved={onSaved} />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

function RedirectForm({ editing, slug, onSaved }: { editing: UrlRedirect | null; slug: string; onSaved: (redirect: UrlRedirect) => void }) {
  const api = useStorePreferencesApi();
  const [from, setFrom] = useState(editing?.from ?? "");
  const [to, setTo] = useState(editing?.to ?? "");
  const [checked, setChecked] = useState(false);
  const [serverError, setServerError] = useState<{ path: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const hosts = ownHosts(slug);
  const problem = redirectProblem(from, to, hosts);
  const fromProblem = serverError?.path === "from" ? serverError.message : checked && problem && /old address|always a page|same/.test(problem) ? problem : undefined;
  const toProblem = serverError?.path === "to" ? serverError.message : checked && problem && !fromProblem ? problem : undefined;
  const base = slug ? storeUrl(slug) : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setChecked(true); setServerError(null);
    if (problem) return;
    const fromPath = normaliseRedirectFrom(from, hosts) ?? from;
    setSaving(true);
    try {
      onSaved(editing ? await api.updateRedirect(editing.id, fromPath, to) : await api.createRedirect(fromPath, to));
    } catch (error) {
      const issue = (error as { problems?: { path: string; message: string }[] }).problems?.[0];
      setServerError(issue ?? { path: "to", message: error instanceof Error ? error.message : "Could not save the redirect." });
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={(event) => void submit(event)} noValidate>
    <DialogPrimitive.Title className="jk-dialog-title">{editing ? "Edit redirect" : "Add a redirect"}</DialogPrimitive.Title>
    <div className="jk-dialog-body jk-stack-sm">
      <p className="jk-muted">Send shoppers who open an old address to a new one. Redirects only apply when the old address no longer shows a page.</p>
      <Field id="redirect-from" label={<>Old address <HelpTip>The part after your store&apos;s address, or the whole link. For example /products/old-bed.</HelpTip></>}
        help={<>For example: <span className="jk-code">/products/old-bed</span></>} error={fromProblem}>
        <input id="redirect-from" value={from} autoFocus placeholder="/old-page" autoComplete="off" onChange={(event) => { setFrom(event.target.value); setServerError(null); }} />
      </Field>
      <Field id="redirect-to" label="Send shoppers to" help={<>A page on your store, like <span className="jk-code">/collections/beds</span>, or a full https:// address.</>} error={toProblem}>
        <input id="redirect-to" value={to} placeholder="/collections/beds" autoComplete="off" onChange={(event) => { setTo(event.target.value); setServerError(null); }} />
      </Field>
      {!problem && base && <p className="jk-muted jk-pref-redirect-example">{base}{normaliseRedirectFrom(from, hosts)} <ArrowRight size={12} aria-label="goes to" /> {to.startsWith("https://") ? to : `${base}${to.startsWith("/") ? to : `/${to}`}`}</p>}
    </div>
    <div className="jk-dialog-footer">
      <DialogPrimitive.Close asChild><button type="button" className="jk-button">Cancel</button></DialogPrimitive.Close>
      <Button type="submit" variant="primary" loading={saving} loadingLabel="Saving…">{editing ? "Save redirect" : "Add redirect"}</Button>
    </div>
  </form>;
}

function ImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: (result: RedirectImportResult) => void }) {
  return <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="jk-overlay" />
      <DialogPrimitive.Content className="jk-dialog jk-dialog-wide" aria-describedby={undefined}>
        {open && <ImportForm onImported={onImported} />}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

function ImportForm({ onImported }: { onImported: (result: RedirectImportResult) => void }) {
  const api = useStorePreferencesApi();
  const input = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [replace, setReplace] = useState(false);
  const [check, setCheck] = useState<RedirectImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function readFile(file: File) {
    setError(""); setCheck(null);
    if (file.size > 1_000_000) { setError("The file is too large. Split it into files of up to 1 MB."); return; }
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    await run(text, false, replace);
  }
  async function run(text: string, apply: boolean, replaceExisting: boolean) {
    setBusy(true); setError("");
    try {
      const result = await api.importRedirects(text, { apply, replace: replaceExisting });
      if (apply) onImported(result); else setCheck(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not read the file.");
    } finally {
      setBusy(false);
    }
  }
  const problems = check?.rows.filter((row) => row.problem) ?? [];
  const good = check ? check.added + check.replaced : 0;

  return <>
    <DialogPrimitive.Title className="jk-dialog-title">Import redirects</DialogPrimitive.Title>
    <div className="jk-dialog-body jk-stack-sm">
      <p className="jk-muted">Upload a CSV file with two columns: the old address and where it should go. A heading row is fine. Nothing is saved until you confirm.</p>
      <pre className="jk-code jk-pref-csv-example">{"Redirect from,Redirect to\n/old-beds,/collections/beds\n/products/oak-bed-2019,/products/oak-bed"}</pre>
      <div className="jk-row">
        <Button onClick={() => input.current?.click()} loading={busy && !check} loadingLabel="Checking…"><FileUp size={14} aria-hidden="true" /> {fileName ? "Choose another file" : "Choose CSV file"}</Button>
        {fileName && <span className="jk-muted">{fileName}</span>}
        <input ref={input} type="file" accept=".csv,text/csv" hidden aria-label="CSV file of redirects" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readFile(file); event.target.value = ""; }} />
      </div>
      <label className="jk-check"><input type="checkbox" checked={replace} onChange={(event) => { setReplace(event.target.checked); if (csv) void run(csv, false, event.target.checked); }} />
        <span><span className="jk-strong">Replace existing redirects</span><br /><small className="jk-muted">If an old address already has a redirect, use the one from the file.</small></span></label>
      {error && <Banner tone="critical" title="Couldn't import">{error}</Banner>}
      {check && <div role="status" className="jk-stack-sm">
        <p><span className="jk-strong">{good} {good === 1 ? "redirect is" : "redirects are"} ready</span>{check.replaced ? ` (${check.replaced} replacing existing ones)` : ""}{problems.length ? `, ${problems.length} ${problems.length === 1 ? "row needs" : "rows need"} attention and will be skipped.` : "."}</p>
        {problems.length > 0 && <div className="jk-table-scroll"><table className="jk-table jk-preview-table">
          <thead><tr><th scope="col">Row</th><th scope="col">Old address</th><th scope="col">Problem</th></tr></thead>
          <tbody>{problems.slice(0, 50).map((row) => <tr key={row.line}><td>{row.line}</td><td className="jk-code">{row.from || "(empty)"}</td><td>{row.problem}</td></tr>)}</tbody>
        </table></div>}
        {problems.length > 50 && <p className="jk-muted">Showing the first 50 problems.</p>}
      </div>}
    </div>
    <div className="jk-dialog-footer">
      <DialogPrimitive.Close asChild><button type="button" className="jk-button">Cancel</button></DialogPrimitive.Close>
      <Button variant="primary" disabled={!check || good === 0} loading={busy && Boolean(check)} loadingLabel="Importing…" onClick={() => void run(csv, true, replace)}>
        {good ? `Import ${good} ${good === 1 ? "redirect" : "redirects"}` : "Import"}
      </Button>
    </div>
  </>;
}

/** Settings > Store preferences > URL redirects: list, search, add, edit, remove and import from CSV. */
export function RedirectsManager() {
  const api = useStorePreferencesApi();
  const { activeStore } = useAuth();
  const toast = useToast();
  const slug = activeStore?.slug ?? "";
  const [rows, setRows] = useState<UrlRedirect[]>([]);
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [editing, setEditing] = useState<UrlRedirect | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState<string[] | null>(null);
  const { listRedirects } = api;

  // The list for the current search and page; "loading" until that exact list has arrived.
  const key = `${search}|${offset}|${tick}`;
  const loading = loadedKey !== key;
  const load = useCallback(async () => { setTick((value) => value + 1); }, []);
  useEffect(() => {
    if (!api.ready) return;
    let live = true;
    listRedirects({ q: search, offset, limit: PAGE_SIZE }).then((page) => {
      if (!live) return;
      setRows(page.redirects); setTotal(page.total); setAvailable(page.available); setError(""); setLoadedKey(key);
    }).catch((failure: unknown) => {
      if (!live) return;
      setError(failure instanceof Error ? failure.message : "Could not load redirects."); setLoadedKey(key);
    });
    return () => { live = false; };
  }, [api.ready, listRedirects, search, offset, key]);

  // Search as the owner types, after a short pause.
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setOffset(0); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  async function remove(ids: string[]) {
    try {
      const removed = await api.removeRedirects(ids);
      toast(removed === 1 ? "Redirect removed" : `${removed} redirects removed`);
      await load();
    } catch (failure) {
      toast(failure instanceof Error ? failure.message : "Could not remove the redirects.", { tone: "critical" });
    }
  }

  const base = slug ? storeUrl(slug) : "";
  const columns: IndexColumn<UrlRedirect>[] = [
    { id: "from", header: "Old address", mobile: "primary", cell: (row) => <button type="button" className="jk-link jk-code" onClick={() => setEditing(row)} title={`${base}${row.from}`}>{row.from}</button> },
    { id: "to", header: "Goes to", cell: (row) => <span className="jk-code">{row.to}</span> },
    { id: "actions", header: "", align: "end", cell: (row) => <span className="jk-row"><Button size="small" variant="quiet" onClick={() => setEditing(row)} aria-label={`Edit redirect from ${row.from}`}>Edit</Button><Button size="small" variant="destructive-quiet" onClick={() => setRemoving([row.id])} aria-label={`Remove redirect from ${row.from}`}>Remove</Button></span> },
  ];

  return <AdminPage title="URL redirects" width="full" back={{ href: "/admin/settings/preferences/advanced", label: "Site preferences" }}
    description="Keep old links working when you rename or remove pages. Shoppers and search engines are sent to the new address."
    primaryAction={{ label: "Add redirect", onAction: () => setAdding(true), disabled: !available }}
    secondaryActions={[{ label: "Import CSV", onAction: () => setImporting(true), disabled: !available }]}>
    {!available && <Banner tone="warning" title="Not ready yet">Redirects are being set up for your store. Please try again later.</Banner>}
    <Banner tone="info">Renamed pages, blog posts and your store address already keep their old links working automatically. Use redirects for anything else, such as links from an old website.</Banner>
    <IndexTable label="Redirects" rows={rows} rowKey={(row) => row.id} rowLabel={(row) => `Redirect from ${row.from}`} columns={columns}
      loading={loading} error={error} onRetry={() => void load()}
      search={{ value: query, onChange: setQuery, placeholder: "Search old or new addresses", label: "Search redirects" }}
      bulkActions={[{ label: "Remove", destructive: true, onAction: (ids) => setRemoving(ids) }]}
      emptyState={search
        ? <EmptyState title="No redirects match" description="Try a different part of the address." />
        : <EmptyState title="No redirects yet" description="Add one when you move or remove a page, or import a list from your old website." action={<Button variant="primary" onClick={() => setAdding(true)}>Add redirect</Button>} />}
      pagination={total > PAGE_SIZE ? { summary: `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}`, hasPrevious: offset > 0, hasNext: offset + PAGE_SIZE < total, onPrevious: () => setOffset(Math.max(0, offset - PAGE_SIZE)), onNext: () => setOffset(offset + PAGE_SIZE) } : undefined} />
    <RedirectDialog open={adding || editing !== null} onOpenChange={(open) => { if (!open) { setAdding(false); setEditing(null); } }} editing={editing} slug={slug}
      onSaved={(redirect) => { toast(editing ? "Redirect saved" : `Redirect added: ${redirect.from}`); setAdding(false); setEditing(null); void load(); }} />
    <ImportDialog open={importing} onOpenChange={setImporting}
      onImported={(result) => { setImporting(false); toast(`${result.added + result.replaced} ${result.added + result.replaced === 1 ? "redirect" : "redirects"} imported`); setOffset(0); void load(); }} />
    <ConfirmDialog open={removing !== null} onOpenChange={(open) => { if (!open) setRemoving(null); }} destructive
      title={removing && removing.length > 1 ? `Remove ${removing.length} redirects?` : "Remove this redirect?"}
      description="Shoppers who open the old address will see the “page not found” page instead. You can add it again later."
      confirmLabel="Remove" onConfirm={() => { const ids = removing; setRemoving(null); if (ids) void remove(ids); }} />
  </AdminPage>;
}
