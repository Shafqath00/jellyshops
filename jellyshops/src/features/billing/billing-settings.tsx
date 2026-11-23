"use client";

import { useEffect, useState } from "react";
import { Banner, Button, Card, SkeletonBlock, StatusBadge } from "@/components/admin";
import { billingNotices, formatDay, loadBillingSummary, openBillingPage, trialDaysLeft, usageLabel, usageText, type BillingSummary } from "./billing-summary";

const currentPage = () => (typeof window === "undefined" ? "" : window.location.origin + window.location.pathname);
const justPaid = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("billing") === "done";

function planLine(summary: BillingSummary, now: Date): string {
  if (summary.exempt || summary.status === "none") return "This shop is not charged.";
  if (summary.status === "trialing" && summary.trialEndsAt) {
    const days = trialDaysLeft(summary, now) ?? 0;
    return days > 0 ? `Your free trial ends on ${formatDay(summary.trialEndsAt)} (${days} ${days === 1 ? "day" : "days"} left).` : `Your free trial ended on ${formatDay(summary.trialEndsAt)}.`;
  }
  if (summary.currentPeriodEnd) {
    return summary.cancelAtPeriodEnd || summary.status === "canceled"
      ? `Your plan ends on ${formatDay(summary.currentPeriodEnd)}.`
      : `Your plan renews on ${formatDay(summary.currentPeriodEnd)}.`;
  }
  return "";
}

/**
 * Settings > Plan and billing: the shop's plan, trial or renewal, and how much of the plan it uses. Paying and changing
 * plans arrive with Stripe Billing (docs/plans/2026-11-23-phase-4-billing-and-limits.md, step 4d).
 */
export function BillingSettings({ storeId, token, fetcher = fetch, now = new Date(), returnUrl = currentPage(), navigate = (url: string) => window.location.assign(url), returned = justPaid() }: {
  storeId: string; token: string; fetcher?: typeof fetch; now?: Date;
  /** Where Stripe sends the merchant back (this page). */
  returnUrl?: string;
  /** Opens the Stripe page (tests pass a stand-in). */
  navigate?: (url: string) => void;
  /** Back from Stripe Checkout (?billing=done). */
  returned?: boolean;
}) {
  const [summary, setSummary] = useState<BillingSummary | null | undefined>(undefined);
  // Back from paying: read fresh, not the cached copy from before.
  const [attempt, setAttempt] = useState(returned ? 1 : 0);
  const [opening, setOpening] = useState<"checkout" | "portal" | null>(null);
  const [openError, setOpenError] = useState("");

  const open = (kind: "checkout" | "portal") => {
    setOpening(kind);
    setOpenError("");
    openBillingPage(kind, storeId, token, returnUrl, fetcher)
      .then(navigate)
      .catch((failure: unknown) => { setOpenError(failure instanceof Error ? failure.message : "Stripe couldn't be opened."); setOpening(null); });
  };

  useEffect(() => {
    let cancelled = false;
    loadBillingSummary(storeId, token, fetcher, attempt > 0).then((value) => { if (!cancelled) setSummary(value); });
    return () => { cancelled = true; };
  }, [storeId, token, fetcher, attempt]);

  if (summary === undefined) {
    return <Card title="Your plan"><div className="jk-stack-sm" aria-busy="true"><SkeletonBlock width="40%" height={16} /><SkeletonBlock width="70%" /></div></Card>;
  }
  if (summary === null) {
    return <Banner tone="warning" title="Billing details aren't available" action={<Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>Try again</Button>}>
      Only the shop owner can see billing. If you are the owner, try again in a moment.
    </Banner>;
  }

  const notices = billingNotices(summary, now).filter((notice) => notice.tone === "critical");
  const chargeable = !summary.exempt && summary.status !== "none";
  const canSubscribe = !summary.hasSubscription || summary.status === "canceled";
  return <div className="jk-stack-sm">
    {returned && <Banner tone="success" title="Thank you">Your plan is being set up. It can take a minute to show here.</Banner>}
    {notices.map((notice) => <Banner key={notice.title} tone={notice.tone} title={notice.title}>{notice.text}</Banner>)}
    <Card title="Your plan">
      <div className="jk-billing-plan">
        <div>
          <p className="jk-billing-plan-name">{summary.planName} <StatusBadge kind="billing" value={summary.exempt ? "exempt" : summary.status} /></p>
          {planLine(summary, now) && <p className="jk-billing-plan-line">{planLine(summary, now)}</p>}
        </div>
      </div>
      {chargeable && !summary.checkoutAvailable && <p className="jk-hint">You&apos;ll be able to choose how to pay for your plan here soon.</p>}
      {chargeable && summary.checkoutAvailable && <div className="jk-billing-actions">
        {canSubscribe && <Button variant="primary" loading={opening === "checkout"} loadingLabel="Opening Stripe…" disabled={opening !== null} onClick={() => open("checkout")}>Choose a plan</Button>}
        {summary.hasSubscription && <Button variant={canSubscribe ? "secondary" : "primary"} loading={opening === "portal"} loadingLabel="Opening Stripe…" disabled={opening !== null} onClick={() => open("portal")}>Manage billing</Button>}
        <p className="jk-hint">{canSubscribe ? "You'll pay securely on Stripe and come back here." : "Change your card, see invoices or cancel on Stripe."}</p>
      </div>}
      {openError && <Banner tone="critical" title="Stripe couldn't be opened">{openError}</Banner>}
    </Card>
    <Card title="Usage" description="What this shop uses of its plan. Nothing is deleted when something is full; you just can't add more.">
      <ul className="jk-billing-usage">
        {summary.usage.map((item) => {
          const share = item.limit ? Math.min(1, item.used / item.limit) : 0;
          return <li key={item.kind} className="jk-progress-block">
            <span className="jk-billing-usage-head"><strong>{usageLabel(item.kind)}</strong><span>{usageText(item)}</span></span>
            {item.limit !== null && <progress className="jk-progress" max={1} value={share} aria-label={`${usageLabel(item.kind)}: ${usageText(item)}`} />}
          </li>;
        })}
      </ul>
    </Card>
  </div>;
}
