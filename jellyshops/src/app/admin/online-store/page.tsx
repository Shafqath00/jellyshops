"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, Loader2, Palette, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { listStarterPacks } from "@jelly/storefront-themes";
import { AdminPage, Banner, buttonClass } from "@/components/admin";
import { StoreDesignDialogs } from "@/features/store-editor/components/store-design-dialogs";
import { galleryTemplate, templateDisplayName, usedCategories, type GalleryTemplate, type TemplateCategory } from "@/features/store-editor/template-gallery";
import { useAuth } from "@/features/auth/providers/auth-provider";
import type { ThemeCatalogEntry } from "@/features/store-editor/api/types";
import { ThemeUpgradePanel } from "@/features/theme-upgrade/theme-upgrade-panel";
import { LayoutUpgradePanel } from "@/features/theme-upgrade/layout-upgrade-panel";
import { EDITOR_HREF, templatePreviewHref, useStoreDesigns } from "@/features/store-editor/hooks/use-store-designs";
import { storePath } from "@jelly/storefront-schema";

const starters = listStarterPacks();
const gallery = starters.map(galleryTemplate);
const categories = usedCategories(gallery);
const editorHref = EDITOR_HREF;
const surface = "rounded-2xl bg-[var(--jk-surface)] shadow-[var(--jk-shadow)]";
const subdued = "text-[var(--jk-text-subdued)]";
const primary = buttonClass("primary", "large");
const secondary = buttonClass("secondary", "large");

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
  const designs = useStoreDesigns();
  const { api, activeStore, themes, configuration, setConfiguration, hasWorkspace, loading, saving, error, reload, chooseStarter, runOperation, mounted } = designs;
  const storeId = designs.storeId;
  const token = designs.token;
  const [notice, setNotice] = useState<string>();
  const [category, setCategory] = useState<TemplateCategory | "all">("all");

  function selectTheme(theme: ThemeCatalogEntry) {
    if (!api || !storeId || !theme.available) return;
    setNotice(undefined);
    void runOperation(theme.id, async () => {
      const result = await api.saveThemeConfiguration(storeId, configuration?.revision ?? null, {
        themeId: theme.id, themeVersion: theme.version, settings: configuration?.settings ?? {}, draftArtifactId: configuration?.draftArtifactId ?? null,
      });
      if (!mounted.current) return;
      setConfiguration(result.theme);
      setNotice(`${theme.name} selected. Continue editing to customize it, then publish when you’re ready.`);
    });
  }

  const selectedTheme = themes.find((theme) => theme.id === configuration?.themeId);
  const current = gallery.find((template) => template.id === configuration?.themeId);
  const unavailable = configuration && (!selectedTheme || !selectedTheme.available);
  const shown = category === "all" ? gallery : gallery.filter((template) => template.category === category);
  const currentName = current?.name ?? (selectedTheme ? templateDisplayName(selectedTheme.name) : "Your storefront");

  return (
    <main className="min-h-full bg-[var(--jk-surface-subdued)] px-4 py-6 text-[var(--jk-text)] sm:px-6 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1200px]">
        <AdminPage
          title="Store designs"
          description="Choose the look of your online store. Every design includes all pages, and your products are added automatically."
          secondaryActions={activeStore ? [{ label: "View store", href: storePath(activeStore.slug) }] : []}
        >
          {error && <Banner tone="critical" action={<button type="button" onClick={reload} className="jk-button"><RefreshCw size={14} aria-hidden="true" />Try again</button>}>{error}</Banner>}
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
                  {current && <Link href={templatePreviewHref(current.id)} className={secondary}><Eye size={15} aria-hidden="true" />Preview design</Link>}
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
                  return <button key={item} type="button" aria-pressed={active} onClick={() => setCategory(item)} className="jk-chip shrink-0">
                    {item === "all" ? "All designs" : item}<span className={active ? "opacity-70" : subdued}>{count}</span>
                  </button>;
                })}
              </div>}

              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{shown.map((template, index) => {
                const selected = configuration?.themeId === template.id;
                const busy = saving === `starter:${template.id}`;
                return <article key={template.id} aria-label={template.name} className={`${surface} group flex flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--jk-shadow-raised)] motion-reduce:transform-none ${selected ? "ring-2 ring-[var(--jk-accent)]" : ""}`}>
                  <Link href={templatePreviewHref(template.id)} tabIndex={-1} aria-hidden="true" className="relative block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--jk-focus)]">
                    <TemplateCover template={template} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 400px" priority={index < 3} />
                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 motion-reduce:transition-none" aria-hidden="true" />
                    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#1f1f1f] shadow-sm opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none" aria-hidden="true"><Eye size={13} />Preview</span>
                    {selected && <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[#1f1f1f] shadow-sm"><Check size={12} aria-hidden="true" />Current</span>}
                  </Link>
                  <div className="flex flex-1 flex-col p-5">
                    {template.category && <p className={`text-[11px] font-semibold uppercase tracking-[0.08em] ${subdued}`}>{template.category}</p>}
                    <h3 className="mt-1 text-lg font-semibold tracking-tight">{template.name}</h3>
                    <p className={`mt-1.5 line-clamp-2 text-sm leading-6 ${subdued}`}>{template.summary}</p>
                    {template.tags.length > 0 && <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Style">{template.tags.map((tag) => <li key={tag} className="rounded-full bg-[var(--jk-neutral-bg)] px-2.5 py-0.5 text-xs font-medium text-[var(--jk-neutral-text)]">{tag}</li>)}</ul>}
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                      {!hasWorkspace
                        ? <button type="button" disabled={!api || Boolean(saving)} onClick={() => chooseStarter(template.id)} className={`${primary} flex-1`}>{busy ? <><Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Preparing your store…</> : <>Start with this design<ArrowRight size={15} aria-hidden="true" /></>}</button>
                        : selected
                          ? <Link href={editorHref} className={`${primary} flex-1`}><Pencil size={14} aria-hidden="true" />Customize design</Link>
                          : <button type="button" className={`${secondary} flex-1`} disabled={Boolean(saving)} onClick={() => chooseStarter(template.id)}>{busy ? <><Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Switching…</> : <>Switch to this design<ArrowRight size={15} aria-hidden="true" /></>}</button>}
                      <Link href={templatePreviewHref(template.id)} className={secondary} aria-label={`Preview ${template.name}`}><Eye size={15} aria-hidden="true" />Preview</Link>
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
              {unavailable && <div className="mb-4"><Banner tone="warning" title="Your theme is no longer available">Choose one of the themes below to carry on.</Banner></div>}
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
      <StoreDesignDialogs designs={designs} onCustomize={() => router.push(editorHref)} />
    </main>
  );
}
