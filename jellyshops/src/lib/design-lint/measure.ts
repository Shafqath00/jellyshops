/**
 * Design lint: measurements taken inside a rendered storefront page (the theme preview frame).
 *
 * `measureStorefrontPage` is passed to Playwright's `evaluate`, so it must stay self-contained:
 * no imports, no references to anything outside the function body. Rules live in `rules.ts`.
 * Contract: docs/design-contract.md.
 */

export interface PartMeasurement {
  /** Stable name for the part, e.g. "jelly-header" or "jelly-product-grid#2". */
  key: string;
  /** Section in the page body (not announcement, header or footer). */
  isSection: boolean;
  /** Left/right edge of the part's visible content (text, media, coloured panels), in px from the frame's left edge; null when empty. */
  left: number | null;
  right: number | null;
  /** The same for text, links, controls and product cards only. */
  textLeft: number | null;
  textRight: number | null;
  /** Content runs to at least one side of the frame (edge-to-edge media or panels). */
  fullBleed: boolean;
  paddingTop: number;
  paddingBottom: number;
}

export interface CardListMeasurement {
  key: string;
  /** Width / height of each card image in the list. */
  ratios: number[];
}

export interface PageMeasurement {
  frameWidth: number;
  overflow: number;
  parts: PartMeasurement[];
  headingSizes: number[];
  smallTargets: string[];
  cardLists: CardListMeasurement[];
}

