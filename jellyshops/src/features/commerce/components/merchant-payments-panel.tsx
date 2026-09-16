"use client";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { getMerchantSession } from "../merchant-session";

interface Status { connected: boolean; checkoutReady: boolean; cardPaymentsStatus?: string; payoutsStatus?: string; requirements?: Record<string, unknown>; closed?: boolean }

export function MerchantPaymentsPanel() {
  const session = getMerchantSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);
  const origin = process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001";
  useEffect(() => { if (!session) { setLoading(false); return; } fetch(`${origin}/api/stores/${session.storeId}/stripe-connect/status`, { headers: { Authorization: `Bearer ${session.token}` } }).then(async (response) => { if (!response.ok) throw new Error("Unable to load Stripe status"); return response.json(); }).then(setStatus).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load Stripe status")).finally(() => setLoading(false)); }, [origin, session]);
  if (loading) return <div className="form-card flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Loading payment status…</div>;
  if (!session) return <div className="form-card"><h2>Payments unavailable</h2><p className="detail-copy">Sign in as a merchant to manage Stripe payments.</p></div>;
  if (error) return <div className="form-card"><p className="text-danger">{error}</p></div>;
  async function startOnboarding() { setOpening(true); setError(""); try { const response = await fetch(`${origin}/api/stores/${session!.storeId}/stripe-connect/onboarding-link`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.token}` }, body: JSON.stringify({ returnUrl: window.location.href, refreshUrl: window.location.href }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message ?? "Unable to start onboarding"); window.location.assign(body.url); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start onboarding"); setOpening(false); } }
  if (!status?.connected) return <div className="form-card"><h2>Connect Stripe</h2><p className="detail-copy">Finish Stripe onboarding before customers can pay.</p><button className="button button-primary" onClick={startOnboarding} disabled={opening}>{opening ? "Opening Stripe…" : "Start onboarding"} <ExternalLink size={16} /></button></div>;
  return <div className="space-y-4"><section className="form-card"><div className="form-card-title"><div><span>Stripe account</span><h2>Payment readiness</h2></div>{status.closed ? <AlertCircle className="text-danger" /> : status.checkoutReady ? <CheckCircle2 className="text-green-600" /> : <AlertCircle />}</div><div className="grid gap-3 sm:grid-cols-2"><div><small>Card payments</small><p className="font-bold">{status.cardPaymentsStatus ?? "unknown"}</p></div><div><small>Payouts</small><p className="font-bold">{status.payoutsStatus ?? "unknown"}</p></div></div>{status.closed ? <p className="mt-4 text-danger">This Stripe account is closed.</p> : !status.checkoutReady ? <p className="mt-4 detail-copy">Complete the requirements in your Full Stripe Dashboard before accepting payments.</p> : <p className="mt-4 text-green-700">Customers can pay by card. Stripe manages processing fees and payouts.</p>}</section><section className="form-card"><h2>Full Stripe Dashboard</h2><p className="detail-copy">Manage payouts, verification, disputes and reporting directly in Stripe.</p></section></div>;
}
