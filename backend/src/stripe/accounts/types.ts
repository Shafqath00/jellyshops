import type { StripeConnectedAccountRow } from "../../commerce/repository.js";

export type { StripeConnectedAccountRow };

/** Redacted status DTO — never contains Stripe secret material. */
export interface StripeAccountStatusDto {
  connected: boolean;
  stripeAccountId?: string;
  cardPaymentsStatus?: string;
  payoutsStatus?: string;
  checkoutReady: boolean;
  requirements?: Record<string, unknown>;
  closed: boolean;
  /** Full Dashboard merchants sign in to their own Stripe account. This is not an account-link URL. */
  dashboardUrl?: string;
}

export interface EnsureAccountInput {
  storeId: string;
  /** Display name sourced from StoreSummary.name — never from client input. */
  displayName: string;
  /** ISO-3166-1 alpha-2 country sourced from StoreSummary.country — never from client input. */
  country: string;
}

export interface CreateOnboardingLinkInput {
  storeId: string;
  displayName: string;
  country: string;
  returnUrl: string;
  refreshUrl: string;
}

export interface OnboardingLinkDto {
  url: string;
}