export function measureStorefrontPage(): PageMeasurement {
  const doc = document;
  const root = (doc.querySelector("[data-jelly-theme]") ?? doc.body) as HTMLElement;
  const frameWidth = doc.documentElement.clientWidth;
  const round = (value: number) => Math.round(value * 10) / 10;

  /** The element's box after clipping by scrolling/hidden-overflow ancestors and the frame; null when nothing shows. */
  const visibleRect = (element: Element): { left: number; right: number; width: number; height: number } | null => {
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return null;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return null;
    let left = rect.left;
    let right = rect.right;
    let top = rect.top;
    let bottom = rect.bottom;
    for (let parent = element.parentElement; parent && parent !== doc.body; parent = parent.parentElement) {
      const parentStyle = getComputedStyle(parent);
      if (parentStyle.display === "none" || parentStyle.visibility === "hidden" || Number(parentStyle.opacity) === 0) return null;
      const clipsX = parentStyle.overflowX !== "visible";
      const clipsY = parentStyle.overflowY !== "visible";
      if (!clipsX && !clipsY && !parentStyle.clip.startsWith("rect")) continue;
      const box = parent.getBoundingClientRect();
      if (parentStyle.clip.startsWith("rect") && (box.width <= 1 || box.height <= 1)) return null;
      if (clipsX) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
      if (clipsY) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
    }
    left = Math.max(left, 0);
    right = Math.min(right, frameWidth);
    if (right - left <= 1 || bottom - top <= 1) return null;
    return { left, right, width: rect.width, height: rect.height };
  };

  // Top-level parts: announcement, header, sections, footer.
  const candidates = [...root.querySelectorAll<HTMLElement>(".jelly-announcement, .jelly-header, [data-section-id], .jelly-footer")];
  const topLevel = candidates.filter((element) => !candidates.some((other) => other !== element && other.contains(element)));
  const seen = new Map<string, number>();
  const contentSelector = "h1, h2, h3, h4, h5, h6, p, a, button, input, select, textarea, label, li, blockquote, figcaption";
  const parts: PartMeasurement[] = [];
  for (const element of topLevel) {
    const box = element.getBoundingClientRect();
    if (box.height <= 1 || getComputedStyle(element).display === "none") continue;
    const classes = [...element.classList].filter((name) => name !== "jelly-section" && name.startsWith("jelly-"));
    const base = classes[0] ?? element.tagName.toLowerCase();
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    let textLeft: number | null = null;
    let textRight: number | null = null;
    for (const item of element.querySelectorAll(contentSelector)) {
      const rect = visibleRect(item);
      if (!rect) continue;
      textLeft = textLeft === null ? rect.left : Math.min(textLeft, rect.left);
      textRight = textRight === null ? rect.right : Math.max(textRight, rect.right);
    }
    // Images, videos and coloured panels count as content too (a split layout's image is its left edge).
    const style = getComputedStyle(element);
    let left = textLeft;
    let right = textRight;
    for (const item of element.querySelectorAll("*")) {
      const isMedia = /^(IMG|VIDEO|PICTURE|IFRAME|CANVAS)$/.test(item.tagName);
      let isBox = false;
      if (!isMedia) {
        const itemStyle = getComputedStyle(item);
        const ownColour = itemStyle.backgroundColor !== "rgba(0, 0, 0, 0)" && itemStyle.backgroundColor !== "transparent" && itemStyle.backgroundColor !== style.backgroundColor;
        isBox = ownColour || itemStyle.backgroundImage !== "none";
      }
      if (!isMedia && !isBox) continue;
      const rect = visibleRect(item);
      if (!rect || rect.width < 40 || rect.height < 24) continue;
      left = left === null ? rect.left : Math.min(left, rect.left);
      right = right === null ? rect.right : Math.max(right, rect.right);
    }
    // Touching either side of the frame counts (a split hero whose photo runs off the right edge).
    const fullBleed = left !== null && right !== null && (left <= 1 || right >= frameWidth - 1);
    let paddingTop = parseFloat(style.paddingTop) || 0;
    let paddingBottom = parseFloat(style.paddingBottom) || 0;
    if (!paddingTop && !paddingBottom && element.firstElementChild) {
      const inner = getComputedStyle(element.firstElementChild);
      paddingTop = parseFloat(inner.paddingTop) || 0;
      paddingBottom = parseFloat(inner.paddingBottom) || 0;
    }
    const isChrome = classes.some((name) => /^jelly-(announcement|header|footer)/.test(name));
    parts.push({
      key: count > 1 ? `${base}#${count}` : base,
      isSection: element.hasAttribute("data-section-id") && !isChrome,
      left: left === null ? null : round(left),
      right: right === null ? null : round(right),
      textLeft: textLeft === null ? null : round(textLeft),
      textRight: textRight === null ? null : round(textRight),
      fullBleed,
      paddingTop: round(paddingTop),
      paddingBottom: round(paddingBottom),
    });
  }

  const headingSizes = [...new Set([...root.querySelectorAll("h1, h2, h3, h4")]
    .filter((heading) => visibleRect(heading))
    .map((heading) => round(parseFloat(getComputedStyle(heading).fontSize))))].sort((a, b) => a - b);

  const describe = (element: Element) => {
    const label = (element.getAttribute("aria-label") || element.textContent || element.getAttribute("name") || "").trim().replace(/\s+/g, " ").slice(0, 30);
    return `${element.tagName.toLowerCase()}${label ? ` "${label}"` : ""}`;
  };
  const smallTargets: string[] = [];
  for (const target of root.querySelectorAll("a[href], button, input:not([type='hidden']), select, textarea, summary, [role='button']")) {
    if (target.closest("p, .jelly-setting-text, .jelly-rich-text, .jelly-page-content, .jelly-article-content")) continue; // links in running text are exempt
    const rect = visibleRect(target);
    if (!rect) continue;
    if (rect.height < 24 || rect.width < 24) smallTargets.push(`${describe(target)} ${Math.round(rect.width)}×${Math.round(rect.height)}`);
  }

  const lists = new Map<Element, number[]>();
  for (const media of root.querySelectorAll(".jelly-product-card-media")) {
    const rect = visibleRect(media);
    const list = media.closest(".jelly-product-card")?.parentElement;
    if (!rect || !list) continue;
    lists.set(list, [...(lists.get(list) ?? []), Math.round((rect.width / rect.height) * 1000) / 1000]);
  }
  const cardLists: CardListMeasurement[] = [...lists.entries()].map(([list, ratios], index) => {
    const part = list.closest("[data-section-id]");
    const name = part ? [...part.classList].find((item) => item.startsWith("jelly-") && item !== "jelly-section") : undefined;
    return { key: `${name ?? "list"}#${index + 1}`, ratios };
  });

  return {
    frameWidth,
    overflow: Math.max(0, doc.documentElement.scrollWidth - doc.documentElement.clientWidth),
    parts,
    headingSizes,
    smallTargets,
    cardLists,
  };
}
