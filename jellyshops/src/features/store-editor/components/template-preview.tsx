"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { ArrowRight, Check, Monitor, Smartphone } from "lucide-react";
import { RegistrySectionRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type { V4StarterPack } from "@jelly/storefront-registry";
import type { ThemeId } from "@jelly/storefront-schema";
import { resolveStorefrontThemeTokens, resolveTheme } from "@jelly/storefront-themes";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { StorefrontPreviewFrame } from "./storefront-preview-frame";

const sampleCommerce: CommerceDataProvider = { async getProducts() { return []; } };

export function TemplateThumbnail({ id, name, image }: { id: string; name: string; image?: string }) {
  const fresh = id === "fresh-market";
  const [failed, setFailed] = useState(false);
  if (id === "jelly-signature") return <div aria-label={`${name} design preview`} className="overflow-hidden rounded-xl border border-black/10 bg-[#faf9f7] shadow-[0_8px_24px_-8px_rgba(17,17,17,0.12)]">
    <div className="bg-[#111] px-4 py-1.5 text-center text-[8px] font-semibold tracking-wider text-white">A little something lovely, delivered with care.</div>
    <div className="flex items-center justify-between gap-2 px-5 py-3"><span className="font-serif text-[13px] tracking-tight text-[#111]">{name}</span><div className="flex gap-3 text-[8px] text-[#6b665f]"><span>Shop</span><span>Our story</span><span>Bag (0)</span></div></div>
    <div className="grid min-h-[175px] grid-cols-[0.9fr_1fr] bg-[#e7e2d9] sm:min-h-[200px]">
      <div className="flex flex-col justify-center px-5 py-6"><span className="mb-2 text-[7px] font-semibold uppercase tracking-[0.15em] text-[#6b665f]">A collection picked for you</span><p className="font-serif text-[clamp(20px,2.4vw,32px)] leading-[1.05] tracking-tight text-[#111]">Find your everyday favourites.</p><span className="mt-4 w-fit rounded-sm bg-[#111] px-3 py-1.5 text-[8px] font-semibold text-white">Explore the collection ↗</span></div>
      <div className="relative min-h-full overflow-hidden bg-[#cbc6bd]"><div className="absolute bottom-0 left-1/2 h-3/4 w-2/5 -translate-x-1/2 rounded-t-full bg-[#111]" /></div>
    </div>
    <div className="flex items-center justify-between px-5 py-4"><span className="font-serif text-xs text-[#111]">The collection</span><div className="flex gap-1.5">{["#111", "#6b665f", "#e7e2d9"].map((color) => <span key={color} className="size-2 rounded-full border border-black/10" style={{ background: color }} />)}</div></div>
  </div>;
  return <div aria-label={`${name} design preview`} className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_8px_24px_-8px_rgba(50,35,30,0.12)]">
    <div className={`px-4 py-1.5 text-center text-[8px] font-semibold tracking-wider ${fresh ? "bg-[#315e24] text-white" : "bg-[#48362e] text-[#fff8ee]"}`}>{fresh ? "A little goodness, every day." : "Thoughtfully made. Uniquely yours."}</div>
    <div className="flex items-center justify-between gap-2 px-5 py-3"><span className={`text-[13px] font-bold tracking-tight ${fresh ? "text-[#315e24]" : "font-serif text-[#48362e]"}`}>{name}</span><div className="flex gap-3 text-[8px] text-[#7c726b]"><span>Shop</span><span>Our story</span><span>Bag (0)</span></div></div>
    <div className={`grid min-h-[175px] grid-cols-[0.9fr_1fr] sm:min-h-[200px] ${fresh ? "bg-[#f5f5e9]" : "bg-[#faf4ed]"}`}>
      <div className="flex flex-col justify-center px-5 py-6"><span className="mb-2 text-[7px] font-semibold uppercase tracking-[0.15em] text-[#817166]">{fresh ? "Fresh finds. Simple joys." : "For your everyday rituals"}</span><p className={`text-[clamp(20px,2.4vw,32px)] leading-[1.05] tracking-tight ${fresh ? "font-semibold text-[#294825]" : "font-serif text-[#48362e]"}`}>{fresh ? "Good things. Grown with care." : "Objects with a little soul."}</p><span className={`mt-4 w-fit rounded-full px-3 py-1.5 text-[8px] font-semibold text-white ${fresh ? "bg-[#315e24]" : "bg-[#48362e]"}`}>Explore the collection ↗</span></div>
      <div className={`relative min-h-full overflow-hidden ${fresh ? "bg-[#cbd5af]" : "bg-[#d8bda8]"}`}>{image && !failed ? <Image src={image} alt="" fill sizes="(max-width: 768px) 45vw, 25vw" className="object-cover" onError={() => setFailed(true)} /> : <div className="grid h-full min-h-44 place-items-center"><span className="size-24 rounded-t-full border-[12px] border-white/40" /></div>}</div>
    </div>
    <div className="flex items-center justify-between px-5 py-4"><span className={`text-xs font-semibold ${fresh ? "text-[#315e24]" : "font-serif text-[#48362e]"}`}>{fresh ? "Fresh favorites" : "The considered collection"}</span><div className="flex gap-1.5">{(fresh ? ["#315e24", "#d9dfa8", "#f0c67a"] : ["#48362e", "#cfae92", "#ede2d5"]).map((color) => <span key={color} className="size-2 rounded-full" style={{ background: color }} />)}</div></div>
  </div>;
}

