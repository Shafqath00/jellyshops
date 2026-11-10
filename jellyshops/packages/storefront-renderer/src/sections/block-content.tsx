import { appEmbedSource, getAppBlockProvider } from "@jelly/storefront-schema";
import { useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { BlockNode } from "@jelly/storefront-schema";
import { resolveStorefrontHref } from "../runtime-context";
import { blockStyle, blockStyleProps } from "../block-style";
import { imageValue, stringValue } from "./shared";

/**
 * Button, image and video blocks, shared by every section that shows them.
 * All merchant values are checked before they reach the page: colours must be
 * hex, links go through the safe-link check, videos only embed from YouTube,
 * Vimeo or a direct https video file.
 */

const hex = /^#[0-9a-fA-F]{6}$/;
const ratios: Record<string, string> = { square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3", wide: "16 / 9" };
type Settings = Record<string, unknown>;

function color(settings: Settings, key: string): string | undefined {
  const value = settings[key];
  return typeof value === "string" && hex.test(value) ? value : undefined;
}

/** Class, link target and inline colours for a button block. `index` decides the theme default (first filled, others outlined). */
export function buttonProps(settings: Settings, index = 0, mobile?: Settings, tablet?: Settings) {
  const style = settings.buttonStyle === "primary" || settings.buttonStyle === "secondary" || settings.buttonStyle === "link"
    ? settings.buttonStyle
    : index === 0 ? "primary" : "secondary";
  const own = blockStyleProps(settings, mobile, tablet);
  const inline: CSSProperties = { ...own.style };
  const background = color(settings, "buttonColor");
  const text = color(settings, "buttonTextColor");
  if (background && style !== "link") Object.assign(inline, { background, borderColor: background });
  if (text) inline.color = text;
  if (text && style === "secondary" && !background) inline.borderColor = text;
  return {
    className: style === "primary" ? "jelly-button" : `jelly-button jelly-button--${style}`,
    ...(settings.openInNewTab === true ? { target: "_blank", rel: "noopener noreferrer" } : {}),
    ...(["small", "medium", "large"].includes(settings.buttonSize as string) ? { "data-button-size": settings.buttonSize as string } : {}),
    ...(["darken", "lift", "underline", "none"].includes(settings.buttonHover as string) ? { "data-button-hover": settings.buttonHover as string } : {}),
    ...(own["data-block-style"] !== undefined || background || text ? { "data-block-style": "" } : {}),
    ...(own["data-block-mobile"] ? { "data-block-mobile": own["data-block-mobile"] } : {}),
    ...(own["data-show-on"] ? { "data-show-on": own["data-show-on"] } : {}),
    ...(Object.keys(inline).length ? { style: inline } : {}),
  };
}

/** Editor-only data so a click in the preview selects the block. */
export function blockEditorData(block: BlockNode, editor: boolean, label: string, selectedBlockId?: string, fieldKey?: string) {
  if (!editor) return {};
  return {
    "data-editor-block-id": block.id,
    "data-editor-block-label": label,
    "data-editor-block-selected": String(selectedBlockId === block.id),
    ...(fieldKey ? { "data-editor-field-key": fieldKey } : {}),
  };
}

export function ImageBlock({ block, storeSlug, editor = false, extra = {} }: { block: BlockNode; storeSlug?: string; editor?: boolean; extra?: Record<string, string> }): ReactNode {
  const image = imageValue(block.settings);
  const ratio = typeof block.settings.aspectRatio === "string" ? ratios[block.settings.aspectRatio] : undefined;
  const overlay = typeof block.settings.overlay === "number" ? Math.min(80, Math.max(0, block.settings.overlay)) : 0;
  const own = blockStyle(block);
  if (!image) return editor ? <div className="jelly-image-block is-empty" {...own} {...extra} style={{ ...own.style, aspectRatio: ratio ?? "4 / 3" }}>Choose an image</div> : null;
  const href = resolveStorefrontHref(block.settings.link, storeSlug);
  const picture = <>
    {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image.url} alt={typeof image.alt === "string" ? image.alt : ""} loading="lazy" style={{ objectFit: image.fit === "contain" ? "contain" : "cover", objectPosition: `${image.focalPoint?.x ?? 50}% ${image.focalPoint?.y ?? 50}%`, ...(ratio ? { aspectRatio: ratio, height: "auto" } : {}) }} />
    {overlay > 0 && <span className="jelly-image-block-overlay" aria-hidden="true" style={{ background: `rgb(0 0 0 / ${overlay / 100})` }} />}
  </>;
  const props = { className: "jelly-image-block", ...own, ...extra };
  return href && !editor ? <a href={href} {...props}>{picture}</a> : <figure {...props}>{picture}</figure>;
}

/** An embeddable address for a YouTube or Vimeo link, a direct https video file, or null. */
export function videoSource(url: unknown, autoplay: boolean, controls: boolean): { kind: "embed" | "file"; src: string; /** YouTube's own cover picture, used until the shopper presses play. */ cover?: string } | null {
  if (typeof url !== "string") return null;
  let parsed: URL;
  try { parsed = new URL(url.trim()); } catch { return null; }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.replace(/^www\.|^m\./, "");
  const flags = (values: Record<string, string>) => new URLSearchParams(values).toString();
  let id: string | undefined;
  if (host === "youtu.be") id = parsed.pathname.slice(1);
  else if (host === "youtube.com") id = parsed.searchParams.get("v") ?? parsed.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1];
  if (id !== undefined) {
    if (!/^[\w-]{6,20}$/.test(id)) return null;
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?${flags({ rel: "0", controls: controls ? "1" : "0", ...(autoplay ? { autoplay: "1", mute: "1", loop: "1", playlist: id } : {}) })}`, cover: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vimeo = parsed.pathname.match(/(\d{6,12})/)?.[1];
    return vimeo ? { kind: "embed", src: `https://player.vimeo.com/video/${vimeo}?${flags({ controls: controls ? "1" : "0", ...(autoplay ? { autoplay: "1", muted: "1", loop: "1" } : {}) })}` } : null;
  }
  return /\.(mp4|webm|mov)$/i.test(parsed.pathname) ? { kind: "file", src: parsed.toString() } : null;
}

/** An app block: the provider's embed link in a sandboxed frame; nothing on the live store until the link is valid. */
export function AppBlock({ block, editor = false, extra = {} }: { block: BlockNode; editor?: boolean; extra?: Record<string, string> }): ReactNode {
  const provider = getAppBlockProvider(block.settings.provider);
  const src = appEmbedSource(block.settings.provider, block.settings.url);
  const height = typeof block.settings.height === "number" ? Math.min(1200, Math.max(120, block.settings.height)) : provider?.defaultHeight ?? 400;
  const props = { className: "jelly-app-block", "data-app": provider?.id, ...extra, style: { minHeight: src ? undefined : 120 } };
  if (!src) return editor ? <div {...props} data-empty="true">{!provider ? "Choose an app and paste its embed link." : stringValue(block.settings, "url") ? `This link can't be used for ${provider.name}. ${provider.help}` : `Paste the ${provider.name} embed link. ${provider.help}`}</div> : null;
  const title = stringValue(block.settings, "title").trim() || provider!.name;
  const sandbox = ["allow-scripts", "allow-same-origin", ...(provider!.sandbox ?? [])].join(" ");
  // In the editor the frame ignores clicks so selecting the block still works.
  return <div {...props}><iframe src={src} title={title} height={height} loading="lazy" sandbox={sandbox} referrerPolicy="strict-origin-when-cross-origin" allow="fullscreen; clipboard-write" style={{ pointerEvents: editor ? "none" : undefined }} /></div>;
}

/** True when the shopper asked for less motion (no autoplay then). */
const reducedMotionQuery = () => (typeof window === "undefined" ? undefined : window.matchMedia?.("(prefers-reduced-motion: reduce)"));
function subscribeReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  query?.addEventListener?.("change", onChange);
  return () => query?.removeEventListener?.("change", onChange);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, () => reducedMotionQuery()?.matches === true, () => false);
}

