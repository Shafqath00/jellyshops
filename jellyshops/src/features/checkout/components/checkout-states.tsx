import Link from "next/link";
import type { CheckoutProblem } from "../checkout-errors";

/** Shown while the saved bag is read from the browser. */
export function CheckoutLoading() {
  return (
    <div className="jelly-checkout__loading" role="status" aria-live="polite">
      <span className="jelly-checkout__sr">Loading your checkout…</span>
      <div className="jelly-checkout__skeleton" aria-hidden="true"><span /><span /><span /></div>
      <div className="jelly-checkout__skeleton" aria-hidden="true"><span /><span /></div>
    </div>
  );
}

export function CheckoutEmpty({ shopHref }: { shopHref: string }) {
  return (
    <div className="jelly-checkout__state">
      <h1 className="jelly-checkout__title">Your bag is empty</h1>
      <p>Add something you love, then come back to check out.</p>
      <Link className="jelly-checkout__primary jelly-checkout__primary--inline" href={shopHref}>Browse the shop</Link>
    </div>
  );
}

export function CheckoutProblemBanner({ problem, onRetry }: { problem: CheckoutProblem; onRetry?: () => void }) {
  return (
    <div className="jelly-checkout__alert" role="alert">
      <p>{problem.message}</p>
      {problem.retryable && onRetry && <button type="button" className="jelly-checkout__link" onClick={onRetry}>Try again</button>}
    </div>
  );
}
