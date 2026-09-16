"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { createMerchantCommerceApi } from "../api/client";
import type { StripeMerchantStatus } from "../api/types";
import { getMerchantSession } from "../merchant-session";

interface MerchantPaymentsPanelProps {
  /** Browser navigation is injectable so the Stripe-hosted handoff remains testable. */
  redirect?: (url: string) => void;
}

function dueRequirements(requirements: Record<string, unknown> | undefined): string[] {
  const nested = requirements?.requirements;
  const source = nested && typeof nested === "object" && !Array.isArray(nested) ? nested as Record<string, unknown> : requirements;
  return Array.isArray(source?.currently_due) ? source.currently_due.filter((item): item is string => typeof item === "string") : [];
}

export function MerchantPaymentsPanel({ redirect = (url) => window.location.assign(url) }: MerchantPaymentsPanelProps) {
  const session = getMerchantSession();
  const storeId = session?.storeId;
  const token = session?.token;
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  const api = useMemo(
    () => storeId && token ? createMerchantCommerceApi({ baseUrl: origin, token }) : null,
    [origin, storeId, token],
  );
  const [status, setStatus] = useState<StripeMerchantStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(api));
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!api || !storeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api.getStripeStatus(storeId)
      .then((result) => { if (!cancelled) setStatus(result); })
      .catch((caught) => { if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load Stripe status"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api, storeId]);

  async function startOnboarding() {
    if (!api || !storeId) return;
    setOpening(true);
    setError("");
    try {
      const currentUrl = window.location.href;
      const { url } = await api.createOnboardingLink(storeId, { returnUrl: currentUrl, refreshUrl: currentUrl });
      redirect(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start onboarding");
      setOpening(false);
    }
  }

  if (loading) return <div className="form-card flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading payment status…</div>;
  if (!api) return <div className="form-card"><h2>Payments unavailable</h2><p className="detail-copy">Sign in as a merchant to manage Stripe payments.</p></div>;
  if (error) return <div className="form-card"><p className="text-danger" role="alert">{error}</p></div>;
  if (!status?.connected) return <div className="form-card"><h2>Connect Stripe</h2><p className="detail-copy">Finish Stripe onboarding before customers can pay.</p><button type="button" className="button button-primary" onClick={startOnboarding} disabled={opening}>{opening ? "Opening Stripe…" : "Start onboarding"} <ExternalLink size={16} /></button></div>;
  if (status.closed) return <div className="form-card"><div className="form-card-title"><div><span>Stripe account</span><h2>Payments unavailable</h2></div><AlertCircle className="text-danger" /></div><p className="mt-4 text-danger">This Stripe account is closed.</p></div>;

  const inactiveCards = status.cardPaymentsStatus !== "active";
  const requirements = dueRequirements(status.requirements);
  return <div className="space-y-4"><section className="form-card"><div className="form-card-title"><div><span>Stripe account</span><h2>Payment readiness</h2></div>{status.checkoutReady ? <CheckCircle2 className="text-green-600" /> : <AlertCircle />}</div><div className="grid gap-3 sm:grid-cols-2"><div><small>Card payments</small><p className="font-bold">{status.cardPaymentsStatus ?? "unknown"}</p></div><div><small>Payouts</small><p className="font-bold">{status.payoutsStatus ?? "unknown"}</p></div></div>{requirements.length > 0 ? <div className="mt-4"><small>Required to activate payments</small><ul className="mt-1 list-disc pl-5 detail-copy">{requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></div> : null}{inactiveCards ? <div className="mt-4"><p className="detail-copy">Card payments are inactive. Complete the requirements in Stripe before accepting payments.</p><button type="button" className="button button-primary mt-3" onClick={startOnboarding} disabled={opening}>{opening ? "Opening Stripe…" : "Continue Stripe onboarding"} <ExternalLink size={16} /></button></div> : <p className="mt-4 text-green-700">Customers can pay by card. Stripe manages processing fees and payouts.</p>}</section><section className="form-card"><h2>Full Stripe Dashboard</h2><p className="detail-copy">Manage payouts, verification, disputes and reporting directly in Stripe.</p>{status.dashboardUrl ? <a className="button button-secondary mt-3 inline-flex" href={status.dashboardUrl} target="_blank" rel="noreferrer">Open Stripe Dashboard <ExternalLink size={16} /></a> : null}</section></div>;
}
