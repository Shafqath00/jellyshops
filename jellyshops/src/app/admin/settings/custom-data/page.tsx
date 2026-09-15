"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDemoSession } from "@/features/store-editor/api/demo-session";

interface MetafieldDefinition {
  id: string;
  ownerType: string;
  namespace: string;
  key: string;
  name: string;
  description?: string;
  type: string;
  storefrontVisible: boolean;
  archivedAt: string | null;
}

const storeId = "store-demo";
const ownerTypes = ["store", "product", "variant", "collection", "page", "blog", "article"] as const;

export default function CustomDataSettingsPage() {
  const token = getDemoSession()?.token;
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const [ownerType, setOwnerType] = useState<(typeof ownerTypes)[number]>("product");
  const [definitions, setDefinitions] = useState<MetafieldDefinition[]>([]);
  const [error, setError] = useState<string>();
  const headers = useMemo(() => token ? { Authorization: `Bearer ${token}` } : null, [token]);

  useEffect(() => {
    if (!headers) return;
    let active = true;
    void fetch(`${origin}/api/stores/${storeId}/custom-data/metafields?ownerType=${encodeURIComponent(ownerType)}`, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Custom data request failed (${response.status})`);
        return await response.json() as MetafieldDefinition[];
      })
      .then((next) => { if (active) setDefinitions(next); })
      .catch((reason: unknown) => active && setError(reason instanceof Error ? reason.message : "Unable to load custom data"));
    return () => { active = false; };
  }, [headers, origin, ownerType]);

  if (!headers) return <main className="p-8">Custom Data is unavailable until merchant authentication is connected.</main>;

  return (
    <main className="mx-auto max-w-5xl p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin/settings" aria-label="Back to settings" className="grid size-9 place-items-center rounded-lg border border-[#d7d7d7] bg-white"><ArrowLeft size={16} /></Link>
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8c9196]">Settings</p><h1 className="text-2xl font-semibold tracking-[-0.03em]">Custom data</h1></div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {ownerTypes.map((type) => (
          <button key={type} type="button" onClick={() => setOwnerType(type)} className={`h-8 rounded-lg border px-3 text-[11px] font-semibold capitalize ${type === ownerType ? "border-[#303030] bg-[#303030] text-white" : "border-[#d7d7d7] bg-white"}`}>{type}</button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="overflow-hidden rounded-xl border border-[#e3e3e3] bg-white">
        <header className="grid grid-cols-[minmax(0,1fr)_140px_120px] gap-3 border-b border-[#eeeeee] bg-[#fafafa] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]"><span>Definition</span><span>Type</span><span>Visibility</span></header>
        <div className="divide-y divide-[#eeeeee]">
          {definitions.map((definition) => (
            <div key={definition.id} className="grid grid-cols-[minmax(0,1fr)_140px_120px] items-center gap-3 px-4 py-3">
              <div className="min-w-0"><p className="truncate text-[12px] font-medium text-[#303030]">{definition.name}</p><p className="truncate text-[10px] text-[#8c9196]">{definition.namespace}.{definition.key}</p></div>
              <span className="truncate text-[11px] text-[#616161]">{definition.type}</span>
              <span className="text-[11px] text-[#616161]">{definition.storefrontVisible ? "Storefront" : "Admin only"}</span>
            </div>
          ))}
          {definitions.length === 0 && <p className="p-8 text-center text-sm text-[#8c9196]">No metafield definitions for {ownerType}.</p>}
        </div>
      </section>
      <p className="mt-4 text-[11px] text-[#8c9196]">Stable namespace/key identifiers are preserved after creation; definitions used by storefront bindings are not renamed implicitly.</p>
    </main>
  );
}
