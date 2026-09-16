"use client";
import { CreditCard } from "lucide-react";
import { MerchantPaymentsPanel } from "@/features/commerce/components/merchant-payments-panel";

export default function PaymentsPage() {
  return <div className="admin-page"><header className="page-head"><div><span className="page-kicker">Stripe Connect</span><h1>Payments & payouts</h1><p>Check your payment capability and payout readiness.</p></div><CreditCard /></header><MerchantPaymentsPanel /></div>;
}
