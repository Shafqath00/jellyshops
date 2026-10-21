"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, Check, CheckCircle2, Eye, LayoutTemplate, Loader2, Palette, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { listV4StarterPacks } from "@jelly/storefront-registry";
import { useAuth } from "@/features/auth/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import type { ThemeCatalogEntry, ThemeConfigurationRecord } from "@/features/store-editor/api/types";
import { TemplateThumbnail, TemplatePreviewDialog } from "@/features/store-editor/components/template-preview";

const starters = listV4StarterPacks();
const editorHref = "/admin/online-store/editor";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#241f20] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#43383b] disabled:cursor-wait disabled:opacity-45";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e8e1dd] bg-white px-4 py-2.5 text-sm font-semibold text-[#241f20] transition hover:bg-[#fff5f2] disabled:opacity-45";

export default function OnlineStorePage() {
  const { activeStore } = useAuth();
  return <StoreDesignLibrary key={activeStore?.id ?? "loading"} />;
}

function StoreDesignLibrary() {
  const router = useRouter();
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id;
  const token = session?.access_token;
  const api = useMemo(() => token && storeId ? createStoreEditorApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token,
  }) : null, [token, storeId]);
  const [themes, setThemes] = useState<ThemeCatalogEntry[]>([]);
  const [configuration, setConfiguration] = useState<ThemeConfigurationRecord | null>(null);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [retry, setRetry] = useState(0);
  const [previewId, setPreviewId] = useState<string>();
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!api || !storeId) return;
    let alive = true;
    void Promise.all([api.listThemeCatalog(storeId), api.getThemeConfiguration(storeId), api.listTemplates(storeId), api.listGlobalSections(storeId), api.listMenus(storeId)])
      .then(([catalog, selected, templates, globals, menus]) => {
        if (!alive) return;
        setThemes(catalog); setConfiguration(selected); setError(undefined);
        setHasWorkspace(Boolean(selected || templates.length || globals.length || menus.length));
      }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "Could not load your templates. Try again."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, storeId, retry]);

  async function selectTheme(theme: ThemeCatalogEntry) {
    if (!api || !storeId || operation.current || !theme.available) return;
    operation.current = true;
    setSaving(theme.id); setError(undefined); setNotice(undefined);
    try {
      const result = await api.saveThemeConfiguration(storeId, configuration?.revision ?? null, {
        themeId: theme.id, themeVersion: theme.version, settings: configuration?.settings ?? {}, draftArtifactId: configuration?.draftArtifactId ?? null,
      });
      if (!mounted.current) return;
      setConfiguration(result.theme);
      setNotice(`${theme.name} selected. Continue editing to customize it, then publish when you’re ready.`);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Could not change your theme. Try again."); }
    finally { operation.current = false; if (mounted.current) setSaving(undefined); }
  }

  async function installStarter(starterId: "fresh-market" | "artisan-boutique" | "jelly-signature") {
    if (!api || !storeId || operation.current) return;
    if (hasWorkspace && !window.confirm("Replace your current draft template and page assignments? Existing templates are retained in the library. Your published store, products, orders, and customer records stay unchanged.")) return;
    operation.current = true;
    setSaving(`starter:${starterId}`); setError(undefined); setNotice(undefined);
    try {
      if (hasWorkspace) {
        const workspace = await api.loadWorkspace(storeId);
        await api.installStarterPack(storeId, starterId, { replaceDraft: true, expectedGeneration: workspace.generation });
      } else await api.installStarterPack(storeId, starterId);
      if (mounted.current) router.push(editorHref);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Could not prepare your template. Try again."); }
    finally { operation.current = false; if (mounted.current) setSaving(undefined); }
  }

  const selectedTheme = themes.find((theme) => theme.id === configuration?.themeId);
  const selectedStarter = starters.find((starter) => starter.id === configuration?.themeId);
  const preview = starters.find((starter) => starter.id === previewId);
  const unavailable = configuration && (!selectedTheme || !selectedTheme.available);

  return (
    <main className="min-h-full bg-[#fffaf6] px-4 py-7 text-[#241f20] sm:px-7 lg:px-10 lg:py-10">
      <div className="mx-auto max-w-[1180px] space-y-9">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#9b5266]"><span className="grid size-6 place-items-center rounded-lg bg-[#ffe3e9]"><LayoutTemplate size={13} /></span>Online store / Templates</p>
            <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">A little more you.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#74686c]">Find your starting point. Add your products, make it your own, and bring your shop to life.</p>
          </div>
          {activeStore && <Link href={`/${activeStore.slug}`} className={secondary}>View store<ArrowUpRight size={15} /></Link>}
        </header>
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button type="button" onClick={() => { setLoading(true); setError(undefined); setRetry((value) => value + 1); }} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 font-semibold"><RefreshCw size={14} />Try again</button></div>}
        {notice && <p role="status" className="flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800"><CheckCircle2 className="mt-1 shrink-0" size={16} />{notice}</p>}
        {loading ? <div aria-label="Loading templates" aria-busy="true" className="grid gap-5 md:grid-cols-2">{[0, 1].map((key) => <div key={key} className="h-80 animate-pulse rounded-3xl border border-[#eee4df] bg-white motion-reduce:animate-none"><div className="m-4 h-44 rounded-2xl bg-[#f4eae6]" /><div className="mx-6 mt-6 h-4 w-1/3 rounded bg-[#f4eae6]" /><div className="mx-6 mt-3 h-3 w-2/3 rounded bg-[#f4eae6]" /></div>)}<span className="sr-only">Loading your storefront designs…</span></div> : error && themes.length === 0 ? null : <>
          {hasWorkspace && <section aria-labelledby="current-design" className="grid overflow-hidden rounded-3xl border border-[#e9ddd8] bg-white lg:grid-cols-2">
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#866052]"><span className="size-2 rounded-full bg-[#c48763]" />Your private design</p>
              <h2 id="current-design" className="text-2xl font-bold tracking-tight">{selectedTheme?.name ?? "Your storefront"}</h2>
              <p className="mt-3 max-w-sm text-sm leading-6 text-[#74686c]">Your shop is taking shape. Pick up where you left off and make every detail feel like your brand.</p>
              <Link href={editorHref} className={`${primary} mt-6 w-fit`}><Pencil size={15} />Continue editing<ArrowRight size={15} /></Link>
              <p className="mt-4 text-xs leading-5 text-[#8a7b80]">Edits stay private until you publish.</p>
            </div>
            <div className="bg-[#f5ebe6] p-5 sm:p-7"><TemplateThumbnail key={configuration?.themeId} id={configuration?.themeId ?? "minimal"} name={selectedTheme?.name ?? "Your storefront"} image={selectedStarter?.previewAsset ?? selectedTheme?.previewAsset} /></div>
          </section>}
          <section aria-labelledby="template-gallery">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#9b5266]">Made for your next chapter</p><h2 id="template-gallery" className="text-2xl font-bold tracking-tight">{hasWorkspace ? "Explore storefront templates" : "Choose your starting point"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#74686c]">{hasWorkspace ? "Browse for inspiration. Edit your current storefront, or change its appearance below." : "Complete, ready-to-edit layouts. Your photos, your words, your products."}</p></div>
              <span className="rounded-full border border-[#e9ddd8] bg-white px-3 py-1.5 text-xs font-medium text-[#74686c]">{starters.length} templates · Included with your store</span>
            </div>
            <div className="grid gap-6 md:grid-cols-2">{starters.map((starter) => {
              const selected = configuration?.themeId === starter.id;
              return <article key={starter.id} aria-label={starter.name} className={`group overflow-hidden rounded-3xl border bg-white transition-shadow hover:shadow-[0_12px_40px_-18px_rgba(83,61,66,0.18)] ${selected ? "border-[#c68a9a]" : "border-[#e9ddd8]"}`}>
                <button type="button" aria-label={`Preview ${starter.name}`} onClick={() => setPreviewId(starter.id)} className={`relative block w-full p-5 text-left sm:p-6 ${starter.id === "fresh-market" ? "bg-[#edf1e7]" : "bg-[#efe8e3]"}`}>
                  <TemplateThumbnail id={starter.id} name={starter.name} image={starter.previewAsset} />
                  <span className="absolute bottom-8 right-8 inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/95 px-3 py-2 text-xs font-semibold shadow-sm transition group-hover:-translate-y-0.5 motion-reduce:transform-none"><Eye size={13} />Explore template</span>
                </button>
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3"><h3 className="text-xl font-bold tracking-tight">{starter.name}</h3>{selected && <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0f3] px-2.5 py-1 text-xs font-semibold text-[#9b5266]"><Check size={12} />Selected</span>}</div>
                  <p className="mt-2 text-sm leading-6 text-[#74686c]">{starter.id === "jelly-signature" ? "A modern, minimal storefront in warm white and charcoal, with a complete shopping and customer experience." : starter.id === "fresh-market" ? "Fresh, friendly, and full of life. A natural home for everyday essentials and local favorites." : "Thoughtful details, beautiful products. A considered canvas for independent brands and makers."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{(starter.id === "fresh-market" ? ["Food & essentials", "Fresh & natural"] : starter.id === "jelly-signature" ? ["Fashion & lifestyle", "Clean & minimal"] : ["Fashion & lifestyle", "Warm & editorial"]).map((label) => <span key={label} className="rounded-md bg-[#f7f3f0] px-2 py-1 text-[11px] font-medium text-[#817278]">{label}</span>)}</div>
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[#f1e9e4] pt-5">
                    {!hasWorkspace ? <button type="button" disabled={!api || Boolean(saving)} onClick={() => void installStarter(starter.id)} className={primary}>{saving === `starter:${starter.id}` ? <><Loader2 size={15} className="animate-spin motion-reduce:animate-none" />Preparing your store…</> : <>Use template<ArrowRight size={15} /></>}</button> : selected ? <Link href={editorHref} className={primary}><Pencil size={14} />Customize template</Link> : <button type="button" className={primary} disabled={Boolean(saving)} onClick={() => void installStarter(starter.id)}>Use this template<ArrowRight size={15} /></button>}
                    <button type="button" onClick={() => setPreviewId(starter.id)} className={secondary}><Eye size={15} />Preview</button>
                  </div>
                </div>
              </article>;
            })}</div>
          </section>
          {hasWorkspace && <section aria-labelledby="appearance-heading" className="rounded-3xl border border-[#e9ddd8] bg-white p-5 sm:p-7">
            <div className="mb-6 flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0f3] text-[#9b5266]"><Palette size={19} /></span><div><h2 id="appearance-heading" className="text-xl font-bold tracking-tight">A different look, the same store.</h2><p className="mt-1 text-sm leading-6 text-[#74686c]">Change your theme’s appearance while keeping your pages, content, and custom settings.</p></div></div>
            {unavailable && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Your selected theme “{configuration.themeId}” is unavailable. Choose an available theme to continue.</p>}
            {themes.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{themes.map((theme) => {
              const selected = theme.id === configuration?.themeId;
              return <div key={theme.id} className={`flex items-center justify-between gap-3 rounded-2xl border p-4 ${selected ? "border-[#dba9b7] bg-[#fff6f7]" : "border-[#eee5e0]"}`}><div className="min-w-0"><p className="truncate text-sm font-semibold">{theme.name}</p><p className="mt-1 text-xs text-[#8a7b80]">{selected ? "Selected theme" : theme.available ? "Ready to customize" : "Unavailable"}</p></div><button type="button" aria-label={selected ? `Customize ${theme.name}` : `Use ${theme.name}`} disabled={!theme.available || Boolean(saving)} onClick={() => selected ? router.push(editorHref) : void selectTheme(theme)} className={`grid size-10 shrink-0 place-items-center rounded-xl border transition disabled:opacity-40 ${selected ? "border-[#dba9b7] bg-white text-[#9b5266]" : "border-[#eee5e0] hover:bg-[#fff0f3]"}`}>{saving === theme.id ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" /> : selected ? <Pencil size={16} /> : <ArrowRight size={16} />}</button></div>;
            })}</div> : <p className="text-sm text-[#74686c]">No additional themes are available.</p>}
          </section>}
          <aside className="flex items-start gap-3 rounded-2xl bg-[#f5ede8] px-5 py-4"><Sparkles size={18} className="mt-0.5 shrink-0 text-[#9b5266]" /><p className="text-sm leading-6 text-[#74686c]"><strong className="font-semibold text-[#4b3f43]">Start with a template. Make it yours.</strong> Customize colors, images, text, and sections in the editor. Preview on different screens before you publish.</p></aside>
        </>}
      </div>
      {preview && <TemplatePreviewDialog starter={preview} hasWorkspace={hasWorkspace} busy={Boolean(saving)} error={error} onClose={() => setPreviewId(undefined)} onUse={() => void installStarter(preview.id)} onEdit={() => router.push(editorHref)} />}
    </main>
  );
}
