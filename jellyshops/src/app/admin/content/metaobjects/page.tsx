"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/features/auth/auth-provider";

interface MetaobjectDefinition {
  id: string;
  handle: string;
  name: string;
  storefrontVisible: boolean;
  archivedAt: string | null;
  fields: Array<{ handle: string; name: string; type: string; storefrontVisible: boolean }>;
}

interface MetaobjectEntry {
  id: string;
  handle: string;
  displayName: string;
  archivedAt: string | null;
}

export default function MetaobjectsPage() {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id ?? "";
  const token = session?.access_token;
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const [definitions, setDefinitions] = useState<MetaobjectDefinition[]>([]);
  const [activeId, setActiveId] = useState("");
  const [entries, setEntries] = useState<MetaobjectEntry[]>([]);
  const [error, setError] = useState<string>();
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : null, [token]);

  useEffect(() => {
    if (!headers) return;
    let active = true;
    void fetch(`${origin}/api/stores/${storeId}/custom-data/metaobjects`, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Metaobject request failed (${response.status})`);
        return await response.json() as MetaobjectDefinition[];
      })
      .then((next) => {
        if (!active) return;
        setDefinitions(next);
        setActiveId((current) => current || next.find((definition) => !definition.archivedAt)?.id || next[0]?.id || "");
      })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load metaobjects"));
    return () => { active = false; };
  }, [headers, origin]);

  useEffect(() => {
    if (!headers || !activeId) {
      setEntries([]);
      return;
    }
    let active = true;
    void fetch(`${origin}/api/stores/${storeId}/custom-data/metaobjects/${encodeURIComponent(activeId)}/entries`, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Metaobject entries request failed (${response.status})`);
        return await response.json() as MetaobjectEntry[];
      })
      .then((next) => { if (active) setEntries(next); })
      .catch(() => { if (active) setEntries([]); });
    return () => { active = false; };
  }, [activeId, headers, origin]);

  const definition = definitions.find((entry) => entry.id === activeId);
  if (!headers) return <main className="p-8">Metaobjects are unavailable until merchant authentication is connected.</main>;

  return (
    <main className="mx-auto max-w-6xl p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" aria-label="Back to admin" className="grid size-9 place-items-center rounded-lg border border-[#d7d7d7] bg-white"><ArrowLeft size={16} /></Link>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">Content</p><h1 className="text-2xl font-semibold tracking-[-0.03em]">Metaobjects</h1></div>
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[#e3e3e3] bg-white p-2">
          {definitions.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setActiveId(entry.id)} className={`min-h-10 w-full rounded-lg px-3 text-left text-[12px] ${entry.id === activeId ? "bg-[#eeeeee] font-semibold" : "hover:bg-[#f6f6f7]"}`}>
              <span className="block truncate">{entry.name}</span><span className="text-[9px] text-[#8c9196]">{entry.handle}</span>
            </button>
          ))}
        </aside>
        <section className="rounded-xl border border-[#e3e3e3] bg-white">
          {definition ? (
            <>
              <header className="border-b border-[#eeeeee] px-5 py-4"><h2 className="text-base font-semibold">{definition.name}</h2><p className="mt-1 text-[11px] text-[#8c9196]">{definition.storefrontVisible ? "Available to storefront bindings" : "Admin only"} · {definition.fields.length} fields</p></header>
              <div className="divide-y divide-[#eeeeee]">
                {entries.map((entry) => <div key={entry.id} className="px-5 py-3"><p className="text-[12px] font-medium">{entry.displayName}</p><p className="text-[10px] text-[#8c9196]">{entry.handle}</p></div>)}
                {entries.length === 0 && <p className="p-8 text-center text-sm text-[#8c9196]">No entries yet.</p>}
              </div>
            </>
          ) : <p className="p-8 text-center text-sm text-[#8c9196]">Choose a metaobject definition.</p>}
        </section>
      </div>
    </main>
  );
}
