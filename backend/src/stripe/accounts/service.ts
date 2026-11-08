import type Stripe from "stripe";
import type { StripeGateway } from "../client.js";
import { StripeAccountRepository } from "./repository.js";
import type {
  CreateOnboardingLinkInput,
  EnsureAccountInput,
  OnboardingLinkDto,
  StripeAccountStatusDto,
} from "./types.js";
import type {
  CommerceDatabase,
  StripeConnectedAccountRow,
} from "../../commerce/repository.js";
import type { SqlExecutor } from "../../commerce/repository.js";

/** Stable idempotency key for account creation, scoped to this store's first creation attempt. */
function accountCreationKey(storeId: string): string {
  return `stripe-account-create-${storeId}`;
}

/** Maps Accounts v2 capability/requirements onto the local read model.
 * Missing capability fields are handled safely — no throw on undefined paths. */
function mapAccountState(account: Stripe.V2.Core.Account): {
  cardPaymentsStatus: string;
  payoutsStatus: string;
  requirements: Record<string, unknown>;
} {
  const merchant = (account as unknown as {
    configuration?: { merchant?: { capabilities?: {
      card_payments?: { status?: string };
      stripe_balance?: { payouts?: { status?: string } };
    } } };
  }).configuration?.merchant;

  const cardPaymentsStatus = merchant?.capabilities?.card_payments?.status ?? "inactive";
  const payoutsStatus = merchant?.capabilities?.stripe_balance?.payouts?.status ?? "inactive";

  const requirements: Record<string, unknown> = {};
  const raw = account as unknown as { requirements?: unknown; future_requirements?: unknown };
  if (raw.requirements) requirements.requirements = raw.requirements;
  if (raw.future_requirements) requirements.future_requirements = raw.future_requirements;

  return { cardPaymentsStatus, payoutsStatus, requirements };
}

function toStatusDto(row: StripeConnectedAccountRow): StripeAccountStatusDto {
  const closed = row.closedAt !== null;
  const checkoutReady = row.cardPaymentsStatus === "active" && !closed;
  return {
    connected: true,
    stripeAccountId: row.stripeAccountId,
    cardPaymentsStatus: row.cardPaymentsStatus,
    payoutsStatus: row.payoutsStatus,
    checkoutReady,
    requirements: row.requirements,
    closed,
    dashboardUrl: "https://dashboard.stripe.com",
  };
}

function disconnectedDto(): StripeAccountStatusDto {
  return { connected: false, checkoutReady: false, closed: false };
}

function isInaccessibleAccountError(error: unknown): boolean {
  const candidate = error as {
    statusCode?: number;
    code?: string;
    type?: string;
  };

  return (
    candidate.statusCode === 403 ||
    candidate.statusCode === 404 ||
    candidate.code === "account_not_found" ||
    candidate.type === "StripePermissionError"
  );
}

export interface StripeAccountServiceDeps {
  gateway: StripeGateway;
  sql: SqlExecutor;
  database?: CommerceDatabase;
}

export class StripeAccountService {
  private readonly repo: StripeAccountRepository;

  constructor(private readonly deps: StripeAccountServiceDeps) {
    this.repo = new StripeAccountRepository(deps.sql, deps.database);
  }

  /** Ensures a connected account exists for the store; never creates duplicates. */
  async ensureAccount(input: EnsureAccountInput): Promise<StripeConnectedAccountRow> {
    const existing = await this.repo.findByStoreId(input.storeId);
    if (existing) return existing;

    const idempotencyKey = accountCreationKey(input.storeId);
    const stripeAccount = await this.deps.gateway.createAccountV2(
      {
        storeId: input.storeId,
        // contactEmail is omitted — no trustworthy server-side source is available.
        // The Task 2-compatible adjustment makes contactEmail optional in CreateAccountInput.
        displayName: input.displayName,
        country: input.country,
      },
      idempotencyKey,
    );

    const state = mapAccountState(stripeAccount);

    // Handle creation race: another request may have just inserted the row.
    try {
      return await this.repo.insert({
        storeId: input.storeId,
        stripeAccountId: stripeAccount.id,
        ...state,
      });
    } catch (error) {
      // Unique constraint on storeId: read the winning row instead.
      const race = await this.repo.findByStoreId(input.storeId);
      if (race) return race;
      throw error;
    }
  }

