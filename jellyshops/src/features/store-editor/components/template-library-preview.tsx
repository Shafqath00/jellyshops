"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2, Monitor, Pencil, Smartphone, Tablet } from "lucide-react";
import type { V4StarterPack } from "@jelly/storefront-registry";
import type { ThemeId } from "@jelly/storefront-schema";
import { applyThemeStyle, listThemeStyles, resolveStorefrontThemeTokens, resolveTheme } from "@jelly/storefront-themes";
import { Banner, Tabs, buttonClass } from "@/components/admin";
import { TemplatePreview } from "@/features/theme-preview/template-preview";
import type { ThemePreviewConfig } from "@/features/theme-preview/configs";
import { ScaledPreview } from "./scaled-preview";
import { StorefrontPreviewFrame } from "./storefront-preview-frame";

/** The storefront pages a design can be previewed on, in the order a shopper meets them. */
export const PREVIEW_PAGES = [
  { id: "home", label: "Home" },
  { id: "collection", label: "Collection" },
  { id: "product", label: "Product" },
  { id: "cart", label: "Cart" },
] as const;
export type PreviewPage = (typeof PREVIEW_PAGES)[number]["id"];

/** Real device widths: the frame is drawn at that width and shrunk to fit when the window is narrower. */
export const PREVIEW_DEVICES = [
  { id: "desktop", label: "Desktop", width: 1280, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 820, icon: Tablet },
  { id: "mobile", label: "Mobile", width: 390, icon: Smartphone },
] as const;
export type PreviewDevice = (typeof PREVIEW_DEVICES)[number]["id"];

const subdued = "text-[var(--jk-text-subdued)]";
const segment = "flex items-center gap-1 rounded-full bg-[var(--jk-surface-subdued)] p-1";
const segmentButton = (on: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--jk-focus)] motion-reduce:transition-none ${on ? "bg-[var(--jk-surface)] text-[var(--jk-text)] shadow-[var(--jk-shadow)]" : `${subdued} hover:text-[var(--jk-text)]`}`;

/**
 * A store design shown full screen, like a theme store's demo: every main page of the storefront
 * (home, collection, product, cart) drawn by the live store's own renderer with sample data (or the
 * merchant's products), at desktop, tablet or phone width, in each of the theme's styles.
 */
export function TemplateLibraryPreview({ starter, config, category, backHref, isCurrent, hasWorkspace, busy, error, usingStore, onUse, onEdit }: {
  starter: V4StarterPack;
  config: ThemePreviewConfig;
  category?: string;
  backHref: string;
  /** This design is the store's current one: offer to keep editing instead of starting again. */
  isCurrent: boolean;
  hasWorkspace: boolean;
  busy: boolean;
  error?: string;
  /** The preview shows the merchant's own products and name. */
  usingStore: boolean;
  onUse(styleId?: string): void;
  onEdit(): void;
}) {
  const [page, setPage] = useState<PreviewPage>("home");
  // On a phone or tablet the preview starts at that size, like a shopper on the same device would see it.
  const [device, setDevice] = useState<PreviewDevice>(() => typeof window === "undefined" ? "desktop" : window.innerWidth < 768 ? "mobile" : window.innerWidth < 1100 ? "tablet" : "desktop");
  const styles = listThemeStyles(starter.theme.themeId);
  const [styleId, setStyleId] = useState(styles[0]?.id);
  const themeStyle = styles.find((item) => item.id === styleId);
  const theme = resolveTheme(starter.theme.themeId, themeStyle ? applyThemeStyle(starter.theme.settings, themeStyle) : starter.theme.settings, starter.version);
  const tokens = resolveStorefrontThemeTokens(theme.id as ThemeId, theme.settings, {}, theme.version) as CSSProperties;
  const width = PREVIEW_DEVICES.find((item) => item.id === device)?.width ?? 1280;
  const pageLabel = PREVIEW_PAGES.find((item) => item.id === page)?.label ?? "Home";

  // The admin page behind stays still while the preview covers it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const useLabel = busy ? (hasWorkspace ? "Switching…" : "Preparing your store…") : "Use this template";

  return <div className="fixed inset-0 z-[var(--jk-z-overlay)] flex flex-col bg-[var(--jk-surface-subdued)] text-[var(--jk-text)]" data-template-preview={starter.id}>
    <header className="shrink-0 border-b border-[var(--jk-border)] bg-[var(--jk-surface)]">
      <div className="flex items-center gap-x-4 gap-y-3 px-3 py-2.5 sm:px-5">
        <Link href={backHref} className={buttonClass("quiet")}><ArrowLeft size={16} aria-hidden="true" /><span className="sr-only sm:not-sr-only">Back to templates</span></Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight">{starter.name}</h1>
          <p className={`truncate text-xs ${subdued}`}>{[category, usingStore ? `Shown with ${config.name}'s products` : "Shown with sample products"].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex items-center gap-2">
          {isCurrent
            ? <button type="button" className={buttonClass("primary")} onClick={onEdit}><Pencil size={15} aria-hidden="true" />Customize</button>
            : <button type="button" className={buttonClass("primary")} aria-label={useLabel} disabled={busy} onClick={() => onUse(styleId)}>{busy ? <Loader2 size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}<span className="hidden sm:inline">{useLabel}</span><span className="sm:hidden" aria-hidden="true">{busy ? "Working…" : "Use"}</span>{!busy && <ArrowRight size={15} aria-hidden="true" />}</button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--jk-border)] px-3 py-2 sm:px-5">
        <Tabs label="Storefront page" tabs={PREVIEW_PAGES.map((item) => ({ id: item.id, label: item.label }))} active={page} onChange={(id) => setPage(id as PreviewPage)} />
        <div className="flex flex-wrap items-center gap-3">
          {styles.length > 1 && <div role="group" aria-label="Style" className={segment}>
            {styles.map((item) => <button key={item.id} type="button" aria-pressed={item.id === styleId} title={item.description} onClick={() => setStyleId(item.id)} className={segmentButton(item.id === styleId)}>
              <span className="flex h-3.5 w-7 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" aria-hidden="true">{item.swatches.map((colour, index) => <span key={`${colour}-${index}`} className="flex-1" style={{ background: colour }} />)}</span>
              {item.name}
            </button>)}
          </div>}
          <div role="group" aria-label="Device" className={segment}>
            {PREVIEW_DEVICES.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={device === id} aria-label={label} title={label} onClick={() => setDevice(id)} className={segmentButton(device === id)}>
              <Icon size={16} aria-hidden="true" /><span className="hidden lg:inline">{label}</span>
            </button>)}
          </div>
        </div>
      </div>
      {error && <div className="px-3 pb-3 sm:px-5"><Banner tone="critical">{error}</Banner></div>}
    </header>

    <main className="flex min-h-0 flex-1 justify-center overflow-hidden p-2 sm:p-4" aria-label={`${pageLabel} page preview`}>
      <div className="h-full overflow-hidden rounded-xl bg-white shadow-[var(--jk-shadow-raised)]" style={{ width: device === "desktop" ? "100%" : width, maxWidth: "100%" }} data-preview-device={device}>
        <ScaledPreview minWidth={width}>
          <StorefrontPreviewFrame title={`${starter.name}: ${pageLabel} page, ${device} preview`} themeId={starter.theme.themeId} themeVersion={theme.version} style={tokens} className="block h-full w-full border-0 bg-white">
            <TemplatePreview key={`${page}:${config.packId}`} template={page} config={config} />
          </StorefrontPreviewFrame>
        </ScaledPreview>
      </div>
    </main>
  </div>;
}
