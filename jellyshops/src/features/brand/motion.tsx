"use client";

import Lenis from "lenis";
import { animate, cancelFrame, frame, motion, MotionConfig, useInView, type Variants } from "motion/react";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const hasMatchMedia = () => typeof window !== "undefined" && typeof window.matchMedia === "function";
function subscribeReduced(onChange: () => void) {
  if (!hasMatchMedia()) return () => undefined;
  const query = window.matchMedia(REDUCED_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Reduced-motion preference that is safe during hydration: false on the server and
 * on the first client render (so the HTML matches), then the real value.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => hasMatchMedia() && window.matchMedia(REDUCED_QUERY).matches, () => false);
}

/** Motion skips transform animations for people who prefer reduced motion, even before our own checks kick in. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Ease-out-quint: the single entrance curve used across the home page. */
export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING = { type: "spring", stiffness: 300, damping: 30 } as const;

/**
 * Lenis smooth scrolling, driven by Motion's frame loop so Lenis and Motion's
 * scroll hooks (`useScroll`) read the same scroll position on the same frame.
 * Off entirely for people who prefer reduced motion.
 */
export function SmoothScroll() {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const lenis = new Lenis({ lerp: 0.1, smoothWheel: true, anchors: { offset: -72 } });
    const update = ({ timestamp }: { timestamp: number }) => lenis.raf(timestamp);
    frame.update(update, true);
    return () => {
      cancelFrame(update);
      lenis.destroy();
    };
  }, [reduced]);
  return null;
}

/** Fades and lifts children into view once. Only transform and opacity animate. */
export function Reveal({ children, delay = 0, y = 24, className, as = "div" }: { children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "li" | "section" }) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: reduced ? 0.2 : 0.7, ease: EASE, delay: reduced ? 0 : delay }}
    >
      {children}
    </Tag>
  );
}

/** Staggered list: children animate in one after another. */
export const staggerParent: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

/** Counts up to `value` when it scrolls into view. Keeps the final text for screen readers. */
export function Counter({ value, prefix = "", suffix = "", decimals = 0 }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -15% 0px" });
  const reduced = useReducedMotion();
  const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;
  const final = format(value);

  // Server HTML and no-JS show the real number; with JS it starts at 0 and counts up once seen.
  // `reduced` is false on the first render and may turn true just after (hydration-safe), so put the real number back then.
  useEffect(() => {
    if (!text.current) return;
    if (reduced) text.current.textContent = final;
    else if (!inView) text.current.textContent = format(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  useEffect(() => {
    if (!inView || reduced) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: EASE,
      onUpdate: (latest) => { if (text.current) text.current.textContent = format(latest); },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, value]);

  return (
    <span ref={ref} aria-label={final} role="text">
      <span ref={text} aria-hidden="true">{final}</span>
    </span>
  );
}
