"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ──────────────────────────────────────────────────────────────────────
 * JellyMarquee — Rare UI brand moment: scrolling text/icon strip
 *
 * Motion:    CSS-only, uses --animate-jelly-marquee from @theme
 * Pattern:   Rare UI marquee adapted to Jellyshop tokens
 * Usage:     Homepage hero strip, campaign sections, collection banners
 *
 * Reduced motion: paused via @media CSS (no JS hook needed)
 * ──────────────────────────────────────────────────────────────────── */

interface MarqueeProps {
  items: React.ReactNode[];
  separator?: React.ReactNode;
  speed?: "slow" | "default" | "fast";
  reverse?: boolean;
  className?: string;
  itemClassName?: string;
}

export function JellyMarquee({
  items,
  separator,
  speed = "default",
  reverse = false,
  className,
  itemClassName,
}: MarqueeProps) {
  const duration = {
    slow: "48s",
    default: "32s",
    fast: "16s",
  }[speed];

  /* Duplicate items so the track loops seamlessly */
  const all = [...items, ...(separator ? items.flatMap((item) => [separator, item]) : items)];
  const doubled = [...all, ...all];

  return (
    <div
      aria-hidden="true"
      className={cn(
        "jelly-marquee relative flex overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent_0%,black_10%,black_90%,transparent_100%)]",
        className,
      )}
    >
      <div
        className="flex shrink-0 gap-8 pr-8"
        style={{
          animation: `jelly-marquee ${duration} linear infinite ${reverse ? "reverse" : ""}`,
          willChange: "transform",
        }}
      >
        {doubled.map((item, i) => (
          <span
            key={i}
            className={cn(
              "flex shrink-0 items-center gap-4 whitespace-nowrap",
              itemClassName,
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────
 * JellyHeroStrip — pre-configured brand strip for storefront hero
 * Rare UI brand moment: appears below hero headline
 * ──────────────────────────────────────────────────────────────────── */

const DEFAULT_STRIP_ITEMS = [
  "Small-batch goods",
  "✦",
  "Hand finished",
  "✦",
  "Made to order",
  "✦",
  "Ships with care",
  "✦",
  "Thoughtfully packed",
  "✦",
];

export function JellyHeroStrip({
  items = DEFAULT_STRIP_ITEMS,
  className,
}: {
  items?: string[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "jelly-hero-strip overflow-hidden border-y border-[color-mix(in_srgb,var(--store-text,var(--foreground))_15%,transparent)]",
        "bg-[color-mix(in_srgb,var(--store-bg,var(--background))_70%,transparent)]",
        "py-4 text-[11px] font-extrabold uppercase tracking-[0.12em]",
        "text-[color-mix(in_srgb,var(--store-text,var(--foreground))_70%,transparent)]",
        className,
      )}
    >
      <JellyMarquee
        items={items.map((item) => <span key={item}>{item}</span>)}
      />
    </div>
  );
}
