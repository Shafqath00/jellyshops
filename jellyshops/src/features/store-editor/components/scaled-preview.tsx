"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Keeps the preview at a real device width, like Shopify's editor: when the editor
 * has less room than that width, the frame is drawn at the full width and shrunk to
 * fit, so the store's responsive rules (phone below 768px, tablet up to 1023px)
 * follow the chosen device rather than the size of the editor window.
 */
export function previewFit(available: { width: number; height: number }, minWidth: number): { width: number; height: number; scale: number } {
  if (available.width <= 0) return { width: minWidth, height: available.height, scale: 1 };
  const width = Math.max(available.width, minWidth);
  const scale = Math.min(1, available.width / width);
  return { width, height: scale < 1 ? available.height / scale : available.height, scale };
}

export function ScaledPreview({ minWidth, children }: { minWidth: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => setAvailable((current) => current.width === element.clientWidth && current.height === element.clientHeight ? current : { width: element.clientWidth, height: element.clientHeight });
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fit = previewFit(available, minWidth);
  return (
    <div ref={box} className="relative h-full w-full overflow-hidden" data-preview-scale={fit.scale.toFixed(3)}>
      <div style={{ width: fit.width, height: fit.height || "100%", transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
