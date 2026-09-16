"use client";

import { CreditCard, RotateCcw, ShieldAlert } from "lucide-react";
import { useState } from "react";
import type { MerchantOrderStatus, MerchantPayment, MerchantPaymentDispute, MerchantRefund } from "../api/types";

interface OrderPaymentPanelProps {
  payment: MerchantPayment | null;
  refunds: MerchantRefund[];
  disputes: MerchantPaymentDispute[];
  fulfilmentStatus: MerchantOrderStatus;
  requestFullRefund: () => Promise<MerchantRefund>;
}

function readableStatus(status: string): string {
  return status.replaceAll("_", " ").toLowerCase();
}

function refundMessage(refund: MerchantRefund): string {
  switch (refund.status) {
    case "PENDING":
      return "Refund is pending. Stripe will confirm the final outcome.";
    case "REQUIRES_ACTION":
      return "Refund requires action in Stripe.";
    case "SUCCEEDED":
      return "Full refund completed.";
    case "FAILED":
      return "Refund failed. Check the payment in Stripe before taking another action.";
    case "CANCELLED":
      return "Refund was cancelled.";
  }
}

/** Payment, refund, and dispute state deliberately stay separate from fulfilment. */
export function OrderPaymentPanel({ payment, refunds, disputes, fulfilmentStatus, requestFullRefund }: OrderPaymentPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [latestRefund, setLatestRefund] = useState<MerchantRefund | null>(null);
  const visibleRefunds = latestRefund && !refunds.some((refund) => refund.id === latestRefund.id) ? [...refunds, latestRefund] : refunds;
  const hasRefund = visibleRefunds.length > 0;
  const canRequestRefund = payment?.status === "PAID" && !hasRefund;

  async function confirmRefund() {
    setSubmitting(true);
    setError("");
    try {
      setLatestRefund(await requestFullRefund());
      setConfirming(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to request the refund.");
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="form-card" aria-label="Payment and refund">
    <div className="form-card-title">
      <div><span>Payment</span><h2>Payment, refunds & disputes</h2></div>
      <CreditCard size={19} />
    </div>

    <p className="detail-copy">Fulfilment: {readableStatus(fulfilmentStatus)}</p>

    {payment ? <div className="mt-4 rounded-lg border border-black/10 p-3">
      <small>Card payment</small>
      <p className="font-bold">{readableStatus(payment.status)}</p>
      {payment.paymentIntentId ? <p className="detail-copy">Payment reference: {payment.paymentIntentId}</p> : null}
    </div> : <p className="mt-4 detail-copy">No payment is attached to this order yet.</p>}

    {visibleRefunds.length > 0 ? <div className="mt-4 space-y-2" aria-label="Refund status">
      {visibleRefunds.map((refund) => <p className={refund.status === "FAILED" ? "text-danger" : "detail-copy"} key={refund.id}>
        <b>Refund:</b> {refundMessage(refund)}
      </p>)}
    </div> : null}

    {disputes.length > 0 ? <div className="mt-4 space-y-2" aria-label="Payment disputes">
      {disputes.map((dispute) => <p className="flex items-center gap-2 text-danger" key={dispute.stripeDisputeId}><ShieldAlert size={16} /> Payment dispute: {readableStatus(dispute.status)}</p>)}
    </div> : null}

    {error ? <p className="mt-4 text-danger" role="alert">{error}</p> : null}
    {canRequestRefund ? <button type="button" className="button button-secondary mt-4" onClick={() => setConfirming(true)}><RotateCcw size={16} /> Issue full refund</button> : null}

    {confirming ? <div className="mt-4 rounded-lg border border-jelly-guava/40 bg-jelly-guava/10 p-4" role="dialog" aria-modal="true" aria-label="Confirm full refund">
      <h3 className="font-bold">Confirm full refund</h3>
      <p className="detail-copy mt-1">This requests a full refund through Stripe. It cannot be changed to a partial refund here.</p>
      <div className="mt-3 flex gap-2"><button type="button" className="button button-primary" onClick={confirmRefund} disabled={submitting}>{submitting ? "Requesting refund…" : "Confirm refund"}</button><button type="button" className="button button-secondary" onClick={() => setConfirming(false)} disabled={submitting}>Keep order</button></div>
    </div> : null}
  </section>;
}
