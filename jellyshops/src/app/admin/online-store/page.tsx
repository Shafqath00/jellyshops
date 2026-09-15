"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Edit3, Leaf, Plus, Sparkles, Store } from "lucide-react";
import type { ThemePackId } from "@jelly/storefront-registry";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { getDemoSession } from "@/features/store-editor/api/demo-session";
import type { StorefrontTemplateRecord } from "@/features/store-editor/api/types";
import { createThemePackLayout } from "@/features/store-editor/theme-pack-workspace";
import { useShop } from "@/contexts/shop-context";

const storeId = "store-demo";
const packs: Array<{ id: ThemePackId; name: string; descriptor: string; caption: string; classes: string; badges: string[] }> = [
  { id: "fresh-market", name: "Fresh Market", descriptor: "Bright, generous and ingredient-led.", caption: "For food, wellness, and everyday essentials.", classes: "from-[#e8f3d6] via-[#f9f2d5] to-[#f1b683]", badges: ["Category-led", "High-conversion", "Warm"] },
  { id: "artisan-boutique", name: "Artisan Boutique", descriptor: "Editorial, tactile and quietly luxurious.", caption: "For makers, gifting, home, and considered retail.", classes: "from-[#282124] via-[#79535e] to-[#e2c9b0]", badges: ["Editorial", "Story-led", "Refined"] },
];

