/** The shop's plan in plain words (backend/src/billing/store-billing.ts). */
export function planText(shop: { billingStatus?: string | null; trialEndsAt?: string | null }): string {
  switch (shop.billingStatus) {
    case "trialing": return shop.trialEndsAt ? `Free trial until ${new Date(shop.trialEndsAt).toLocaleDateString("en-GB")}` : "Free trial";
    case "active": return "Paying";
    case "past_due": return "Payment due";
    case "paused": return "Paused";
    case "canceled": return "Cancelled";
    case "exempt": return "No charge";
    default: return "No plan yet";
  }
}
