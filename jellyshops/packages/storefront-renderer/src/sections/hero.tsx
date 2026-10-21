import type { CSSProperties } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { choice, imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

function setting(block: SectionNode["blocks"][number], key: string): string | undefined {
  const value = block.settings[key];
  return typeof value === "string" ? value : undefined;
}

export function HeroSection({ section, editor = false, context }: { section: SectionNode; editor?: boolean; context: StorefrontRuntimeContext }) {
  const settings = section.settings;
  const image = imageValue(settings);
  const focalPoint = image?.focalPoint && Number.isFinite(image.focalPoint.x) && Number.isFinite(image.focalPoint.y) ? image.focalPoint : { x: 50, y: 50 };
  const alignment = choice(settings, "contentAlignment", ["left", "center", "right"] as const, "left");
  const layout = image ? choice(settings, "layout", ["split", "overlay", "text"] as const, "split") : "text";
  const style: CSSProperties = {
    backgroundColor: typeof settings.background === "string" ? settings.background : undefined,
    paddingTop: typeof settings.paddingTop === "number" ? settings.paddingTop : undefined,
    textAlign: alignment,
    fontFamily: typeof settings.headingFont === "string" ? settings.headingFont : undefined,
  };
  const overlay = numberValue(settings, "overlay", layout === "overlay" ? 30 : 0, 0, 100) / 100;
  const blocks = visibleBlocks(section);
  const editorProps = (block: SectionNode["blocks"][number]) => editor ? { "data-editor-block-id": block.id, "data-editor-field-key": block.type === "button" ? "label" : "text" } : {};
  const buttons = blocks.filter((block) => block.type === "button").flatMap((block) => {
    const label = setting(block, "label");
    return label ? [{ block, label, href: resolveStorefrontHref(setting(block, "href") ?? "#", context.storeSlug) }] : [];
  });
  const eyebrow = stringValue(settings, "eyebrow");
  const summary = stringValue(settings, "summary");
  return <section
    className={`jelly-section jelly-hero${image ? " has-image" : ""}`}
    style={style}
    {...sectionData(section, { "data-layout": layout, "data-height": choice(settings, "height", ["medium", "large"] as const, "medium"), "data-align": alignment })}
  >
    <StorefrontContainer className={settings.fullBleed === true ? "is-full-bleed" : undefined}>
      <div className="jelly-hero-content">
        {eyebrow && <p className="jelly-eyebrow">{eyebrow}</p>}
        {blocks.filter((block) => block.type !== "button").map((block) => {
          const text = setting(block, "text");
          if (!text) return null;
          return block.type === "heading" ? <h1 key={block.id} {...editorProps(block)}>{text}</h1> : <p key={block.id} {...editorProps(block)}>{text}</p>;
        })}
        {summary && <p className="jelly-hero-summary">{summary}</p>}
        {typeof settings.body === "string" && settings.body && <div className="jelly-hero-body">{settings.body}</div>}
        {buttons.length > 0 && <div className="jelly-hero-actions">{buttons.map(({ block, label, href }, index) => href
          ? <a className={index === 0 ? "jelly-button" : "jelly-button jelly-button--secondary"} href={href} key={block.id} {...editorProps(block)}>{label}</a>
          : <span key={block.id} {...editorProps(block)}>{label}</span>)}</div>}
      </div>
      {image && layout !== "text" && <div className="jelly-hero-media">
        {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.alt ?? ""} style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%`, objectFit: image.fit === "contain" ? "contain" : "cover" }} fetchPriority="high" />
        {overlay > 0 && <span className="jelly-hero-overlay" aria-hidden="true" style={{ background: `rgba(0, 0, 0, ${overlay})` }} />}
      </div>}
    </StorefrontContainer>
  </section>;
}
