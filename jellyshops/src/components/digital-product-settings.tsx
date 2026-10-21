"use client";
import { useEffect, useState } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/auth-provider";
interface Asset { id: string; filename: string; sizeBytes: number; maxDownloads: number | null; expiresAfterDays: number | null }
interface DigitalProduct { fulfillmentType: "PHYSICAL" | "DIGITAL"; assets: Asset[] }
export function DigitalProductSettings({ productId }: { productId: string }) {
  const { session, activeStore } = useAuth();
  const token = session?.access_token; const storeId = activeStore?.id;
  const [data, setData] = useState<DigitalProduct | null>(null);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [maxDownloads, setMaxDownloads] = useState(""); const [expiry, setExpiry] = useState(""); const [file, setFile] = useState<File | null>(null);
  const endpoint = `${authApiOrigin()}/api/stores/${storeId}/digital-products/${productId}`;
  async function request(path = "", init: RequestInit = {}) {
    const response = await fetch(endpoint + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init.headers } });
    if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error?.message ?? body?.message ?? "Could not update digital delivery."); }
    return response.status === 204 ? null : response.json();
  }
  useEffect(() => { if (!token || !storeId) return; let active = true; void fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => { if (!response.ok) throw new Error("Could not load delivery settings."); return response.json() as Promise<DigitalProduct>; }).then((value) => { if (active) setData(value); }).catch((e: Error) => { if (active) setError(e.message); }); return () => { active = false; }; }, [endpoint, token, storeId]);
  async function mutate(action: () => Promise<unknown>) { setBusy(true); setError(""); try { await action(); setData(await request()); } catch (e) { setError(e instanceof Error ? e.message : "Could not save delivery settings."); } finally { setBusy(false); } }
  return <section className="rounded-2xl border border-border bg-card p-6 space-y-4" aria-labelledby="delivery-settings-title">
    <h2 id="delivery-settings-title" className="font-bold text-lg">Product delivery</h2>
    <p className="text-sm text-muted-foreground">Private digital files become available after verified payment. Changes apply to future orders.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data ? <p aria-live="polite">Loading delivery settings…</p> : <>
      <label className="flex flex-col gap-2 text-sm">Delivery type<select className="rounded-lg border border-border bg-background p-2" value={data.fulfillmentType} disabled={busy} onChange={(e) => void mutate(() => request("", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fulfillmentType: e.target.value }) }))}><option value="PHYSICAL">Physical product</option><option value="DIGITAL">Digital download</option></select></label>
      {data.fulfillmentType === "DIGITAL" && <>
        {data.assets.length === 0 && <p className="text-sm text-amber-700">Upload a file before accepting digital orders.</p>}
        <ul className="divide-y divide-border">{data.assets.map((asset) => <li key={asset.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{asset.filename}<small className="block text-muted-foreground">{Math.ceil(Number(asset.sizeBytes) / 1024)} KB · {asset.maxDownloads ?? "Unlimited"} downloads · {asset.expiresAfterDays ? `${asset.expiresAfterDays} days` : "No expiry"}</small></span><button type="button" disabled={busy} onClick={() => void mutate(() => request(`/assets/${asset.id}`, { method: "DELETE" }))} className="underline">Remove</button></li>)}</ul>
        <label className="block text-sm">Private file (maximum 50 MB)<input type="file" disabled={busy} className="block mt-2 w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Download limit<input aria-label="Download limit" type="number" min="1" placeholder="Unlimited" value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value)} className="block mt-2 w-full rounded-lg border border-border p-2" /></label><label className="text-sm">Expires after days<input aria-label="Expires after days" type="number" min="1" placeholder="No expiry" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="block mt-2 w-full rounded-lg border border-border p-2" /></label></div>
        <button type="button" disabled={busy || !file} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50" onClick={() => void mutate(async () => { if (!file) return; const form = new FormData(); form.append("file", file); form.append("maxDownloads", maxDownloads); form.append("expiresAfterDays", expiry); await request("/assets", { method: "POST", body: form }); setFile(null); })}>{busy ? "Saving…" : "Upload private file"}</button>
      </>}
    </>}
  </section>;
}
