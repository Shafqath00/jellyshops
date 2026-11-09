"use client";
import { AdminPage } from "@/components/admin";
import { MerchantPaymentsPanel } from "@/features/commerce/components/merchant-payments-panel";

export default function PaymentsPage() {
  return <AdminPage title="Payments & payouts" width="detail" description="Check that you can take card payments and that payouts are set up. Payments run through Stripe.">
    <MerchantPaymentsPanel />
  </AdminPage>;
}
