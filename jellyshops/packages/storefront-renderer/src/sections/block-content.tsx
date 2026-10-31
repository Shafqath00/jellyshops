import type { CSSProperties, ReactNode } from "react";
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
export function videoSource(url: unknown, autoplay: boolean, controls: boolean): { kind: "embed" | "file"; src: string } | null {
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
    return { kind: "embed", src: `https://www.youtube-nocookie.com/embed/${id}?${flags({ rel: "0", controls: controls ? "1" : "0", ...(autoplay ? { autoplay: "1", mute: "1", loop: "1", playlist: id } : {}) })}` };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const vimeo = parsed.pathname.match(/(\d{6,12})/)?.[1];
    return vimeo ? { kind: "embed", src: `https://player.vimeo.com/video/${vimeo}?${flags({ controls: controls ? "1" : "0", ...(autoplay ? { autoplay: "1", muted: "1", loop: "1" } : {}) })}` } : null;
  }
  return /\.(mp4|webm|mov)$/i.test(parsed.pathname) ? { kind: "file", src: parsed.toString() } : null;
}

export function VideoBlock({ block, editor = false, extra = {} }: { block: BlockNode; editor?: boolean; extra?: Record<string, string> }): ReactNode {
  const autoplay = block.settings.autoplay === true;
  const controls = block.settings.controls !== false;
  const source = videoSource(block.settings.url, autoplay, controls);
  const ratio = (typeof block.settings.aspectRatio === "string" && ratios[block.settings.aspectRatio]) || ratios.wide;
  const own = blockStyle(block);
  const props = { className: "jelly-video-block", ...own, ...extra, style: { ...own.style, aspectRatio: ratio } };
  if (!source) return editor ? <div {...props} data-empty="true">{stringValue(block.settings, "url") ? "This video link can't be shown. Use a YouTube, Vimeo or .mp4 link." : "Add a video link"}</div> : null;
  if (source.kind === "embed") return <div {...props}><iframe src={source.src} title="Video" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>;
  const poster = imageValue(block.settings, "poster");
  return <div {...props}><video src={source.src} poster={poster?.url} controls={controls} autoPlay={autoplay} muted={autoplay} loop={autoplay} playsInline preload="metadata" /></div>;
}