export function TemplatePreviewDialog({ starter, hasWorkspace, busy, error, onClose, onUse, onEdit }: {
  starter: V4StarterPack;
  hasWorkspace: boolean;
  busy: boolean;
  error?: string;
  onClose(): void;
  onUse(): void;
  onEdit(): void;
}) {
  const [mobile, setMobile] = useState(false);
  const home = starter.templates.find((template) => template.type === "home");
  const sections = home?.layout.sections.flatMap((placement) => {
    const section = placement.kind === "inline" ? placement.section : starter.globalSections.find((global) => global.section.id === placement.globalSectionId)?.section;
    return section ? [section] : [];
  }) ?? [];
  const theme = resolveTheme(starter.theme.themeId, starter.theme.settings);
  const style = resolveStorefrontThemeTokens(theme.id as ThemeId, theme.settings) as CSSProperties;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex h-[90dvh] w-[calc(100%_-_24px)] max-w-6xl! flex-col gap-0 overflow-hidden rounded-2xl border-[#e9ddd8] bg-[#fffaf6] p-0! text-[#241f20] sm:w-[calc(100%_-_48px)]">
      <header className="shrink-0 border-b border-[#e9ddd8] bg-white px-5 py-4 pr-16 sm:px-6"><DialogTitle className="text-xl text-[#241f20]">{starter.name}</DialogTitle><DialogDescription className="mt-1 text-xs leading-5 text-[#74686c]">Sample home page · Your products and content are added in the editor.</DialogDescription></header>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e9ddd8] px-5 py-3"><p className="text-xs text-[#74686c]">Explore the layout</p><div className="flex gap-1 rounded-xl border border-[#e9ddd8] bg-white p-1"><button type="button" aria-label="Desktop template preview" aria-pressed={!mobile} onClick={() => setMobile(false)} className={`grid size-9 place-items-center rounded-lg ${!mobile ? "bg-[#ffe3e9]" : ""}`}><Monitor size={16} /></button><button type="button" aria-label="Mobile template preview" aria-pressed={mobile} onClick={() => setMobile(true)} className={`grid size-9 place-items-center rounded-lg ${mobile ? "bg-[#ffe3e9]" : ""}`}><Smartphone size={16} /></button></div></div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#f0eae5] p-3 sm:p-5"><div className={`mx-auto h-full overflow-hidden rounded-lg bg-white shadow-sm ${mobile ? "w-[390px] max-w-full" : "w-full"}`}><StorefrontPreviewFrame title="Template preview" themeId={starter.theme.themeId} style={style} className="h-full min-h-[360px] w-full border-0 bg-white"><div inert>{sections.map((section) => <RegistrySectionRenderer key={section.id} section={section} mode="preview" commerce={sampleCommerce} themeId={starter.theme.themeId} page={{ pageType: "home", resource: null }} />)}</div></StorefrontPreviewFrame></div></div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#e9ddd8] bg-white px-5 py-4"><p className="flex items-center gap-2 text-xs text-[#74686c]"><Check size={14} />{hasWorkspace ? "Your current design stays yours." : "All pages included. Ready to customize."}</p><button type="button" disabled={busy} onClick={hasWorkspace ? onEdit : onUse} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#241f20] px-5 text-sm font-semibold text-white disabled:opacity-45">{busy ? "Preparing your store…" : hasWorkspace ? "Edit current storefront" : "Use template"}<ArrowRight size={15} /></button>{error && <p role="alert" className="w-full text-sm text-red-700">{error}</p>}</footer>
    </DialogContent>
  </Dialog>;
}
