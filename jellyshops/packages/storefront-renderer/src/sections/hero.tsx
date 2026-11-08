import type { CSSProperties } from "react";
import { elementProps } from "../element-style";
import { inlineSetting } from "./setting-text";
import type { SectionNode } from "@jelly/storefront-schema";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { blockStyle } from "../block-style";
import { buttonProps } from "./block-content";
import { countdownTarget, HeroCountdown } from "./hero-countdown";
import { blockLabel } from "@jelly/storefront-registry";
import { choice, editorBlockData, imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

/** Hero layouts: split (R2), overlay, text, spotlight (R4), statement (R9) and countdown (R6). */
export const HERO_LAYOUTS = ["split", "overlay", "text", "spotlight", "statement", "countdown"] as const;

function setting(block: SectionNode["blocks"][number], key: string): string | undefined {
  const value = block.settings[key];
  return typeof value === "string" ? value : undefined;
}

export function HeroSection({ section, editor = false, context, selectedBlockId }: { section: SectionNode; editor?: boolean; context: StorefrontRuntimeContext; selectedBlockId?: string }) {
  const settings = section.settings;
  const image = imageValue(settings);
  const focalPoint = image?.focalPoint && Number.isFinite(image.focalPoint.x) && Number.isFinite(image.focalPoint.y) ? image.focalPoint : { x: 50, y: 50 };
  const alignment = choice(settings, "contentAlignment", ["left", "center", "right"] as const, "left");
  const requested = choice(settings, "layout", HERO_LAYOUTS, "split");
  // Statement and countdown work without a photo; the photo layouts fall back to text only.
  const layout = image || requested === "statement" || requested === "countdown" ? requested : "text";
  const callouts = layout === "spotlight" ? (stringValue(settings, "callouts") ?? "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 4) : [];
  const countdown = layout === "countdown" ? countdownTarget(settings.countdownTo) : null;
  const countdownEnd = stringValue(settings, "countdownEndText");
  const style: CSSProperties = {
    backgroundColor: typeof settings.background === "string" ? settings.background : undefined,
    paddingTop: typeof settings.paddingTop === "number" ? settings.paddingTop : undefined,
    textAlign: alignment,
    fontFamily: typeof settings.headingFont === "string" ? settings.headingFont : undefined,
  };
  const overlay = numberValue(settings, "overlay", layout === "overlay" ? 30 : 0, 0, 100) / 100;
  const blocks = visibleBlocks(section);
  const editorProps = (block: SectionNode["blocks"][number]) => editor ? editorBlockData(block.id, blockLabel(block.type), selectedBlockId, block.type === "button" ? "label" : "text") : {};
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
        {eyebrow && <p className="jelly-eyebrow" {...elementProps(section, "eyebrow", editor)}>{eyebrow}</p>}
        {blocks.filter((block) => block.type !== "button").map((block) => {
          const text = setting(block, "text");
          if (!text) return null;
          return block.type === "heading" ? <h1 key={block.id} {...blockStyle(block)} {...editorProps(block)}>{inlineSetting(block.settings, "text", text)}</h1> : <p key={block.id} {...blockStyle(block)} {...editorProps(block)}>{text}</p>;
        })}
        {countdown !== null && <HeroCountdown target={countdown} endText={countdownEnd} />}
        {summary && <p className="jelly-hero-summary">{summary}</p>}
        {typeof settings.body === "string" && settings.body && <div className="jelly-hero-body">{settings.body}</div>}
        {buttons.length > 0 && <div className="jelly-hero-actions">{buttons.map(({ block, label, href }, index) => href
          ? <a href={href} key={block.id} {...buttonProps(block.settings, index, block.responsive?.mobile)} {...editorProps(block)}>{label}</a>
          : <span key={block.id} {...editorProps(block)}>{label}</span>)}</div>}
      </div>
      {image && layout !== "text" && <div className="jelly-hero-media" {...elementProps(section, "image", editor)}>
        {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.alt ?? ""} style={{ objectPosition: `${focalPoint.x}% ${focalPoint.y}%`, objectFit: image.fit === "contain" || layout === "spotlight" ? "contain" : "cover" }} fetchPriority="high" />
        {overlay > 0 && <span className="jelly-hero-overlay" aria-hidden="true" style={{ background: `rgba(0, 0, 0, ${overlay})` }} />}
        {callouts.length > 0 && <ul className="jelly-hero-callouts" {...elementProps(section, "callouts", editor)}>{callouts.map((callout, index) => <li key={`${index}-${callout}`} data-side={index % 2 === 0 ? "start" : "end"}>{callout}</li>)}</ul>}
      </div>}
    </StorefrontContainer>
  </section>;
}
