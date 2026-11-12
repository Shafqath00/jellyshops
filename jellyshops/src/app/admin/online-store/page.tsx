"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, Loader2, Palette, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { applyThemeStyle, listStarterPacks, listThemeStyles } from "@jelly/storefront-themes";
import { AdminPage, Banner } from "@/components/admin";
import { templateStoreLogo, templateStoreProducts, type TemplateStoreData } from "@/features/store-editor/template-store-data";
import { galleryTemplate, templateDisplayName, usedCategories, type GalleryTemplate, type TemplateCategory } from "@/features/store-editor/template-gallery";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import type { ThemeCatalogEntry, ThemeConfigurationRecord } from "@/features/store-editor/api/types";
import { ThemeUpgradePanel } from "@/features/theme-upgrade/theme-upgrade-panel";
import { LayoutUpgradePanel } from "@/features/theme-upgrade/layout-upgrade-panel";
import { TemplatePreviewDialog } from "@/features/store-editor/components/template-preview";

const starters = listStarterPacks();
const gallery = starters.map(galleryTemplate);
const categories = usedCategories(gallery);
const editorHref = "/admin/online-store/editor";
const surface = "rounded-2xl bg-[var(--jk-surface)] shadow-[var(--jk-shadow)]";
const subdued = "text-[var(--jk-text-subdued)]";
const primary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--jk-radius-sm)] bg-[var(--jk-accent)] px-4 text-[13px] font-semibold text-[var(--jk-accent-text)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jk-focus)] disabled:cursor-wait disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--jk-radius-sm)] bg-[var(--jk-surface)] px-4 text-[13px] font-semibold text-[var(--jk-text)] shadow-[inset_0_0_0_1px_var(--jk-border-strong)] transition hover:bg-[var(--jk-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jk-focus)] disabled:opacity-50";

export default function OnlineStorePage() {
  const { activeStore } = useAuth();
  return <StoreDesignLibrary key={activeStore?.id ?? "loading"} />;
}

