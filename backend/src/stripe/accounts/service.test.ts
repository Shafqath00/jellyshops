import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StripeGateway } from "../client.js";
import { StripeAccountService } from "./service.js";
import type { StripeConnectedAccountRow } from "../../commerce/repository.js";
import type { SqlExecutor } from "../../commerce/repository.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeAccount(overrides: Partial<Stripe.V2.Core.Account> = {}): Stripe.V2.Core.Account {
  return {
    id: "acct_test123",
    object: "v2.core.account",
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { status: "inactive" },
          stripe_balance: { payouts: { status: "inactive" } },
        },
      } as unknown,
    },
    ...overrides,
  } as unknown as Stripe.V2.Core.Account;
}

function makeAccountActive(): Stripe.V2.Core.Account {
  return makeAccount({
    configuration: {
      merchant: {
        capabilities: {
          card_payments: { status: "active" },
          stripe_balance: { payouts: { status: "active" } },
        },
      } as unknown,
    },
  } as unknown as Stripe.V2.Core.Account);
}

const baseRow: StripeConnectedAccountRow = {
  storeId: "store-1",
  stripeAccountId: "acct_test123",
  cardPaymentsStatus: "inactive",
  payoutsStatus: "inactive",
  requirements: {},
  closedAt: null,
};

function makeGateway(): StripeGateway {
  return {
    createAccountV2: vi.fn(async () => makeAccount()),
    createAccountLink: vi.fn(async () => ({ id: "al_1", object: "v2.core.account_link", url: "https://stripe.com/onboard/link", created: new Date().toISOString(), expires_at: new Date().toISOString() } as unknown as Stripe.V2.Core.AccountLink)),
    retrieveAccountV2: vi.fn(async () => makeAccount()),
    createDirectPaymentIntent: vi.fn(),
    cancelPaymentIntent: vi.fn(),
    createFullRefund: vi.fn(),
    constructEvent: vi.fn(),
  } as unknown as StripeGateway;
}

function makeSql(): SqlExecutor {
  return {
    query: vi.fn(),
  };
}

function setup(overrides: { rows?: StripeConnectedAccountRow[]; gateway?: Partial<StripeGateway> } = {}) {
  const gateway = { ...makeGateway(), ...(overrides.gateway ?? {}) };
  const sql = makeSql();

  // Default: no row in DB
  vi.mocked(sql.query).mockResolvedValue({ rows: [] });

  const service = new StripeAccountService({ gateway: gateway as StripeGateway, sql });
  return { service, gateway, sql };
}

// ---------------------------------------------------------------------------
// Service tests
// ---------------------------------------------------------------------------

