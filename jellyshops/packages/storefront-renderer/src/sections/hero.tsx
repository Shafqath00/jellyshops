import type { CSSProperties } from "react";
import type { MediaReference, SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";

function setting(block: SectionNode["blocks"][number], key: string): string | undefined {
  const value = block.settings[key];
  return typeof value === "string" ? value : undefined;
}

export function HeroSection({ section, editor = false }: { section: SectionNode; editor?: boolean }) {
  const settings = section.settings;
  const image = settings.image && typeof settings.image === "object" ? settings.image as MediaReference : undefined;
  const focalPoint = image && image.focalPoint && Number.isFinite(image.focalPoint.x) && Number.isFinite(image.focalPoint.y)
    ? image.focalPoint
    : { x: 50, y: 50 };
  const imageFit = image?.fit === "contain" ? "contain" : "cover";
  const alignment = settings.contentAlignment === "center" || settings.contentAlignment === "right" ? settings.contentAlignment : "left";
  const style: CSSProperties = {
    backgroundColor: typeof settings.background === "string" ? settings.background : undefined,
    paddingTop: typeof settings.paddingTop === "number" ? settings.paddingTop : undefined,
    textAlign: alignment,
    fontFamily: typeof settings.headingFont === "string" ? settings.headingFont : undefined,
  };
  const overlay = typeof settings.overlay === "number" ? Math.max(0, Math.min(100, settings.overlay)) / 100 : 0;
  return <section className={`jelly-section jelly-hero${image ? " has-image" : ""}`} style={style}><StorefrontContainer className={settings.fullBleed === true ? "is-full-bleed" : undefined}><div className="jelly-hero-content">
    {typeof settings.eyebrow === "string" && settings.eyebrow && <p className="jelly-eyebrow">{settings.eyebrow}</p>}
    {section.blocks.filter((block) => block.enabled).map((block) => {
    const text = setting(block, block.type === "button" ? "label" : "text");
    if (!text) return null;
    const editorProps = editor ? { "data-editor-block-id": block.id, "data-editor-field-key": block.type === "button" ? "label" : "text" } : {};
    if (block.type === "heading") return <h1 key={block.id} {...editorProps}>{text}</h1>;
    if (block.type === "button") return <a className="jelly-button" href={setting(block, "href") ?? "#"} key={block.id} {...editorProps}>{text}</a>;
    return <p key={block.id} {...editorProps}>{text}</p>;
    })}
    {typeof settings.summary === "string" && settings.summary && <p className="jelly-hero-summary">{settings.summary}</p>}
    {typeof settings.body === "string" && settings.body && <div className="jelly-hero-body">{settings.body}</div>}
  </div>{image && <div className="jelly-hero-media">
    {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={image.url} alt={image.alt} style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%`, objectFit: imageFit }} />
    {overlay > 0 && <span aria-hidden="true" style={{ background: `rgba(0, 0, 0, ${overlay})` }} />}
  </div>}</StorefrontContainer></section>;
}
