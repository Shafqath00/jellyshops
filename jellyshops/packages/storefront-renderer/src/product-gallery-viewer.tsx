"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { productMediaSrcSet, productMediaUrl, type ProductMediaLike } from "@jelly/storefront-schema";

/** Shape of every photo frame in a gallery, so photos of any size line up (Product gallery > Photo shape). */
export const GALLERY_RATIOS = { square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3" } as const;
export type GalleryRatio = keyof typeof GALLERY_RATIOS | "original";

/** The CSS aspect ratio for a gallery: a fixed shape, or the first photo's own shape (square when unknown). */
export function galleryAspectRatio(ratio: GalleryRatio | undefined, media: ProductMediaLike[]): string | undefined {
  if (!ratio) return undefined;
  if (ratio !== "original") return GALLERY_RATIOS[ratio];
  const first = media[0];
  return first?.width && first?.height ? `${first.width} / ${first.height}` : "1 / 1";
}

const SIZES = "(min-width: 1024px) 50vw, 100vw";
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

type GalleryProps = {
  media: ProductMediaLike[];
  title: string;
  fit?: "contain" | "cover";
  /** Thumbnails under the photo, or in a column beside it on wide screens. */
  thumbnails?: "below" | "left";
  ratio?: GalleryRatio;
  /** Full-screen viewing with zoom. */
  zoom?: boolean;
};

/**
 * The product photo gallery (Product gallery > Thumbnails): one photo at a time in a fixed-shape frame, swipe or
 * arrows to move, thumbnails to jump, a counter, keyboard arrows, and full-screen viewing with zoom. The photo set
 * follows the chosen options (the product page passes the photos for the selected variant first), and the gallery
 * goes back to the first photo whenever that set changes.
 */
export function ProductGalleryViewer(props: GalleryProps) {
  return <GalleryContent key={props.media.map((item) => `${item.id}:${item.url}`).join("|")} {...props} />;
}

function GalleryContent({ media, title, fit = "contain", thumbnails = "below", ratio, zoom = true }: GalleryProps) {
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const track = useRef<HTMLUListElement>(null);
  const count = media.length;

  const show = useCallback((index: number) => {
    const next = Math.max(0, Math.min(count - 1, index));
    setActive(next);
    const element = track.current;
    if (element && typeof element.scrollTo === "function") element.scrollTo({ left: next * element.clientWidth, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [count]);

  // Swiping (or a trackpad) moves the strip; the counter and thumbnails follow the photo that is mostly in view.
  const onScroll = () => {
    const element = track.current;
    if (!element || !element.clientWidth) return;
    const index = Math.round(element.scrollLeft / element.clientWidth);
    if (index !== active && index >= 0 && index < count) setActive(index);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") { event.preventDefault(); show(active + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); show(active - 1); }
  };
  const preload = (photo: ProductMediaLike) => {
    if (typeof Image === "undefined") return;
    const image = new Image();
    image.srcset = productMediaSrcSet(photo) ?? "";
    image.sizes = SIZES;
    image.src = photo.url;
  };
  const style = { "--jelly-gallery-ratio": galleryAspectRatio(ratio, media), "--jelly-gallery-fit": fit } as CSSProperties;

  if (!count) return <div className="jelly-gallery" style={style}><div className="jelly-gallery-stage"><div className="jelly-gallery-empty" role="img" aria-label={`No photo for ${title}`}>No photo available</div></div></div>;
  return <div className="jelly-gallery" data-thumbs={count > 1 ? thumbnails : undefined} style={style}>
    <div className="jelly-gallery-stage" role="region" aria-roledescription="carousel" aria-label={`${title} photos`} onKeyDown={count > 1 ? onKeyDown : undefined}>
      {/* The strip itself takes keyboard focus: it is what scrolls (arrow keys move between photos). */}
      <ul className="jelly-gallery-track" ref={track} onScroll={onScroll} tabIndex={count > 1 ? 0 : undefined}>
        {media.map((photo, index) => <li key={photo.id} className="jelly-gallery-slide" aria-roledescription="slide" aria-label={`Photo ${index + 1} of ${count}`} aria-hidden={index === active ? undefined : true}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img data-testid={index === active ? "gallery-main" : undefined} src={photo.url} srcSet={productMediaSrcSet(photo)} sizes={SIZES} width={photo.width ?? undefined} height={photo.height ?? undefined} alt={photo.altText || title} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} draggable={false} />
        </li>)}
      </ul>
      {count > 1 && <>
        <button type="button" className="jelly-gallery-arrow" data-direction="previous" onClick={() => show(active - 1)} disabled={active === 0} aria-label="Previous photo"><span aria-hidden="true">‹</span></button>
        <button type="button" className="jelly-gallery-arrow" data-direction="next" onClick={() => show(active + 1)} disabled={active === count - 1} aria-label="Next photo"><span aria-hidden="true">›</span></button>
        <p className="jelly-gallery-counter" aria-live="polite">{active + 1} / {count}</p>
      </>}
      {zoom && <button type="button" className="jelly-gallery-expand" onClick={() => setLightbox(active)} aria-label={`View photo ${active + 1} full screen`}><span aria-hidden="true">⤢</span></button>}
    </div>
    {count > 1 && <div className="jelly-gallery-thumbs" role="group" aria-label="Product photos">
      {media.map((photo, index) => <button key={photo.id} type="button" aria-label={`Show photo ${index + 1}: ${photo.altText || title}`} aria-pressed={index === active} onClick={() => show(index)} onPointerEnter={() => preload(photo)} onFocus={() => preload(photo)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={productMediaUrl(photo.url, 320)} width={80} height={80} alt="" loading="lazy" />
      </button>)}
    </div>}
    {zoom && lightbox !== null && <GalleryLightbox media={media} title={title} start={lightbox} onClose={(index) => { setLightbox(null); show(index); }} />}
  </div>;
}

/**
 * Full-screen photo viewer: a modal dialog (focus stays inside, Escape closes) with previous/next, a counter and
 * tap or click to zoom; while zoomed, moving the pointer pans the photo.
 */
export function GalleryLightbox({ media, title, start, onClose }: { media: ProductMediaLike[]; title: string; start: number; onClose(index: number): void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const photo = media[index];
  const count = media.length;
  const go = (next: number) => { setIndex(Math.max(0, Math.min(count - 1, next))); setZoomed(false); };
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (typeof element.showModal === "function" && !element.open) element.showModal();
    else element.setAttribute("open", "");
  }, []);
  const close = () => { dialog.current?.close?.(); onClose(index); };
  const pointAt = (event: MouseEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    setOrigin(`${((event.clientX - box.left) / box.width) * 100}% ${((event.clientY - box.top) / box.height) * 100}%`);
  };
  return <dialog ref={dialog} className="jelly-gallery-lightbox" aria-label={`${title} photos`} onCancel={(event) => { event.preventDefault(); close(); }} onKeyDown={(event) => {
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  }}>
    <div className="jelly-gallery-lightbox-bar">
      <p aria-live="polite">{index + 1} / {count}</p>
      <button type="button" onClick={close} aria-label="Close full screen view">×</button>
    </div>
    {photo && <button type="button" className="jelly-gallery-lightbox-photo" data-zoomed={zoomed ? "true" : undefined} aria-label={zoomed ? "Zoom out" : "Zoom in"} onClick={(event) => { pointAt(event); setZoomed((value) => !value); }} onPointerMove={zoomed ? pointAt : undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} srcSet={productMediaSrcSet(photo)} sizes="100vw" alt={photo.altText || title} style={{ transformOrigin: origin }} draggable={false} />
    </button>}
    {count > 1 && <>
      <button type="button" className="jelly-gallery-arrow" data-direction="previous" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo"><span aria-hidden="true">‹</span></button>
      <button type="button" className="jelly-gallery-arrow" data-direction="next" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="Next photo"><span aria-hidden="true">›</span></button>
    </>}
  </dialog>;
}

/**
 * Product gallery > Large first image / Grid: every photo on the page at once, each in the same-shape frame, and a
 * click opens the full-screen viewer at that photo.
 */
export function ProductPhotoGrid({ media, title, fit = "cover", ratio, zoom = true, layout }: { media: ProductMediaLike[]; title: string; fit?: "contain" | "cover"; ratio?: GalleryRatio; zoom?: boolean; layout: "stacked" | "grid" }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const style = { "--jelly-gallery-ratio": galleryAspectRatio(ratio, media), "--jelly-gallery-fit": fit } as CSSProperties;
  return <div className="jelly-photo-grid" data-layout={layout} data-count={media.length} style={style}>
    {media.map((photo, index) => {
      // eslint-disable-next-line @next/next/no-img-element
      const image = <img src={photo.url} srcSet={productMediaSrcSet(photo)} sizes={layout === "stacked" && index === 0 ? SIZES : "(min-width: 1024px) 25vw, 50vw"} width={photo.width ?? undefined} height={photo.height ?? undefined} alt={photo.altText || title} loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} />;
      return <figure key={photo.id} className="jelly-product-gallery-item">
        {zoom ? <button type="button" onClick={() => setLightbox(index)} aria-label={`View photo ${index + 1} of ${media.length} full screen`}>{image}</button> : image}
      </figure>;
    })}
    {zoom && lightbox !== null && <GalleryLightbox media={media} title={title} start={lightbox} onClose={() => setLightbox(null)} />}
  </div>;
}
