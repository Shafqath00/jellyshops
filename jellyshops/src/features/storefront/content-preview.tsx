"use client";

import { useEffect, useState } from "react";
import type { RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import type { Currency, Product } from "@/lib/domain";
import { resolveStorefrontRoute, type PublicStorefrontResource, type ResolvedStorefrontRoute } from "./resource-loader";
import { PublishedRuntimeStorefront } from "./storefront-page";
import { allowedPreviewOrigins, readPreviewDraft, withDraftMenus, PREVIEW_MENUS_EVENT, PREVIEW_READY, type ContentPreviewDraft } from "./content-preview-messages";

export { allowedPreviewOrigins, readPreviewDraft, withDraftMenus, PREVIEW_DRAFT, PREVIEW_READY, type ContentPreviewDraft, type MenuPreviewDraft } from "./content-preview-messages";


/**
 * Draft preview for pages and blog posts: the admin opens this route in a frame (or a new tab) and sends the
 * unsaved draft with postMessage. It is drawn through the store's real template, theme, header and footer, exactly
 * like the live page. Nothing is saved and nothing is fetched with the merchant's sign-in.
 *
 * Messages are only accepted from this site or the admin host, so another site can't make a shop show text it chose.
 */
function resourceFor(draft: ContentPreviewDraft, storeSlug: string): PublicStorefrontResource {
  const id = `preview-${draft.kind}`;
  const item = { id, handle: draft.handle || "preview", title: draft.title || "Untitled", content: draft.content, publishedAt: draft.publishedAt ?? new Date().toISOString() };
  const data: Record<string, unknown> = draft.kind === "page"
    ? { page: item, storeSlug }
    : { blog: draft.blog ?? { id: "preview-blog", handle: "news", title: "Blog" }, article: { ...item, excerpt: draft.excerpt ?? "", authorName: draft.authorName ?? null, tags: draft.tags ?? [] }, storeSlug };
  return { type: draft.kind, id, handle: item.handle, visible: true, data };
}

export function ContentPreview({ snapshot, storeSlug, currency, products }: { snapshot: RuntimeStorefrontSnapshotV4; storeSlug: string; currency: Currency; products: Product[] }) {
  const [route, setRoute] = useState<ResolvedStorefrontRoute | null>(null);
  const [shown, setShown] = useState(snapshot);
  const [problem, setProblem] = useState("");

  useEffect(() => {
    const allowed = allowedPreviewOrigins(window.location.origin);
    const listener = (event: MessageEvent) => {
      if (!allowed.includes(event.origin)) return;
      const draft = readPreviewDraft(event.data);
      if (!draft) return;
      if (draft.kind === "menus") {
        const next = withDraftMenus(snapshot, draft.menus);
        // The store layout draws the header and footer; it listens for this on the preview page only.
        window.dispatchEvent(new CustomEvent(PREVIEW_MENUS_EVENT, { detail: draft.menus }));
        resolveStorefrontRoute(next, { type: "home" }, { findByHandle: async () => null, findById: async () => null })
          .then((home) => { if (home.status === "ready") { setShown(next); setRoute(home); setProblem(""); } else setProblem("This store's design has no home page layout yet. Publish your store design first."); })
          .catch(() => setProblem("The preview could not be drawn. Close it and try again."));
        return;
      }
      const resource = resourceFor(draft, storeSlug);
      setShown(snapshot);
      resolveStorefrontRoute(snapshot, { type: draft.kind, handle: resource.handle }, { findByHandle: async () => resource, findById: async () => resource })
        .then((next) => {
          if (next.status === "ready") { setRoute(next); setProblem(""); }
          else setProblem("This store's design has no layout for this kind of page yet. Publish your store design first.");
        })
        .catch(() => setProblem("The preview could not be drawn. Close it and try again."));
    };
    window.addEventListener("message", listener);
    // Tell the admin we're ready for the draft (the message itself carries nothing private).
    (window.parent !== window ? window.parent : window.opener as Window | null)?.postMessage({ type: PREVIEW_READY }, "*");
    return () => window.removeEventListener("message", listener);
  }, [snapshot, storeSlug]);

  return (
    <>
      <div className="jelly-preview-badge" role="status">Preview · not live</div>
      {problem ? <p className="jelly-preview-problem">{problem}</p> : null}
      {route ? <PublishedRuntimeStorefront snapshot={shown} route={route} storeSlug={storeSlug} currency={currency} products={products} /> : !problem ? <p className="jelly-preview-problem" aria-busy="true">Loading the preview…</p> : null}
    </>
  );
}
