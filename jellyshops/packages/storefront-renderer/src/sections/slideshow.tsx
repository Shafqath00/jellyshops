import { useEffect, useRef, useState } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { resolveStorefrontHref } from "../runtime-context";
import { choice, imageValue, numberValue, sectionData, stringValue, visibleBlocks } from "./shared";

/**
 * Full-width image slideshow. Slides change automatically when the merchant
 * turns it on, but pause while the pointer or keyboard focus is inside, when
 * the visitor prefers reduced motion, and in the editor. Every slide stays in
 * the DOM so headings remain available to search engines and screen readers.
 */
export function SlideshowSection({ section, context, editor = false }: { section: SectionNode; context: StorefrontRuntimeContext; editor?: boolean }) {
  const slides = visibleBlocks(section, "slide").map((block) => ({
    id: block.id,
    image: imageValue(block.settings),
    eyebrow: stringValue(block.settings, "eyebrow"),
    heading: stringValue(block.settings, "heading"),
    text: stringValue(block.settings, "text"),
    buttonLabel: stringValue(block.settings, "buttonLabel"),
    href: resolveStorefrontHref(block.settings.buttonLink || "/shop", context.storeSlug),
  }));
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const count = slides.length;
  const current = count ? Math.min(active, count - 1) : 0;
  const autoplay = section.settings.autoplay === true && count > 1 && !editor;
  const interval = numberValue(section.settings, "interval", 6, 3, 12) * 1000;
  const overlay = numberValue(section.settings, "overlay", 30, 0, 100) / 100;
  useEffect(() => {
    const view = rootRef.current?.ownerDocument.defaultView;
    if (!autoplay || paused || !view || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = view.setTimeout(() => setActive((index) => (index + 1) % count), interval);
    return () => view.clearTimeout(timer);
  }, [autoplay, paused, interval, count, current]);
  if (!count) return editor ? <section className="jelly-section jelly-slideshow" {...sectionData(section)}><p className="jelly-editor-hint">Add a slide to start your slideshow.</p></section> : null;
  const go = (index: number) => setActive((index + count) % count);
  const editorProps = (id: string, field: string) => editor ? { "data-editor-block-id": id, "data-editor-field-key": field } : {};
  return <section
    ref={rootRef}
    className="jelly-slideshow"
    aria-roledescription="carousel"
    aria-label="Featured"
    onMouseEnter={() => setPaused(true)}
    onMouseLeave={() => setPaused(false)}
    onFocus={() => setPaused(true)}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false); }}
    {...sectionData(section, {
      "data-height": choice(section.settings, "height", ["medium", "large"] as const, "large"),
      "data-align": choice(section.settings, "contentAlignment", ["left", "center", "right"] as const, "center"),
    })}
  >
    <div className="jelly-slideshow-track" aria-live={autoplay && !paused ? "off" : "polite"}>
      {slides.map((slide, index) => <div
        key={slide.id}
        className="jelly-slide"
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${count}`}
        aria-hidden={index === current ? undefined : true}
        data-active={index === current ? "true" : undefined}
        inert={index === current ? undefined : true}
      >
        {slide.image && <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="jelly-slide-media" src={slide.image.url} alt={slide.image.alt ?? ""} style={{ objectPosition: `${slide.image.focalPoint?.x ?? 50}% ${slide.image.focalPoint?.y ?? 50}%` }} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : undefined} />
          {overlay > 0 && <span className="jelly-slide-overlay" aria-hidden="true" style={{ background: `rgba(0, 0, 0, ${overlay})` }} />}
        </>}
        <div className="jelly-slide-content">
          {slide.eyebrow && <p className="jelly-eyebrow" {...editorProps(slide.id, "eyebrow")}>{slide.eyebrow}</p>}
          {slide.heading && (index === 0 ? <h1 {...editorProps(slide.id, "heading")}>{slide.heading}</h1> : <h2 {...editorProps(slide.id, "heading")}>{slide.heading}</h2>)}
          {slide.text && <p {...editorProps(slide.id, "text")}>{slide.text}</p>}
          {slide.buttonLabel && slide.href && <div className="jelly-hero-actions"><a className="jelly-button" href={slide.href} {...editorProps(slide.id, "buttonLabel")}>{slide.buttonLabel}</a></div>}
        </div>
      </div>)}
    </div>
    {count > 1 && <div className="jelly-slideshow-controls">
      <button type="button" className="jelly-slideshow-arrow" aria-label="Previous slide" onClick={() => go(current - 1)}><span aria-hidden="true">←</span></button>
      <div className="jelly-slideshow-dots">{slides.map((slide, index) => <button key={slide.id} type="button" aria-label={`Show slide ${index + 1}`} aria-current={index === current ? "true" : undefined} onClick={() => go(index)} />)}</div>
      <button type="button" className="jelly-slideshow-arrow" aria-label="Next slide" onClick={() => go(current + 1)}><span aria-hidden="true">→</span></button>
    </div>}
  </section>;
}
