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
    return "border-[#dfe9b7] bg-[#f5f8e7] text-[#59672c]";
  }

  if (status === "FAILED" || status === "REQUIRES_ACTION") {
    return "border-[#edcbd2] bg-[#fff5f7] text-[#914f60]";
  }

  return "border-[#eadbb8] bg-[#fff9e8] text-[#806222]";
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
      className="rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_12px_40px_rgba(83,61,66,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#a35c6d]">
            Payment
          </p>
          <h2 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-[#322a2c]">
            Payment & refunds
          </h2>
        </div>

        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fff0f3] text-[#a35467]">
          <CreditCard size={17} strokeWidth={1.8} />
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#fffaf7] px-3.5 py-3">
        <span className="text-[10px] font-bold text-[#8f8184]">
          Fulfilment
        </span>
        <span className="text-[10px] font-black text-[#43393b]">
          {label(fulfilmentStatus)}
        </span>
      </div>

      {payment ? (
        <div className="mt-3 rounded-2xl border border-black/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.09em] text-[#9b8e91]">
                Card payment
              </p>
              <p className="mt-1 text-[13px] font-black text-[#332b2d]">
                {label(payment.status)}
              </p>
            </div>

            {payment.status === "PAID" ? (
              <CheckCircle2 size={17} className="text-[#667535]" />
            ) : (
              <AlertCircle size={17} className="text-[#a97825]" />
            )}
          </div>

          {payment.paymentIntentId && (
            <p className="mt-3 break-all text-[9px] leading-4 text-[#a09597]">
              {payment.paymentIntentId}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 text-[11px] leading-5 text-[#817477]">
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
              className="flex items-start gap-2 rounded-xl border border-[#edcbd2] bg-[#fff5f7] px-3.5 py-3 text-[10px] font-semibold leading-5 text-[#914f60]"
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
          className="mt-4 rounded-xl bg-[#fff5f7] px-3 py-2.5 text-[10px] font-semibold text-[#914f60]"
          role="alert"
        >
          {error}
        </p>
      )}

      {canRequestRefund && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 text-[10px] font-black text-[#55494c] transition hover:bg-[#fff3f6]"
        >
          <RotateCcw size={13} />
          Issue full refund
        </button>
      )}

      {confirming && (
        <div
          className="mt-4 rounded-2xl border border-[#f0b8c5] bg-[#fff3f6] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm full refund"
        >
          <h3 className="text-[13px] font-black text-[#332b2d]">
            Confirm full refund
          </h3>

          <p className="mt-1.5 text-[10px] leading-5 text-[#817477]">
            This sends a full refund request through Stripe. Partial refunds
            are not available from this action.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmRefund}
              disabled={submitting}
              className="inline-flex h-9 items-center gap-2 rounded-full bg-[#241f20] px-3.5 text-[10px] font-black text-white transition hover:bg-[#3a3234] disabled:pointer-events-none disabled:opacity-60"
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
              className="inline-flex h-9 items-center rounded-full border border-black/[0.08] bg-white px-3.5 text-[10px] font-black text-[#55494c] disabled:opacity-60"
            >
              Keep order
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