/**
 * A video block. A YouTube or Vimeo video shows a cover picture with a play button and loads the player only when
 * the shopper presses it (Shopify's "deferred media"): the page stays fast and nothing is fetched from the video
 * service before then. Autoplaying videos (muted, looping) start at once, except for shoppers who ask for less motion,
 * who get the cover and controls instead.
 */
export function VideoBlock({ block, editor = false, extra = {} }: { block: BlockNode; editor?: boolean; extra?: Record<string, string> }): ReactNode {
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const autoplay = block.settings.autoplay === true && !reduceMotion && !editor;
  const controls = block.settings.controls !== false || (block.settings.autoplay === true && !autoplay);
  const source = videoSource(block.settings.url, autoplay, controls);
  const ratio = (typeof block.settings.aspectRatio === "string" && ratios[block.settings.aspectRatio]) || ratios.wide;
  const own = blockStyle(block);
  const props = { className: "jelly-video-block", ...own, ...extra, style: { ...own.style, aspectRatio: ratio } };
  if (!source) return editor ? <div {...props} data-empty="true">{stringValue(block.settings, "url") ? "This video link can't be shown. Use a YouTube, Vimeo or .mp4 link." : "Add a video link"}</div> : null;
  const poster = imageValue(block.settings, "poster");
  const title = stringValue(block.settings, "title") || "Video";
  if (source.kind === "embed") {
    if (autoplay || playing) return <div {...props}><iframe src={playing && !autoplay ? `${source.src}&autoplay=1` : source.src} title={title} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>;
    const cover = poster?.url ?? source.cover;
    return <div {...props} data-video-cover="true">
      <button type="button" className="jelly-video-cover" aria-label={`Play video: ${title}`} onClick={() => { if (!editor) setPlaying(true); }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- merchant or video-service picture, not a Next Image asset */}
        {cover && <img src={cover} alt="" loading="lazy" />}
        <span className="jelly-video-play" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg></span>
      </button>
    </div>;
  }
  return <div {...props}><video src={source.src} poster={poster?.url} controls={controls} autoPlay={autoplay} muted={autoplay} loop={autoplay} playsInline preload="metadata" aria-label={title} /></div>;
}
