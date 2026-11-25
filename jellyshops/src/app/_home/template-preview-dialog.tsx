"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, Monitor, Smartphone, Tablet, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { LIVE_PREVIEW_MESSAGE, LIVE_PAGE_LABELS, isLivePage, type LivePage, type LivePreviewMessage } from "@/features/theme-preview/live-preview-links";
import { chooseTemplateHref } from "@/features/brand/chosen-template";
import styles from "../home.module.css";

export type PreviewTemplate = { slug: string; name: string; category: string };

const DEVICES = {
  desktop: { label: "Desktop", width: 1280, Icon: Monitor },
  tablet: { label: "Tablet", width: 820, Icon: Tablet },
  phone: { label: "Phone", width: 390, Icon: Smartphone },
} as const;
type Device = keyof typeof DEVICES;
/** The sample store pages the tabs open (search and the about page open from the store's own links). */
const TABS: LivePage[] = ["home", "collection", "product", "cart", "checkout"];

/** A device that suits the visitor's screen: phones see the phone layout first. */
function startingDevice(): Device {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 768 ? "phone" : window.innerWidth < 1100 ? "tablet" : "desktop";
}

/**
 * Full-screen live preview of a store design: the design's whole sample store in a sandboxed frame
 * (/theme-preview/live/<id>), with page tabs, a desktop/tablet/phone switch, previous/next design and
 * "Use this template", which starts sign-up with the design chosen.
 */
export function TemplatePreviewDialog({ templates, index, onIndexChange, onClose }: {
  templates: readonly PreviewTemplate[];
  /** The open design, or null when closed. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [page, setPage] = useState<LivePage>("home");
  // The page a newly opened design starts on (the tabs change pages inside the frame, without reloading it).
  const [start, setStart] = useState<LivePage>("home");
  const [loaded, setLoaded] = useState<string | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const open = index !== null;
  // The last design shown stays drawn while the dialog fades out, and its frame is kept for a quick reopen.
  const [shownIndex, setShownIndex] = useState<number | null>(null);
  if (index !== null && index !== shownIndex) {
    setShownIndex(index);
    setLoaded(null);
  }
  const template = shownIndex !== null ? templates[shownIndex] : null;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setDevice(startingDevice());
      setPage("home");
      setStart("home");
      frame.current?.contentWindow?.postMessage({ type: LIVE_PREVIEW_MESSAGE, kind: "go", page: "home" } satisfies LivePreviewMessage, window.location.origin);
      element.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && element.open) element.close();
    if (!open) document.documentElement.style.overflow = "";
  }, [open]);
  useEffect(() => () => { document.documentElement.style.overflow = ""; }, []);

  // The stage's size decides how much the chosen device is scaled down to fit.
  useLayoutEffect(() => {
    if (!open || !stage.current) return;
    const element = stage.current;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open]);

  // The store says which page it shows (its own links change it too).
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      const data = event.data as Partial<LivePreviewMessage> | null;
      if (data?.type !== LIVE_PREVIEW_MESSAGE || data.kind !== "at" || !isLivePage(data.page)) return;
      setPage(data.page);
      if (template) setLoaded(template.slug);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [template]);

  const go = useCallback((next: LivePage) => {
    setPage(next);
    frame.current?.contentWindow?.postMessage({ type: LIVE_PREVIEW_MESSAGE, kind: "go", page: next } satisfies LivePreviewMessage, window.location.origin);
  }, []);
  const step = (by: number) => {
    if (index === null) return;
    setStart(page);
    onIndexChange((index + by + templates.length) % templates.length);
  };

  const deviceWidth = device === "desktop" ? Math.max(DEVICES.desktop.width, size.width) : DEVICES[device].width;
  const padding = device === "desktop" ? 0 : 16;
  const scale = size.width ? Math.min(1, (size.width - padding * 2) / deviceWidth) : 1;
  const frameHeight = size.height ? (size.height - padding * 2) / scale : 0;
  const ready = template !== null && loaded === template.slug;

  return (
    <dialog
      ref={dialog}
      className={styles.preview}
      aria-labelledby="template-preview-title"
      data-lenis-prevent
      onClose={onClose}
      onCancel={() => onClose()}
    >
      {template ? <div className={styles.previewInner}>
        <div className={styles.previewBar}>
          <div className={styles.previewTitle}>
            <h2 id="template-preview-title">{template.name}</h2>
            <span>{template.category}</span>
          </div>
          <div className={styles.previewNav} role="group" aria-label="Other designs">
            <button type="button" className={styles.iconButton} onClick={() => step(-1)}>
              <ArrowLeft size={16} strokeWidth={1.5} aria-hidden="true" /><span className={styles.srOnly}>Previous design</span>
            </button>
            <span className={styles.previewCount} aria-live="polite">{(shownIndex ?? 0) + 1} of {templates.length}</span>
            <button type="button" className={styles.iconButton} onClick={() => step(1)}>
              <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" /><span className={styles.srOnly}>Next design</span>
            </button>
          </div>
          <div className={styles.previewTabs} role="group" aria-label="Store page">
            {TABS.map((key) => (
              <button key={key} type="button" aria-pressed={page === key} onClick={() => go(key)}>{LIVE_PAGE_LABELS[key]}</button>
            ))}
          </div>
          <div className={styles.previewDevices} role="group" aria-label="Screen size">
            {(Object.keys(DEVICES) as Device[]).map((key) => {
              const { label, Icon } = DEVICES[key];
              return (
                <button key={key} type="button" aria-pressed={device === key} onClick={() => setDevice(key)} title={label}>
                  <Icon size={16} strokeWidth={1.5} aria-hidden="true" /><span className={styles.srOnly}>{label}</span>
                </button>
              );
            })}
          </div>
          <Link href={chooseTemplateHref(template.slug)} className={`${styles.btn} ${styles.btnSolid} ${styles.previewCta}`}>
            Use this template <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
          <button type="button" className={`${styles.iconButton} ${styles.previewClose}`} onClick={() => dialog.current?.close()}>
            <X size={16} strokeWidth={1.5} aria-hidden="true" /><span className={styles.srOnly}>Close preview</span>
          </button>
        </div>
        <div ref={stage} className={styles.previewStage} data-device={device}>
          {frameHeight > 0 ? (
            <div className={styles.previewDevice} style={{ width: deviceWidth * scale, height: frameHeight * scale }}>
              <iframe
                ref={frame}
                key={template.slug}
                title={`${template.name} sample store`}
                src={`/theme-preview/live/${template.slug}?page=${start}`}
                sandbox="allow-scripts allow-same-origin allow-forms"
                loading="lazy"
                style={{ width: deviceWidth, height: frameHeight, transform: `scale(${scale})` }}
                // The store reports itself ready; this only lifts the skeleton if that message never comes.
                onLoad={() => { const slug = template.slug; window.setTimeout(() => setLoaded((current) => current ?? slug), 4000); }}
              />
              {!ready ? <div className={styles.previewSkeleton} aria-hidden="true"><span /><span /><span /><span /></div> : null}
            </div>
          ) : null}
          {!ready ? <p className={styles.srOnly} role="status">Loading the {template.name} sample store</p> : null}
        </div>
      </div> : null}
    </dialog>
  );
}
