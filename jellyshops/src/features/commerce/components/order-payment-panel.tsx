"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Loader2,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import type {
  MerchantOrderStatus,
  MerchantPayment,
  MerchantPaymentDispute,
  MerchantRefund,
} from "../api/types";

interface OrderPaymentPanelProps {
  payment: MerchantPayment | null;
  refunds: MerchantRefund[];
  disputes: MerchantPaymentDispute[];
  fulfilmentStatus: MerchantOrderStatus;
  requestFullRefund: () => Promise<MerchantRefund>;
}

function label(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function refundMessage(refund: MerchantRefund) {
  const messages: Record<MerchantRefund["status"], string> = {
    PENDING: "Refund is pending confirmation from Stripe.",
    REQUIRES_ACTION: "Refund requires action in Stripe.",
    SUCCEEDED: "Full refund completed.",
    FAILED: "Refund failed. Review the payment in Stripe before trying again.",
    CANCELLED: "Refund was cancelled.",
  };

  return messages[refund.status];
}

function refundStyle(status: MerchantRefund["status"]) {
  if (status === "SUCCEEDED") {
    return "border-border bg-muted/50 text-success";
  }

  if (status === "FAILED" || status === "REQUIRES_ACTION") {
    return "border-tint-border bg-muted/50 text-tint-foreground";
  }

  return "border-border bg-muted/50 text-[var(--warn-fg)]";
}

export function OrderPaymentPanel({
  payment,
  refunds,
  disputes,
  fulfilmentStatus,
  requestFullRefund,
}: OrderPaymentPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [latestRefund, setLatestRefund] =
    useState<MerchantRefund | null>(null);

  const visibleRefunds =
    latestRefund &&
    !refunds.some((refund) => refund.id === latestRefund.id)
      ? [...refunds, latestRefund]
      : refunds;

  const canRequestRefund =
    payment?.status === "PAID" && visibleRefunds.length === 0;

  async function confirmRefund() {
    setSubmitting(true);
    setError("");

    try {
      const refund = await requestFullRefund();
      setLatestRefund(refund);
      setConfirming(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to request the refund."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-label="Payment and refund"
      className="rounded-[22px] border border-black/[0.06] bg-card p-5 shadow-[0_12px_40px_rgba(83,61,66,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-tint-foreground">
            Payment
          </p>
          <h2 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-foreground">
            Payment & refunds
          </h2>
        </div>

        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-tint-foreground">
          <CreditCard size={17} strokeWidth={1.8} />
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3.5 py-3">
        <span className="text-[10px] font-bold text-muted-foreground">
          Fulfilment
        </span>
        <span className="text-[10px] font-black text-foreground">
          {label(fulfilmentStatus)}
        </span>
      </div>

      {payment ? (
        <div className="mt-3 rounded-2xl border border-black/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.09em] text-muted-foreground">
                Card payment
              </p>
              <p className="mt-1 text-[13px] font-black text-foreground">
                {label(payment.status)}
              </p>
            </div>

            {payment.status === "PAID" ? (
              <CheckCircle2 size={17} className="text-success" />
            ) : (
              <AlertCircle size={17} className="text-[var(--warn-fg)]" />
            )}
          </div>

          {payment.paymentIntentId && (
            <p className="mt-3 break-all text-[9px] leading-4 text-muted-foreground">
              {payment.paymentIntentId}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[11px] leading-5 text-muted-foreground">
          No payment is attached to this order yet.
        </p>
      )}

      {visibleRefunds.length > 0 && (
        <div className="mt-4 space-y-2" aria-label="Refund status">
          {visibleRefunds.map((refund) => (
            <div
              key={refund.id}
              className={`rounded-xl border px-3.5 py-3 text-[10px] font-semibold leading-5 ${refundStyle(
                refund.status
              )}`}
            >
              <span className="font-black">
                {label(refund.status)}:
              </span>{" "}
              {refundMessage(refund)}
            </div>
          ))}
        </div>
      )}

      {disputes.length > 0 && (
        <div className="mt-4 space-y-2" aria-label="Payment disputes">
          {disputes.map((dispute) => (
            <div
              key={dispute.stripeDisputeId}
              className="flex items-start gap-2 rounded-xl border border-tint-border bg-muted/50 px-3.5 py-3 text-[10px] font-semibold leading-5 text-tint-foreground"
            >
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              <span>
                Payment dispute:{" "}
                <strong>{label(dispute.status)}</strong>
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p
          className="mt-4 rounded-xl bg-muted/50 px-3 py-2.5 text-[10px] font-semibold text-tint-foreground"
          role="alert"
        >
          {error}
        </p>
      )}

      {canRequestRefund && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-card px-3.5 text-[10px] font-black text-foreground transition hover:bg-muted/50"
        >
          <RotateCcw size={13} />
          Issue full refund
        </button>
      )}

      {confirming && (
        <div
          className="mt-4 rounded-2xl border border-tint-border bg-muted/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm full refund"
        >
          <h3 className="text-[13px] font-black text-foreground">
            Confirm full refund
          </h3>

          <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">
            This sends a full refund request through Stripe. Partial refunds
            are not available from this action.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmRefund}
              disabled={submitting}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-primary px-3.5 text-[10px] font-black text-primary-foreground transition hover:bg-primary disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting && (
                <Loader2 size={13} className="animate-spin" />
              )}
              {submitting ? "Requesting…" : "Confirm refund"}
            </button>

            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="inline-flex h-9 items-center rounded-full border border-black/[0.08] bg-card px-3.5 text-[10px] font-black text-foreground disabled:opacity-60"
            >
              Keep order
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