/** The template's cover photograph, with a calm tinted fallback when it is missing or fails to load. */
function TemplateCover({ template, sizes, priority = false }: { template: GalleryTemplate; sizes: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className="relative aspect-[3/2] overflow-hidden bg-[var(--jk-surface-subdued)]">
    {template.cover && !failed
      ? <Image src={template.cover} alt="" fill sizes={sizes} priority={priority} className="object-cover transition duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" onError={() => setFailed(true)} />
      : <div className="grid h-full place-items-center"><span className={`text-2xl font-semibold tracking-tight ${subdued}`}>{template.name}</span></div>}
  </div>;
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
  const [category, setCategory] = useState<TemplateCategory | "all">("all");
  const [storeData, setStoreData] = useState<TemplateStoreData>();
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
      }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "Could not load your store designs. Try again."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, storeId, retry]);

  // The design preview shows the merchant's own name, logo and products; loaded once, when a preview first opens.
  useEffect(() => {
    if (!previewId || storeData || !api || !storeId || !activeStore) return;
    let alive = true;
    const base = { name: activeStore.name, logoUrl: templateStoreLogo(configuration?.settings) };
    api.listProducts(storeId)
      .then((result) => { if (alive) setStoreData({ ...base, products: templateStoreProducts(result.nodes, activeStore.slug, activeStore.currency) }); })
      .catch(() => { if (alive) setStoreData({ ...base, products: [] }); });
    return () => { alive = false; };
  }, [previewId, storeData, api, storeId, activeStore, configuration]);

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

  async function installStarter(starterId: string, styleId?: string) {
    if (!api || !storeId || operation.current) return;
    if (hasWorkspace && !window.confirm("Switch your draft to this store design? Your page layouts are replaced, and products, collections and pages go back to the main layout for their type. Your live store, products, orders and customers stay the same until you publish.")) return;
    operation.current = true;
    setSaving(`starter:${starterId}`); setError(undefined); setNotice(undefined);
    try {
      if (hasWorkspace) {
        const workspace = await api.loadWorkspace(storeId);
        await api.installStarterPack(storeId, starterId, { replaceDraft: true, expectedGeneration: workspace.generation });
      } else await api.installStarterPack(storeId, starterId);
      // A theme style picked in the preview (other than the theme's default look) is applied to the new draft.
      const starter = starters.find((item) => item.id === starterId);
      const styles = listThemeStyles(starter?.theme.themeId);
      const style = styles.find((item) => item.id === styleId);
      if (style && style !== styles[0]) {
        const installed = await api.getThemeConfiguration(storeId);
        if (installed) await api.saveThemeConfiguration(storeId, installed.revision, { themeId: installed.themeId, themeVersion: installed.themeVersion, settings: applyThemeStyle(installed.settings, style), draftArtifactId: installed.draftArtifactId ?? null });
      }
      if (mounted.current) router.push(editorHref);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Could not prepare this store design. Try again."); }
    finally { operation.current = false; if (mounted.current) setSaving(undefined); }
  }

  const selectedTheme = themes.find((theme) => theme.id === configuration?.themeId);
  const current = gallery.find((template) => template.id === configuration?.themeId);
  const preview = starters.find((starter) => starter.id === previewId);
  const unavailable = configuration && (!selectedTheme || !selectedTheme.available);
  const shown = category === "all" ? gallery : gallery.filter((template) => template.category === category);
  const currentName = current?.name ?? (selectedTheme ? templateDisplayName(selectedTheme.name) : "Your storefront");

  return (
    <main className="min-h-full bg-[var(--jk-surface-subdued)] px-4 py-6 text-[var(--jk-text)] sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1200px]">
        <AdminPage
          title="Store designs"
          description="Choose the look of your online store. Every design includes all pages, and your products are added automatically."
          secondaryActions={activeStore ? [{ label: "View store", href: `/${activeStore.slug}` }] : []}
        >
          {error && <Banner tone="critical" action={<button type="button" onClick={() => { setLoading(true); setError(undefined); setRetry((value) => value + 1); }} className="jk-button"><RefreshCw size={14} aria-hidden="true" />Try again</button>}>{error}</Banner>}
          {notice && <Banner tone="success">{notice}</Banner>}

          {loading ? <div aria-label="Loading store designs" aria-busy="true" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((key) => <div key={key} className={`${surface} overflow-hidden`}><div className="aspect-[3/2] animate-pulse bg-[var(--jk-neutral-bg)] motion-reduce:animate-none" /><div className="space-y-3 p-5"><div className="h-3 w-1/4 rounded bg-[var(--jk-neutral-bg)]" /><div className="h-4 w-1/2 rounded bg-[var(--jk-neutral-bg)]" /><div className="h-3 w-5/6 rounded bg-[var(--jk-neutral-bg)]" /></div></div>)}
            <span className="sr-only">Loading your storefront designs…</span>
          </div> : error && themes.length === 0 ? null : <div className="flex flex-col gap-10 pt-2">

            {hasWorkspace && <section aria-labelledby="current-design" className={`${surface} grid overflow-hidden md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]`}>
              <div className="group relative">{current ? <TemplateCover template={current} sizes="(max-width: 768px) 100vw, 640px" priority /> : <div className="grid aspect-[3/2] h-full place-items-center bg-[var(--jk-surface-hover)]"><Palette size={32} className={subdued} aria-hidden="true" /></div>}</div>
              <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--jk-success-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--jk-success-text)]"><span className="size-1.5 rounded-full bg-[var(--jk-success-dot)]" aria-hidden="true" />Current design</span>
                <div>
                  <h2 id="current-design" className="text-2xl font-semibold tracking-tight">{currentName}</h2>
                  <p className={`mt-2 max-w-md text-sm leading-6 ${subdued}`}>{current?.summary ?? "Pick up where you left off and make every detail feel like your brand."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={editorHref} className={primary}><Pencil size={15} aria-hidden="true" />Continue editing</Link>
                  <button type="button" className={secondary} onClick={() => current && setPreviewId(current.id)} disabled={!current}><Eye size={15} aria-hidden="true" />Preview design</button>
                </div>
                <p className={`text-xs ${subdued}`}>Edits stay private until you publish.</p>
              </div>
            </section>}

            {/* Only drafts on an uploaded theme (they carry its version id) can be upgraded. */}
            {hasWorkspace && configuration?.draftArtifactId && storeId && token && <ThemeUpgradePanel storeId={storeId} token={token} />}
            {/* Drafts on a Jelly design built from an earlier page layout can move to the current one. */}
            {hasWorkspace && !configuration?.draftArtifactId && storeId && token && <LayoutUpgradePanel storeId={storeId} token={token} />}

            <section aria-labelledby="template-gallery" className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="template-gallery" className="text-xl font-semibold tracking-tight">{hasWorkspace ? "Explore store designs" : "Choose your starting point"}</h2>
                  <p className={`mt-1 max-w-2xl text-sm leading-6 ${subdued}`}>{hasWorkspace ? "Switching replaces your draft layout only. Your live store, products and orders stay the same until you publish." : "Complete, ready-to-edit designs. Add your photos, words and products, then publish when you’re ready."}</p>
                </div>
                <p className={`text-[13px] ${subdued}`}>{gallery.length} designs · all free</p>
              </div>

              {categories.length > 1 && <div role="group" aria-label="Filter by shop type" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {(["all", ...categories] as const).map((item) => {
                  const active = category === item;
                  const count = item === "all" ? gallery.length : gallery.filter((template) => template.category === item).length;
                  return <button key={item} type="button" aria-pressed={active} onClick={() => setCategory(item)} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jk-focus)] ${active ? "bg-[var(--jk-accent)] text-[var(--jk-accent-text)]" : "bg-[var(--jk-surface)] text-[var(--jk-text)] shadow-[inset_0_0_0_1px_var(--jk-border)] hover:bg-[var(--jk-surface-hover)]"}`}>
                    {item === "all" ? "All designs" : item}<span className={active ? "opacity-70" : subdued}>{count}</span>
                  </button>;
                })}
              </div>}

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{shown.map((template, index) => {
                const selected = configuration?.themeId === template.id;
                const busy = saving === `starter:${template.id}`;
                return <article key={template.id} aria-label={template.name} className={`${surface} group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.22),0_0_0_1px_var(--jk-border)] motion-reduce:transform-none ${selected ? "ring-2 ring-[var(--jk-accent)]" : ""}`}>
                  <button type="button" aria-label={`Preview ${template.name}`} onClick={() => setPreviewId(template.id)} className="relative block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--jk-focus)]">
                    <TemplateCover template={template} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 400px" priority={index < 3} />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1f1f1f] shadow-sm opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none" aria-hidden="true"><Eye size={13} />Preview</span>
                    {selected && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#1f1f1f] shadow-sm"><Check size={12} aria-hidden="true" />Current</span>}
                  </button>
                  <div className="flex flex-1 flex-col p-5">
                    {template.category && <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${subdued}`}>{template.category}</p>}
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">{template.name}</h3>
                    <p className={`mt-1.5 line-clamp-2 text-sm leading-6 ${subdued}`}>{template.summary}</p>
                    {template.tags.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Style">{template.tags.map((tag) => <li key={tag} className="rounded-full bg-[var(--jk-neutral-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--jk-neutral-text)]">{tag}</li>)}</ul>}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                      {!hasWorkspace
                        ? <button type="button" disabled={!api || Boolean(saving)} onClick={() => void installStarter(template.id)} className={`${primary} flex-1`}>{busy ? <><Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Preparing your store…</> : <>Start with this design<ArrowRight size={15} aria-hidden="true" /></>}</button>
                        : selected
                          ? <Link href={editorHref} className={`${primary} flex-1`}><Pencil size={14} aria-hidden="true" />Customize design</Link>
                          : <button type="button" className={`${secondary} flex-1`} disabled={Boolean(saving)} onClick={() => void installStarter(template.id)}>{busy ? <><Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Switching…</> : <>Switch to this design<ArrowRight size={15} aria-hidden="true" /></>}</button>}
                      <button type="button" onClick={() => setPreviewId(template.id)} className={secondary}><Eye size={15} aria-hidden="true" />Preview</button>
                    </div>
                  </div>
                </article>;
              })}</div>
            </section>

            {hasWorkspace && <section aria-labelledby="appearance-heading" className={`${surface} p-5 sm:p-6`}>
              <div className="mb-5 flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--jk-surface-hover)]"><Palette size={18} aria-hidden="true" /></span>
                <div><h2 id="appearance-heading" className="text-base font-semibold tracking-tight">Change the theme, keep your pages</h2><p className={`mt-0.5 text-sm leading-6 ${subdued}`}>Switch only the colours, fonts and styling. Your pages, sections and content stay as they are.</p></div>
              </div>
              {unavailable && <p role="alert" className="mb-4 rounded-xl bg-[var(--jk-warning-bg)] px-4 py-3 text-sm text-[var(--jk-warning-text)]">Your selected theme “{configuration.themeId}” is unavailable. Choose an available theme to continue.</p>}
              {themes.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{themes.map((theme) => {
                const selected = theme.id === configuration?.themeId;
                return <div key={theme.id} className={`flex items-center justify-between gap-3 rounded-xl p-4 shadow-[inset_0_0_0_1px_var(--jk-border)] ${selected ? "bg-[var(--jk-surface-selected)] shadow-[inset_0_0_0_2px_var(--jk-accent)]" : ""}`}>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{templateDisplayName(theme.name)}</p><p className={`mt-0.5 text-xs ${subdued}`}>{selected ? "Current theme" : theme.available ? "Ready to use" : "Unavailable"}</p></div>
                  <button type="button" aria-label={selected ? `Customize ${theme.name}` : `Use ${theme.name}`} disabled={!theme.available || Boolean(saving)} onClick={() => selected ? router.push(editorHref) : void selectTheme(theme)} className={`grid size-10 shrink-0 place-items-center rounded-[var(--jk-radius-sm)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--jk-focus)] disabled:opacity-40 ${selected ? "bg-[var(--jk-accent)] text-[var(--jk-accent-text)]" : "bg-[var(--jk-surface)] shadow-[inset_0_0_0_1px_var(--jk-border-strong)] hover:bg-[var(--jk-surface-hover)]"}`}>{saving === theme.id ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : selected ? <Pencil size={16} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}</button>
                </div>;
              })}</div> : <p className={`text-sm ${subdued}`}>No additional themes are available.</p>}
            </section>}

            <aside className="flex items-start gap-3 rounded-2xl px-1 text-sm leading-6">
              <Sparkles size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className={subdued}><strong className="font-semibold text-[var(--jk-text)]">Make it yours.</strong> Change colours, fonts, photos and sections in the editor, and check desktop, tablet and phone before you publish.</p>
            </aside>
          </div>}
        </AdminPage>
      </div>
      {preview && <TemplatePreviewDialog starter={{ ...preview, name: templateDisplayName(preview.name) }} hasWorkspace={hasWorkspace} busy={Boolean(saving)} error={error} store={storeData} onClose={() => setPreviewId(undefined)} onUse={(styleId) => void installStarter(preview.id, styleId)} onEdit={() => router.push(editorHref)} />}
    </main>
  );
}