function MiniStorePreview({ pack }: { pack: typeof packs[number] }) {
  const artisan = pack.id === "artisan-boutique";
  return <div className={`relative h-64 overflow-hidden bg-gradient-to-br ${pack.classes} p-4`}>
    <div className="absolute inset-x-7 top-7 overflow-hidden rounded-[5px] bg-[#fffdf8] shadow-2xl">
      <div className="flex h-8 items-center justify-between border-b border-black/10 px-3 text-[7px] font-bold text-[#242124]"><span>{artisan ? "THE ATELIER" : "FRESHLY PICKED"}</span><span>SHOP · JOURNAL · ABOUT</span></div>
      <div className={`grid min-h-36 grid-cols-[1.1fr_.9fr] ${artisan ? "bg-[#e8d4c1]" : "bg-[#d8e6b5]"}`}>
        <div className="flex flex-col justify-end p-4"><span className="mb-2 text-[7px] font-bold uppercase tracking-[.2em]">{artisan ? "Objects with a story" : "The good stuff, every day"}</span><strong className={`text-xl leading-[.85] ${artisan ? "font-serif" : "font-sans"}`}>{artisan ? "Made for slow moments" : "Better pantry. Brighter day."}</strong><span className="mt-3 w-fit rounded-full bg-[#252126] px-2 py-1 text-[7px] font-bold text-white">SHOP NOW</span></div>
        <div className={`relative ${artisan ? "bg-[#5d3f48]" : "bg-[#ed965d]"}`}><div className="absolute bottom-4 left-4 h-20 w-20 rounded-full border-[10px] border-white/30" /><div className="absolute right-4 top-5 h-28 w-16 rounded-t-full bg-white/60" /></div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-3">{[1, 2, 3].map((item) => <div key={item} className="space-y-1"><div className={`h-10 rounded-sm ${artisan ? "bg-[#ba9983]" : "bg-[#9ac897]"}`} /><div className="h-1.5 w-3/4 rounded bg-black/20" /></div>)}</div>
    </div>
  </div>;
}

export default function OnlineStorePage() {
  const { state } = useShop();
  const session = getDemoSession();
  const activeStore = state.stores.find((store) => store.id === state.activeStoreId) ?? state.stores[0];
  const api = useMemo(() => session?.token ? createStoreEditorApi({ baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token: session.token }) : null, [session?.token]);
  const [templates, setTemplates] = useState<StorefrontTemplateRecord[]>([]);
  const [installing, setInstalling] = useState<ThemePackId>();
  const [installed, setInstalled] = useState<ThemePackId>();
  const [error, setError] = useState<string>();

  useEffect(() => { if (api) void api.listTemplates(storeId).then(setTemplates).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load your theme")); }, [api]);

  const install = async (packId: ThemePackId) => {
    if (!api) return;
    const home = templates.find((template) => template.type === "home");
    if (!home) { setError("Your home template is still loading. Please try again."); return; }
    setInstalling(packId); setError(undefined);
    try {
      const result = await api.updateTemplate(storeId, home.id, home.revision, { name: packs.find((pack) => pack.id === packId)?.name ?? "Store theme", layout: createThemePackLayout(packId) });
      setTemplates((current) => current.map((template) => template.id === home.id ? result.template : template));
      setInstalled(packId);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Theme installation failed. Please try again."); }
    finally { setInstalling(undefined); }
  };

  return <main className="mx-auto max-w-6xl space-y-9 px-5 py-7">
    <header className="flex items-start justify-between gap-4"><div><p className="text-sm text-[#6d7175]">Sales channel</p><h1 className="mt-1 text-2xl font-semibold text-[#202223]">Online Store</h1></div><Link href={activeStore ? `/${activeStore.slug}` : "/"} className="inline-flex items-center gap-2 rounded-lg border border-[#c9cccf] bg-white px-3 py-2 text-sm font-medium"><Store size={16} />View store<ArrowUpRight size={14} /></Link></header>
    <section className="overflow-hidden rounded-2xl border border-[#dfe3e8] bg-white shadow-sm"><div className="grid md:grid-cols-[1.45fr_1fr]"><div className="relative min-h-72 overflow-hidden bg-[#172a1b] p-7 text-white"><div className="absolute -right-14 -top-16 h-64 w-64 rounded-full bg-[#b8dc71] opacity-90" /><div className="absolute bottom-[-90px] right-20 h-64 w-64 rounded-full bg-[#ef9f70] opacity-90" /><div className="relative max-w-md"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#d4eea7]"><Leaf size={15} />Your storefront, your way</p><h2 className="mt-6 text-4xl font-semibold tracking-tight">Choose a complete storefront — then make every part yours.</h2><p className="mt-4 text-sm leading-6 text-white/75">Start with a full ecommerce foundation: storytelling, collections, product discovery, search, cart, and the sections your brand needs.</p></div></div><div className="flex flex-col justify-between p-7"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#6d7175]">Theme editor</p><h2 className="mt-3 text-2xl font-semibold">Built to be changed</h2><p className="mt-3 text-sm leading-6 text-[#6d7175]">Select a section, edit its text, buttons, colors, and media, then save and publish from one workspace.</p></div><Link href="/admin/online-store/editor" className="mt-7 inline-flex w-fit items-center gap-2 rounded-lg bg-[#202223] px-4 py-2.5 text-sm font-semibold text-white"><Edit3 size={15} />Open theme editor<ArrowRight size={15} /></Link></div></div></section>
    <section><div className="mb-5"><p className="flex items-center gap-2 text-sm font-semibold text-[#5c6d34]"><Sparkles size={16} />Two complete templates</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">Pick your starting point</h2><p className="mt-2 text-sm text-[#6d7175]">Installing replaces the current Home page layout. Your existing product data remains untouched.</p></div>
      {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-6 md:grid-cols-2">{packs.map((pack) => <article key={pack.id} className="overflow-hidden rounded-2xl border border-[#dfe3e8] bg-white shadow-sm"><MiniStorePreview pack={pack} /><div className="p-5"><div className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-semibold">{pack.name}</h3><p className="mt-1 text-sm font-medium text-[#4b5563]">{pack.descriptor}</p></div><span className="rounded-full bg-[#f1f8e9] px-2.5 py-1 text-xs font-semibold text-[#486322]">Full pack</span></div><p className="mt-4 text-sm leading-6 text-[#6d7175]">{pack.caption}</p><div className="mt-4 flex flex-wrap gap-2">{pack.badges.map((badge) => <span key={badge} className="rounded-full border border-[#dfe3e8] px-2.5 py-1 text-xs text-[#5c6268]">{badge}</span>)}</div><div className="mt-6 flex items-center justify-between gap-3">{installed === pack.id ? <Link href="/admin/online-store/editor" className="inline-flex items-center gap-2 text-sm font-semibold text-[#315e24]"><Check size={17} />Installed — edit it</Link> : <span className="text-xs text-[#6d7175]">8 editable home sections</span>}<button type="button" disabled={Boolean(installing) || templates.length === 0} onClick={() => void install(pack.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#202223] bg-[#202223] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{installing === pack.id ? "Installing…" : installed === pack.id ? "Installed" : <><Plus size={15} />Use template</>}</button></div></div></article>)}</div>
    </section>
  </main>;
}
