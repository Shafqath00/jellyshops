"use client";

import { useState } from "react";
import { productMediaSrcSet, productMediaUrl, type ProductMediaLike } from "@jelly/storefront-schema";

export function ProductGalleryViewer({ media, title, fit = "contain" }: { media: ProductMediaLike[]; title: string; fit?: "contain" | "cover" }) {
  // Keyed gallery content resets the main image whenever its visible set/order changes.
  return <GalleryContent key={media.map((item) => `${item.id}:${item.url}`).join("|")} media={media} title={title} fit={fit} />;
}

function GalleryContent({ media, title, fit }: { media: ProductMediaLike[]; title: string; fit: "contain" | "cover" }) {
  const [active, setActive] = useState(0);
  const item = media[active];
  const preload = (photo: ProductMediaLike) => {
    const image = new Image();
    image.srcset = productMediaSrcSet(photo) ?? "";
    image.sizes = "(min-width: 1024px) 50vw, 100vw";
    image.src = photo.url;
  };
  return <div className="jelly-gallery-viewer">
    <div style={{ aspectRatio: "1 / 1", width: "100%", overflow: "hidden", background: "var(--jelly-surface, #f4f4f4)", display: "grid", placeItems: "center" }}>
      {item ? <img key={item.id} data-testid="gallery-main" src={item.url} srcSet={productMediaSrcSet(item)} sizes="(min-width: 1024px) 50vw, 100vw" width={item.width ?? undefined} height={item.height ?? undefined} alt={item.altText ?? title} loading="eager" fetchPriority="high" style={{ width: "100%", height: "100%", objectFit: fit, animation: "jelly-gallery-fade 150ms ease-out" }} />
        : <div role="img" aria-label={`No photo for ${title}`}>No photo available</div>}
    </div>
    {media.length > 1 && <div role="group" aria-label="Product photos" style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 2px" }}>
      {media.map((photo, index) => <button key={photo.id} type="button" aria-label={`Show photo ${index + 1}: ${photo.altText || title}`} aria-pressed={index === active} onClick={() => setActive(index)} onPointerEnter={() => preload(photo)} onFocus={() => preload(photo)} style={{ flex: "0 0 64px", height: 64, padding: 2, border: index === active ? "2px solid currentColor" : "2px solid transparent", borderRadius: 6 }}>
        <img src={productMediaUrl(photo.url, 320)} width={64} height={64} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </button>)}
    </div>}
    <style>{"@keyframes jelly-gallery-fade{from{opacity:.35}to{opacity:1}}@media(prefers-reduced-motion:reduce){.jelly-gallery-viewer img{animation:none!important}}"}</style>
  </div>;
}
