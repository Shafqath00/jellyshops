import { useEffect, useState, type RefObject } from "react";

/**
 * One slider behaviour for every sideways row on the store (reviews, photo gallery, collection carousel): the track
 * scrolls natively (touch swipe, trackpad, keyboard), snaps each slide into place and hides its scrollbar
 * (`[data-slider-track]` rules at the end of storefront-base.css). This hook works out where the track can stop and
 * which stop is current, so `SliderControls` can draw dots and arrows. The next slide peeks in from the right on
 * phones, so the row reads as a slider even before anyone touches it.
 */
export interface SliderState { stops: number[]; current: number; go(index: number): void; step(direction: -1 | 1): void }

function reduced(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** The scroll positions the track can rest at: each slide's start, capped at the end of the track, without repeats. */
export function sliderStops(slideStarts: number[], maxScroll: number): number[] {
  const stops: number[] = [];
  for (const start of slideStarts) {
    const stop = Math.max(0, Math.min(maxScroll, Math.round(start)));
    if (!stops.some((existing) => Math.abs(existing - stop) < 4)) stops.push(stop);
  }
  return stops.length ? stops : [0];
}

export function useSlider(track: RefObject<HTMLElement | null>, count: number): SliderState {
  const [stops, setStops] = useState<number[]>([0]);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const element = track.current;
    if (!element || typeof window === "undefined") return;
    const view = element.ownerDocument.defaultView ?? window;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const first = element.firstElementChild as HTMLElement | null;
        const origin = first?.offsetLeft ?? 0;
        const starts = [...element.children].map((child) => (child as HTMLElement).offsetLeft - origin);
        const next = sliderStops(starts, element.scrollWidth - element.clientWidth);
        setStops((previous) => previous.length === next.length && previous.every((value, index) => value === next[index]) ? previous : next);
        const left = element.scrollLeft;
        let nearest = 0;
        next.forEach((stop, index) => { if (Math.abs(stop - left) < Math.abs(next[nearest] - left)) nearest = index; });
        setCurrent(nearest);
      });
    };
    measure();
    element.addEventListener("scroll", measure, { passive: true });
    view.addEventListener("resize", measure);
    return () => { cancelAnimationFrame(frame); element.removeEventListener("scroll", measure); view.removeEventListener("resize", measure); };
  }, [track, count]);
  const go = (index: number) => {
    const element = track.current;
    if (!element) return;
    const target = stops[Math.max(0, Math.min(stops.length - 1, index))] ?? 0;
    element.scrollTo({ left: target, behavior: reduced() ? "auto" : "smooth" });
  };
  const step = (direction: -1 | 1) => go(current + direction);
  return { stops, current, go, step };
}

/**
 * Dots (one per stop, each a 24px tap target) and previous/next arrows (large screens only). Nothing is drawn when
 * everything already fits. `label` names the row for screen readers ("Customer reviews").
 */
export function SliderControls({ slider, label }: { slider: SliderState; label: string }) {
  const { stops, current, go, step } = slider;
  if (stops.length < 2) return null;
  return <div className="jelly-slider-controls">
    <div className="jelly-slider-dots" role="group" aria-label={`${label}: choose a slide`}>
      {stops.map((stop, index) => <button key={stop} type="button" className="jelly-slider-dot" aria-label={`Show slide ${index + 1} of ${stops.length}`} aria-current={index === current ? "true" : undefined} onClick={() => go(index)} />)}
    </div>
    <div className="jelly-slider-arrows">
      <button type="button" className="jelly-slider-arrow" onClick={() => step(-1)} disabled={current === 0} aria-label={`Previous: ${label}`}><span aria-hidden="true">←</span></button>
      <button type="button" className="jelly-slider-arrow" onClick={() => step(1)} disabled={current === stops.length - 1} aria-label={`Next: ${label}`}><span aria-hidden="true">→</span></button>
    </div>
  </div>;
}
