"use client";
/**
 * Movement on the live store, switched on by theme settings > Animations (tokens on the theme root):
 * - `--jelly-motion-reveal`: sections below the fold fade up into view as the shopper scrolls (their cards follow in a
 *   short stagger), and product cards lift when pointed at. Framer Motion's small DOM entry does the animating.
 * - `--jelly-motion-smooth`: Lenis softens wheel scrolling.
 * Nothing moves for shoppers whose device asks for less motion, nothing is hidden before the script runs (the server
 * HTML stays fully visible), and the libraries are only downloaded when the theme turns the setting on.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SKIP = new Set(["announcement-bar", "header"]);
const CARDS = ".jelly-product-card, .jelly-category-card, .jelly-testimonial-card";
const EASE = [0.22, 1, 0.36, 1] as const;
/** A section that entered view is always visible after this long, whatever happened to its animation. */
export const SAFETY_MS = 1500;

function themeRoot(): HTMLElement | null {
  return document.querySelector<HTMLElement>("[data-jelly-theme]");
}

function wantsLessMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function themeAsks(root: HTMLElement, token: string): boolean {
  return getComputedStyle(root).getPropertyValue(token).trim() === "1";
}

/** Sections that start below the visible part of the page; the ones already on screen never move. */
export function sectionsToReveal(root: ParentNode, viewportHeight: number): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("[data-section-frame]")].filter((frame) => {
    const type = frame.getAttribute("data-section-type") ?? frame.querySelector("[data-section-type]")?.getAttribute("data-section-type") ?? "";
    return !SKIP.has(type) && frame.getBoundingClientRect().top > viewportHeight * 0.9;
  });
}

function clear(element: HTMLElement) {
  // A transform left on a section would break sticky photos and the fixed buy bar inside it.
  element.style.removeProperty("opacity");
  element.style.removeProperty("transform");
}

export function StorefrontMotion() {
  const pathname = usePathname();

  useEffect(() => {
    const root = themeRoot();
    if (!root || wantsLessMotion() || !themeAsks(root, "--jelly-motion-reveal")) return;
    let cancelled = false;
    const stops: Array<() => void> = [];
    const frames = sectionsToReveal(root, window.innerHeight);
    void import("framer-motion/dom").then(({ animate, inView, hover, stagger }) => {
      if (cancelled) return;
      for (const frame of frames) {
        frame.style.opacity = "0";
        frame.style.transform = "translateY(28px)";
        stops.push(inView(frame, () => {
          // Safety net: if animation frames stall (a throttled tab, a slow device), the section is shown anyway.
          const fallback = window.setTimeout(() => { clear(frame); frame.querySelectorAll<HTMLElement>(CARDS).forEach(clear); }, SAFETY_MS);
          stops.push(() => window.clearTimeout(fallback));
          const cards = [...frame.querySelectorAll<HTMLElement>(CARDS)].slice(0, 12);
          void Promise.resolve(animate(frame, { opacity: 1, transform: "translateY(0px)" }, { duration: 0.7, ease: EASE })).then(() => clear(frame));
          if (cards.length > 1) void Promise.resolve(animate(cards, { opacity: [0, 1], transform: ["translateY(16px)", "translateY(0px)"] }, { duration: 0.5, delay: stagger(0.06, { startDelay: 0.12 }), ease: EASE })).then(() => cards.forEach(clear));
        }, { amount: 0.12 }));
      }
      stops.push(hover(root.querySelectorAll<HTMLElement>(".jelly-product-card"), (card) => {
        void animate(card, { transform: "translateY(-4px)" }, { duration: 0.25, ease: EASE });
        return () => { void Promise.resolve(animate(card, { transform: "translateY(0px)" }, { duration: 0.25, ease: EASE })).then(() => clear(card as HTMLElement)); };
      }));
    }).catch(() => frames.forEach(clear));
    return () => {
      cancelled = true;
      stops.forEach((stop) => stop());
      frames.forEach(clear);
    };
  }, [pathname]);

  useEffect(() => {
    const root = themeRoot();
    if (!root || wantsLessMotion() || !themeAsks(root, "--jelly-motion-smooth")) return;
    let lenis: { destroy(): void } | undefined;
    let cancelled = false;
    void import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      // Drawers, menus, dialogs and anything scrollable inside keep their own scrolling.
      lenis = new Lenis({ autoRaf: true, anchors: true, allowNestedScroll: true, prevent: (node) => Boolean(node.closest?.("dialog, [role='dialog'], [aria-modal='true'], [data-lenis-prevent]")) });
    }).catch(() => undefined);
    return () => { cancelled = true; lenis?.destroy(); };
  }, []);

  return null;
}
