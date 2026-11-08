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
  /** The same for text, links and controls only (a link around a photo counts by its text). */
  textLeft: number | null;
  textRight: number | null;
  /** Content runs to at least one side of the frame (edge-to-edge media or panels). */
  fullBleed: boolean;
  /** Its content moves sideways on its own (a scrolling strip), so its text runs past the edges by design. */
  scrolling: boolean;
  /** Placed in one column of a page laid out in columns (the product page's info column), not a row of its own. */
  inColumn: boolean;
  paddingTop: number;
  paddingBottom: number;
}

export interface CardListMeasurement {
  key: string;
  /** Width / height of each card image in the list. */
  ratios: number[];
}

export interface HeaderMeasurement {
  height: number;
  /** Header menu links and the store name that run onto two or more lines. */
  wrapped: string[];
}

export interface PageMeasurement {
  frameWidth: number;
  /** The site header (null when the page has none). */
  header: HeaderMeasurement | null;
  /** Space between the product page's details, options and Add to cart, top to bottom (px); empty on other pages. */
  productGaps: number[];
  /** Font size of the page's main title when it is not inside a hero, slideshow or banner (null otherwise). */
  pageTitleSize: number | null;
  /** Font sizes of the footer's column headings (the footer newsletter heading is left out). */
  footerHeadingSizes: number[];
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
  /** Left/right of the text boxes inside `element`. A link around a photo (a product card) counts by its text only, not its photo's box. */
  const textExtent = (element: Element): { left: number | null; right: number | null } => {
    let left: number | null = null;
    let right: number | null = null;
    const add = (from: number, to: number) => {
      left = left === null ? from : Math.min(left, from);
      right = right === null ? to : Math.max(right, to);
    };
    for (const item of element.querySelectorAll(contentSelector)) {
      if (item.matches("a, li") && item.querySelector("img, picture, video")) continue; // its own text elements are measured on their own
      const rect = visibleRect(item);
      if (rect) add(rect.left, rect.right);
    }
    return { left, right };
  };
  /** Rows laid out in two or more columns, e.g. the product page's photos | details. */
  const columnCount = (element: Element | null) => element ? getComputedStyle(element).gridTemplateColumns.split(" ").filter((track) => track && track !== "none").length : 0;
  /** A row of items laid across the content column: a grid of two or more columns, or a flex row of two or more items. */
  const isRow = (element: Element) => {
    const style = getComputedStyle(element);
    if (style.display.includes("grid")) return columnCount(element) >= 2;
    return style.display.includes("flex") && !style.flexDirection.startsWith("column") && element.children.length >= 2;
  };
  const parts: PartMeasurement[] = [];
  for (const element of topLevel) {
    const box = element.getBoundingClientRect();
    if (box.height <= 1 || getComputedStyle(element).display === "none") continue;
    const classes = [...element.classList].filter((name) => name !== "jelly-section" && name.startsWith("jelly-"));
    const base = classes[0] ?? element.tagName.toLowerCase();
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    const { left: textLeft, right: textRight } = textExtent(element);
    // Images, videos and coloured panels count as content too (a split layout's image is its left edge), and so do rows
    // of items (grids, flex rows): three centred columns that fill the page are on its edges even when their text is shorter.
    const style = getComputedStyle(element);
    let left = textLeft;
    let right = textRight;
    for (const item of element.querySelectorAll("*")) {
      const isMedia = /^(IMG|VIDEO|PICTURE|IFRAME|CANVAS)$/.test(item.tagName);
      let isBox = false;
      if (!isMedia && isRow(item)) isBox = Boolean(item.textContent?.trim()) || Boolean(item.querySelector("img, video, picture"));
      if (!isMedia && !isBox) {
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
    // A section inside a page laid out in columns that takes only some of them (Avenue and Minimal put product details
    // in the right-hand column): it is judged as part of that row, not against the page edges.
    const frame = element.closest("[data-section-frame]") ?? element;
    const page = frame.parentElement;
    const inColumn = Boolean(page && getComputedStyle(page).display.includes("grid") && columnCount(page) >= 2 && frame.getBoundingClientRect().width < page.getBoundingClientRect().width - 2);
    parts.push({
      key: count > 1 ? `${base}#${count}` : base,
      isSection: element.hasAttribute("data-section-id") && !isChrome,
      left: left === null ? null : round(left),
      right: right === null ? null : round(right),
      textLeft: textLeft === null ? null : round(textLeft),
      textRight: textRight === null ? null : round(textRight),
      fullBleed,
      scrolling: Boolean(element.matches("[data-scrolling]") || element.querySelector("[data-scrolling]")),
      inColumn,
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

  // Header: wrapped menu links or store name, and height.
  let header: HeaderMeasurement | null = null;
  const headerElement = root.querySelector(".jelly-header");
  const headerRect = headerElement ? visibleRect(headerElement) : null;
  if (headerElement && headerRect) {
    const wrapped: string[] = [];
    for (const item of headerElement.querySelectorAll(".jelly-header-brand, .jelly-header nav:not(.jelly-header-tools) a, .jelly-header nav:not(.jelly-header-tools) summary")) {
      if (item.closest(".jelly-mobile-navigation-panel, [role='menu'], .jelly-menu-dropdown")) continue;
      const rect = visibleRect(item);
      if (!rect || item.querySelector("img")) continue;
      // Count the lines the text itself sits on (each line of a text range gets its own box).
      const range = doc.createRange();
      range.selectNodeContents(item);
      const tops: number[] = [];
      for (const box of range.getClientRects()) {
        if (box.width < 1 || box.height < 1) continue;
        if (!tops.some((top) => Math.abs(top - box.top) < box.height / 2)) tops.push(box.top);
      }
      if (tops.length > 1) wrapped.push(describe(item));
    }
    header = { height: round(headerRect.height ?? 0), wrapped };
  }

  // Product page: gaps between the buying parts in the order they appear.
  const productParts = [".jelly-product-information", ".jelly-product-options", ".jelly-product-purchase"]
    .map((selector) => root.querySelector(selector))
    .flatMap((element) => { const rect = element ? element.getBoundingClientRect() : null; return rect && rect.height > 1 ? [rect] : []; });
  const productGaps = productParts.slice(1).map((rect, index) => round(rect.top - productParts[index].bottom));

  // Main title outside heroes.
  const title = root.querySelector("main h1");
  const titleIsHero = Boolean(title?.closest(".jelly-hero, .jelly-slideshow, .jelly-image-banner, .jelly-collection-header[data-layout='banner'], [data-section-type='hero'], [data-section-type='slideshow'], [data-section-type='image-banner']"));
  const pageTitleSize = title && !titleIsHero && visibleRect(title) ? round(parseFloat(getComputedStyle(title).fontSize)) : null;

  const footerHeadingSizes = [...root.querySelectorAll(".jelly-footer h2, .jelly-footer h3, .jelly-footer h4")]
    .filter((heading) => !heading.closest(".jelly-footer-newsletter, .jelly-newsletter") && visibleRect(heading))
    .map((heading) => round(parseFloat(getComputedStyle(heading).fontSize)));

  return {
    frameWidth,
    header,
    productGaps,
    pageTitleSize,
    footerHeadingSizes,
    overflow: Math.max(0, doc.documentElement.scrollWidth - doc.documentElement.clientWidth),
    parts,
    headingSizes,
    smallTargets,
    cardLists,
  };
}
