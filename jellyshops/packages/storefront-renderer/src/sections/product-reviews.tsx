import { useEffect, useId, useState, type CSSProperties, type FormEvent } from "react";
import { StorefrontContainer } from "@jelly/storefront-ui";
import type { StorefrontRuntimeContext } from "../runtime-context";
import type { StorefrontReview, StorefrontReviewPage } from "../types";

function productId(context: StorefrontRuntimeContext): string | null {
  const data = context.page?.pageType === "product" ? context.page.resource.data.productPresentation : undefined;
  const product = data && typeof data === "object" ? (data as { product?: { id?: unknown } }).product : undefined;
  return typeof product?.id === "string" ? product.id : null;
}

const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;
const EMPTY: StorefrontReviewPage = { summary: { average: 0, count: 0, distribution: [0, 0, 0, 0, 0] }, reviews: [] };

export function Stars({ value, label }: { value: number; label?: string }) {
  return <span className="jelly-stars" style={{ "--jelly-stars": Math.max(0, Math.min(5, value)) } as CSSProperties} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>★★★★★</span>;
}

function ReviewItem({ review }: { review: StorefrontReview }) {
  const date = new Date(review.createdAt);
  return <li className="jelly-review">
    <div className="jelly-review-head">
      <Stars value={review.rating} label={`${review.rating} out of 5 stars`} />
      {review.title && <h3>{review.title}</h3>}
    </div>
    {review.body && <p className="jelly-review-body">{review.body}</p>}
    <p className="jelly-review-meta">
      <span>{review.authorName}</span>
      {review.verifiedPurchase && <span className="jelly-review-verified">Verified buyer</span>}
      {!Number.isNaN(date.getTime()) && <time dateTime={review.createdAt}>{date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</time>}
    </p>
  </li>;
}

function ReviewForm({ onSubmit }: { onSubmit(review: { rating: number; title?: string; body?: string; authorName: string; email?: string; website?: string }): Promise<{ ok: boolean; message?: string }> }) {
  const id = useId();
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!rating) { setError("Choose a star rating."); return; }
    const authorName = String(form.get("authorName") ?? "").trim();
    if (!authorName) { setError("Add your name."); return; }
    setState("sending");
    setError("");
    const result = await onSubmit({
      rating, authorName,
      title: String(form.get("title") ?? "").trim() || undefined,
      body: String(form.get("body") ?? "").trim() || undefined,
      email: String(form.get("email") ?? "").trim() || undefined,
      website: String(form.get("website") ?? "") || undefined,
    }).catch(() => ({ ok: false, message: undefined }));
    if (result.ok) setState("sent");
    else { setState("idle"); setError(result.message ?? "Your review couldn't be sent. Please try again."); }
  };
  if (state === "sent") return <p className="jelly-review-thanks" role="status">Thank you. Your review will appear once the shop has checked it.</p>;
  return <form className="jelly-review-form" onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
    <h3 id={`${id}-title`}>Write a review</h3>
    <fieldset className="jelly-review-rating-input">
      <legend>Your rating</legend>
      {[1, 2, 3, 4, 5].map((value) => <label key={value} data-on={value <= rating ? "true" : undefined}>
        <input type="radio" name="rating" value={value} checked={rating === value} onChange={() => setRating(value)} />
        <span aria-hidden="true">★</span><span className="jelly-visually-hidden">{value} {value === 1 ? "star" : "stars"}</span>
      </label>)}
    </fieldset>
    <label>Your name<input name="authorName" autoComplete="name" maxLength={80} required /></label>
    <label>Email (optional, never shown)<input name="email" type="email" autoComplete="email" maxLength={254} /></label>
    <label>Title (optional)<input name="title" maxLength={120} /></label>
    <label>Your review<textarea name="body" rows={4} maxLength={2000} /></label>
    {/* Left empty by people; bots that fill every field are ignored by the shop. */}
    <label className="jelly-review-website" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
    {error && <p className="jelly-review-error" role="alert">{error}</p>}
    <button type="submit" className="jelly-button" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send review"}</button>
  </form>;
}

/**
 * Reviews section of the product page (template programme): rating summary with stars per rating, published reviews
 * newest first with "Show more", and a form whose reviews wait for the merchant. Data comes from `commerce.reviews`;
 * the editor shows the empty state.
 */
export function ProductReviewsSection({ context, section }: { context: StorefrontRuntimeContext; section: { settings: Record<string, unknown> } }) {
  const id = productId(context);
  const access = context.commerce.reviews;
  const perPage = typeof section.settings.perPage === "number" ? Math.max(3, Math.min(20, section.settings.perPage)) : 5;
  const [data, setData] = useState<StorefrontReviewPage>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const [writing, setWriting] = useState(false);
  useEffect(() => {
    if (!id || !access) return;
    let live = true;
    access.list(id, { limit: perPage }).then((page) => { if (live) { setData(page); setMore(page.reviews.length >= perPage); setLoaded(true); } }).catch(() => { if (live) setLoaded(true); });
    return () => { live = false; };
  }, [id, access, perPage]);
  if (!id) return null;
  const heading = text(section.settings.heading, "Customer reviews");
  const empty = text(section.settings.emptyText, "No reviews yet. Be the first to share what you think.");
  const allowWriting = section.settings.allowWriting !== false && Boolean(access);
  const { summary } = data;
  const loadMore = async () => {
    if (!access) return;
    const page = await access.list(id, { limit: perPage, offset: data.reviews.length }).catch(() => null);
    if (!page) return;
    setData((current) => ({ ...current, reviews: [...current.reviews, ...page.reviews] }));
    setMore(page.reviews.length >= perPage);
  };
  // id "reviews": the Rating line and themes link here ("Read reviews").
  return <section id="reviews" className="jelly-section jelly-product-reviews" aria-busy={access && !loaded ? true : undefined}>
    <StorefrontContainer>
      <h2>{heading}</h2>
      <div className="jelly-reviews-layout">
        <div className="jelly-reviews-summary">
          {summary.count > 0 ? <>
            <p className="jelly-reviews-average"><strong>{summary.average.toFixed(1)}</strong><span className="jelly-visually-hidden"> out of 5</span></p>
            <Stars value={summary.average} label={`Average rating ${summary.average.toFixed(1)} out of 5`} />
            <p className="jelly-reviews-count">{summary.count === 1 ? "Based on 1 review" : `Based on ${summary.count} reviews`}</p>
            <ul className="jelly-reviews-bars" aria-label="Reviews per rating">
              {summary.distribution.map((count, index) => <li key={index}>
                <span>{5 - index} ★</span>
                <span className="jelly-reviews-bar" aria-hidden="true"><span style={{ width: `${summary.count ? (count / summary.count) * 100 : 0}%` }} /></span>
                <span>{count}<span className="jelly-visually-hidden"> {count === 1 ? "review" : "reviews"} with {5 - index} stars</span></span>
              </li>)}
            </ul>
          </> : <p className="jelly-reviews-empty">{empty}</p>}
          {allowWriting && !writing && <button type="button" className="jelly-button jelly-button--secondary" onClick={() => setWriting(true)}>Write a review</button>}
        </div>
        <div className="jelly-reviews-main">
          {allowWriting && writing && <ReviewForm onSubmit={(review) => access!.submit(id, review)} />}
          {data.reviews.length > 0 && <ul className="jelly-reviews-list">{data.reviews.map((review) => <ReviewItem key={review.id} review={review} />)}</ul>}
          {more && <button type="button" className="jelly-button jelly-button--link" onClick={() => void loadMore()}>Show more reviews</button>}
        </div>
      </div>
    </StorefrontContainer>
  </section>;
}
