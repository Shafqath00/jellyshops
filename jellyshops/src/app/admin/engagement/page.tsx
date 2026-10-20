"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";

interface Enquiry { id: string; name: string; email: string; message: string; status: "NEW" | "READ" | "CLOSED"; revision: number; createdAt: string }
const apiOrigin = (process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
export default function EngagementPage() {
  const { activeStore, session } = useAuth();
  const [items, setItems] = useState<Enquiry[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const storeId = activeStore?.id ?? ""; const token = session?.access_token;
  const load = useCallback(async () => {
    if (!storeId || !token) return [] as Enquiry[];
    const response = await fetch(`${apiOrigin}/api/stores/${encodeURIComponent(storeId)}/engagement/enquiries`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as { enquiries?: Enquiry[]; error?: { message?: string } };
    if (!response.ok) throw new Error(data.error?.message ?? "Unable to load contact messages.");
    return data.enquiries ?? [];
  }, [storeId, token]);
  useEffect(() => {
    let active = true;
    void load().then((nextItems) => { if (active) setItems(nextItems); }).catch((caught: unknown) => {
      if (active) setError(caught instanceof Error ? caught.message : "Unable to load messages.");
    });
    return () => { active = false; };
  }, [load]);
  async function update(item: Enquiry, status: Enquiry["status"]) {
    if (!storeId || !token) return;
    setBusy(true); setError(undefined);
    try {
      const response = await fetch(`${apiOrigin}/api/stores/${encodeURIComponent(storeId)}/engagement/enquiries/${encodeURIComponent(item.id)}`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status, revision: item.revision }) });
      const data = await response.json() as Enquiry | { error?: { message?: string } };
      if (!response.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Unable to update this message.");
      setItems((current) => current.map((entry) => entry.id === item.id ? data as Enquiry : entry));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update this message."); }
    finally { setBusy(false); }
  }
  async function exportSubscribers() {
    if (!storeId || !token) return;
    setBusy(true); setError(undefined);
    try {
      const response = await fetch(`${apiOrigin}/api/stores/${encodeURIComponent(storeId)}/engagement/subscribers.csv`, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error("Subscriber export is unavailable.");
      const url = URL.createObjectURL(await response.blob()); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${activeStore?.slug ?? "store"}-subscribers.csv`; anchor.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to download subscribers."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-6xl p-6 md:p-8"><header className="mb-6 flex items-center justify-between gap-4"><div className="flex items-center gap-3"><Link href="/admin" aria-label="Back to dashboard" className="grid size-9 place-items-center rounded-lg border bg-white"><ArrowLeft size={16} /></Link><div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">Customers</p><h1 className="text-2xl font-semibold">Messages &amp; subscribers</h1></div></div><button className="button button-secondary" type="button" onClick={() => void exportSubscribers()} disabled={busy}><Download size={16} /> Export subscribers</button></header>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}<button className="ml-3 underline" onClick={() => { setError(undefined); void load().then(setItems).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to load messages.")); }}>Retry</button></p>}
    <section className="grid gap-3">{items.map((item) => <article key={item.id} className="rounded-xl border border-[#e3e3e3] bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-[#69707d]">{new Date(item.createdAt).toLocaleString()} · {item.status.toLowerCase()}</p><h2 className="mt-1 font-semibold">{item.name}</h2><a className="text-sm underline" href={`mailto:${encodeURIComponent(item.email)}`}>{item.email}</a></div><label className="text-sm">Status <select aria-label={`Status for ${item.name}`} value={item.status} disabled={busy} className="ml-2 rounded-md border p-2" onChange={(event) => void update(item, event.target.value as Enquiry["status"])}><option value="NEW">New</option><option value="READ">Read</option><option value="CLOSED">Closed</option></select></label></div><p className="mt-4 whitespace-pre-wrap text-sm leading-6">{item.message}</p></article>)}{!items.length && !error && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-[#69707d]">No contact enquiries yet. Messages submitted through your storefront will appear here.</p>}</section>
  </main>;
}