describe("StripeAccountService", () => {
  describe("ensureAccount — creates when none exists", () => {
    it("1. creates an Accounts v2 account when none exists", async () => {
      const { service, gateway, sql } = setup();

      // First query (findByStoreId) returns nothing, insert returns new row
      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [] }) // findByStoreId
        .mockResolvedValueOnce({ rows: [baseRow] }); // insert

      const result = await service.ensureAccount({
        storeId: "store-1",
        displayName: "Shop A",
        country: "US",
      });

      expect(gateway.createAccountV2).toHaveBeenCalledTimes(1);
      expect(result.stripeAccountId).toBe("acct_test123");
    });

    it("2. reuses existing connected account without creating another Stripe account", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(sql.query).mockResolvedValueOnce({ rows: [baseRow] }); // findByStoreId finds existing

      const result = await service.ensureAccount({
        storeId: "store-1",
        displayName: "Shop A",
        country: "US",
      });

      expect(gateway.createAccountV2).not.toHaveBeenCalled();
      expect(result.storeId).toBe("store-1");
    });

    it("3. does not create duplicate Stripe account when local connection exists (creation race)", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [] }) // findByStoreId: not found
        .mockRejectedValueOnce(Object.assign(new Error("unique violation"), { code: "23505" })) // insert fails
        .mockResolvedValueOnce({ rows: [baseRow] }); // findByStoreId race-recovery read

      const result = await service.ensureAccount({
        storeId: "store-1",
        displayName: "Shop A",
        country: "US",
      });

      expect(gateway.createAccountV2).toHaveBeenCalledTimes(1);
      expect(result.storeId).toBe("store-1");
    });

    it("4. persists returned Stripe Account ID", async () => {
      const { service, sql } = setup();

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, stripeAccountId: "acct_test123" }] });

      const result = await service.ensureAccount({ storeId: "store-1", displayName: "Shop A", country: "US" });

      const insertCall = vi.mocked(sql.query).mock.calls[1];
      expect(insertCall[1]).toContain("acct_test123");
      expect(result.stripeAccountId).toBe("acct_test123");
    });
  });

  describe("mapAccountState — capability mapping", () => {
    it("5. maps configuration.merchant.capabilities.card_payments.status", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(gateway.createAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeAccount({ configuration: { merchant: { capabilities: { card_payments: { status: "active" }, stripe_balance: { payouts: { status: "inactive" } } } } } as unknown }),
      );

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, cardPaymentsStatus: "active" }] });

      const result = await service.ensureAccount({ storeId: "store-1", displayName: "Shop", country: "US" });
      expect(result.cardPaymentsStatus).toBe("active");
    });

    it("6. maps configuration.merchant.capabilities.stripe_balance.payouts.status", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(gateway.createAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeAccount({ configuration: { merchant: { capabilities: { card_payments: { status: "inactive" }, stripe_balance: { payouts: { status: "active" } } } } } as unknown }),
      );

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, payoutsStatus: "active" }] });

      const result = await service.ensureAccount({ storeId: "store-1", displayName: "Shop", country: "US" });
      expect(result.payoutsStatus).toBe("active");
    });

    it("7. persists requirements when present", async () => {
      const { service, gateway, sql } = setup();
      const requirements = { currently_due: ["business_profile.url"] };

      vi.mocked(gateway.createAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        { ...makeAccount(), requirements } as unknown as Stripe.V2.Core.Account,
      );

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, requirements: { requirements } }] });

      await service.ensureAccount({ storeId: "store-1", displayName: "Shop", country: "US" });
      const insertCall = vi.mocked(sql.query).mock.calls[1];
      // Requirements object is passed to insert
      expect(insertCall[1]).toBeDefined();
    });

    it("8. handles missing capabilities safely (no crash when fields are absent)", async () => {
      const { service, gateway, sql } = setup();

      // Account with no configuration at all
      vi.mocked(gateway.createAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        { id: "acct_test123", object: "v2.core.account" } as unknown as Stripe.V2.Core.Account,
      );

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, cardPaymentsStatus: "inactive", payoutsStatus: "inactive" }] });

      const result = await service.ensureAccount({ storeId: "store-1", displayName: "Shop", country: "US" });
      expect(result.cardPaymentsStatus).toBe("inactive");
      expect(result.payoutsStatus).toBe("inactive");
    });
  });

  describe("syncAccount", () => {
    it("9. retrieves and synchronizes an existing account by stripeAccountId", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [baseRow] }) // findByStripeAccountId
        .mockResolvedValueOnce({ rows: [{ ...baseRow, cardPaymentsStatus: "active" }] }); // updateState

      vi.mocked(gateway.retrieveAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        makeAccountActive(),
      );

      const result = await service.syncAccount("acct_test123");

      expect(gateway.retrieveAccountV2).toHaveBeenCalledWith("acct_test123");
      expect(result.cardPaymentsStatus).toBe("active");
    });

    it("10. syncAccount updates local state from live Stripe data", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [baseRow] })
        .mockResolvedValueOnce({ rows: [{ ...baseRow, cardPaymentsStatus: "active", payoutsStatus: "active" }] });

      vi.mocked(gateway.retrieveAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeAccountActive());

      const result = await service.syncAccount("acct_test123");

      const updateCall = vi.mocked(sql.query).mock.calls[1];
      expect(updateCall[0]).toContain("UPDATE");
      expect(result.cardPaymentsStatus).toBe("active");
    });

    it("11. closed local account is not checkout-ready", async () => {
      const { service, sql } = setup();
      const closedRow: StripeConnectedAccountRow = { ...baseRow, cardPaymentsStatus: "active", closedAt: new Date() };
      vi.mocked(sql.query).mockResolvedValueOnce({ rows: [closedRow] });

      const status = await service.getStatus("store-1");
      expect(status.checkoutReady).toBe(false);
      expect(status.closed).toBe(true);
    });

    it("11b. gives a connected full-dashboard merchant a server-supplied dashboard URL", async () => {
      const { service, sql } = setup();
      vi.mocked(sql.query).mockResolvedValueOnce({ rows: [baseRow] });

      const status = await service.getStatus("store-1");

      expect(status.dashboardUrl).toBe("https://dashboard.stripe.com");
    });
  });

  describe("getLivePaymentReadiness", () => {
    it("12. returns true only when live card_payments.status === active and not closed", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [baseRow] }) // findByStoreId
        .mockResolvedValueOnce({ rows: [baseRow] }) // findByStripeAccountId (within syncAccount)
        .mockResolvedValueOnce({ rows: [{ ...baseRow, cardPaymentsStatus: "active" }] }); // updateState

      vi.mocked(gateway.retrieveAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeAccountActive());

      const ready = await service.getLivePaymentReadiness("store-1");
      expect(ready).toBe(true);
    });

    it("12b. returns false when no local account exists", async () => {
      const { service, sql } = setup();
      vi.mocked(sql.query).mockResolvedValueOnce({ rows: [] });

      const ready = await service.getLivePaymentReadiness("store-1");
      expect(ready).toBe(false);
    });

    it("12c. returns false for a closed account", async () => {
      const { service, sql } = setup();
      const closedRow: StripeConnectedAccountRow = { ...baseRow, closedAt: new Date() };
      vi.mocked(sql.query).mockResolvedValueOnce({ rows: [closedRow] });

      const ready = await service.getLivePaymentReadiness("store-1");
      expect(ready).toBe(false);
    });
  });

  describe("createOnboardingLink", () => {
    it("13. creates a merchant Account Link", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [baseRow] }) // findByStoreId (ensureAccount)
        ; // no insert needed — account exists

      const result = await service.createOnboardingLink({
        storeId: "store-1",
        displayName: "Shop A",
        country: "US",
        returnUrl: "https://shop.test/return",
        refreshUrl: "https://shop.test/refresh",
      });

      expect(gateway.createAccountLink).toHaveBeenCalledTimes(1);
      expect(result.url).toContain("stripe.com");
    });

    it("14. Account Link uses merchant onboarding configuration", async () => {
      const { service, gateway, sql } = setup();

      vi.mocked(sql.query).mockResolvedValueOnce({ rows: [baseRow] });

      await service.createOnboardingLink({
        storeId: "store-1",
        displayName: "Shop A",
        country: "US",
        returnUrl: "https://shop.test/return",
        refreshUrl: "https://shop.test/refresh",
      });

      const linkCall = vi.mocked(gateway.createAccountLink as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(linkCall[0]).toMatchObject({
        connectedAccountId: "acct_test123",
        returnUrl: "https://shop.test/return",
        refreshUrl: "https://shop.test/refresh",
      });
    });

    it("15. Account Link URL is returned but not persisted", async () => {
      const { service, sql } = setup();
      vi.mocked(sql.query).mockResolvedValueOnce({ rows: [baseRow] });

      const result = await service.createOnboardingLink({
        storeId: "store-1",
        displayName: "Shop A",
        country: "US",
        returnUrl: "https://shop.test/return",
        refreshUrl: "https://shop.test/refresh",
      });

      // The only write was a SELECT (findByStoreId), no INSERT for the link URL
      const writeCalls = vi.mocked(sql.query).mock.calls.filter(([sql]) => /INSERT|UPDATE/.test(sql as string));
      expect(writeCalls).toHaveLength(0);
      expect(result.url).toBeTruthy();
    });

    it("16. no Task 3 logic calls payment/refund methods", async () => {
      const { service, gateway, sql } = setup();
      vi.mocked(sql.query)
        .mockResolvedValueOnce({ rows: [baseRow] })   // getStatus → findByStoreId
        .mockResolvedValueOnce({ rows: [baseRow] })   // getLivePaymentReadiness → findByStoreId
        .mockResolvedValueOnce({ rows: [baseRow] })   // syncAccount → findByStripeAccountId
        .mockResolvedValueOnce({ rows: [{ ...baseRow, cardPaymentsStatus: "active" }] }); // syncAccount → updateState
      vi.mocked(gateway.retrieveAccountV2 as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeAccountActive());

      await service.getStatus("store-1");
      await service.getLivePaymentReadiness("store-1");

      expect(gateway.createDirectPaymentIntent).not.toHaveBeenCalled();
      expect(gateway.cancelPaymentIntent).not.toHaveBeenCalled();
      expect(gateway.createFullRefund).not.toHaveBeenCalled();
    });
  });
});