  /** Creates a hosted merchant Account Link URL. URL is not persisted. */
  async createOnboardingLink(input: CreateOnboardingLinkInput): Promise<OnboardingLinkDto> {
    const account = await this.ensureAccount({
      storeId: input.storeId,
      displayName: input.displayName,
      country: input.country,
    });

    let connectedAccountId = account.stripeAccountId;
    let link: { url: string };

    try {
      link = await this.deps.gateway.createAccountLink(
        {
          connectedAccountId,
          returnUrl: input.returnUrl,
          refreshUrl: input.refreshUrl,
        },
        `stripe-account-link-${input.storeId}-${Date.now()}`,
      );
    } catch (error) {
      if (!isInaccessibleAccountError(error)) throw error;

      // The local row can outlive a Stripe platform credential change. Create
      // a replacement under the currently configured platform and reattach it
      // to this store instead of repeatedly onboarding the inaccessible ID.
      const replacement = await this.deps.gateway.createAccountV2(
        {
          storeId: input.storeId,
          displayName: input.displayName,
          country: input.country,
        },
        `${accountCreationKey(input.storeId)}-replacement-${Date.now()}`,
      );
      const replacementState = mapAccountState(replacement);
      const stored = await this.repo.replaceForStore({
        storeId: input.storeId,
        stripeAccountId: replacement.id,
        ...replacementState,
      });
      connectedAccountId = stored.stripeAccountId;
      link = await this.deps.gateway.createAccountLink(
        {
          connectedAccountId,
          returnUrl: input.returnUrl,
          refreshUrl: input.refreshUrl,
        },
        `stripe-account-link-${input.storeId}-${Date.now()}`,
      );
    }

    // Account Link return does NOT mean onboarding is complete.
    // Only capability state determines readiness.
    return { url: link.url };
  }

  /** Retrieves and synchronizes the account state for a given stripe account ID.
   * Suitable for later Task 7 thin-event webhook use. */
  async syncAccount(stripeAccountId: string): Promise<StripeConnectedAccountRow> {
    const local = await this.repo.findByStripeAccountId(stripeAccountId);
    if (!local) throw new Error(`No local account found for Stripe account: ${stripeAccountId}`);

    const stripeAccount = await this.deps.gateway.retrieveAccountV2(stripeAccountId);
    const state = mapAccountState(stripeAccount);

    return this.repo.updateState({
      stripeAccountId,
      ...state,
    });
  }

  async markClosed(stripeAccountId: string): Promise<StripeConnectedAccountRow> {
    return this.repo.markClosed(stripeAccountId);
  }

  /** Returns current status DTO, refreshing the local read model from Stripe first. */
  async getStatus(storeId: string): Promise<StripeAccountStatusDto> {
    const row = await this.repo.findByStoreId(storeId);
    if (!row) return disconnectedDto();
    try {
      return toStatusDto(await this.syncAccount(row.stripeAccountId));
    } catch (error) {
      if (isInaccessibleAccountError(error)) return disconnectedDto();

      // Keep the last known state available if Stripe is temporarily unreachable.
      return toStatusDto(row);
    }
  }

  /** Retrieves the live Accounts v2 state, synchronizes local model, and returns
   * whether card payments are active. Used by Task 4 checkout gating. */
  async getLivePaymentReadiness(storeId: string): Promise<boolean> {
    const row = await this.repo.findByStoreId(storeId);
    if (!row || row.closedAt !== null) return false;

    try {
      const synced = await this.syncAccount(row.stripeAccountId);
      return synced.cardPaymentsStatus === "active" && synced.closedAt === null;
    } catch (error) {
      if (isInaccessibleAccountError(error)) return false;
      throw error;
    }
  }
}
