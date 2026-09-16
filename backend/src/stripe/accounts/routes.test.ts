import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthProvider, MerchantPrincipal } from "../../auth/types.js";
import { errorHandler } from "../../http/errors.js";
import { createStripeConnectRouter } from "./routes.js";
import type { StripeAccountService } from "./service.js";
import type { StripeAccountStatusDto } from "./types.js";

// ---------------------------------------------------------------------------
// Test principals
// ---------------------------------------------------------------------------

const ownerPrincipal: MerchantPrincipal = {
  userId: 1,
  storeIds: ["store-1"],
  storeRoles: { "store-1": "OWNER" },
};

const adminPrincipal: MerchantPrincipal = {
  userId: 2,
  storeIds: ["store-1"],
  storeRoles: { "store-1": "ADMIN" },
};

const orderManagerPrincipal: MerchantPrincipal = {
  userId: 3,
  storeIds: ["store-1"],
  storeRoles: { "store-1": "ORDER_MANAGER" },
};

const designerPrincipal: MerchantPrincipal = {
  userId: 4,
  storeIds: ["store-1"],
  storeRoles: { "store-1": "DESIGNER" },
};

const otherStorePrincipal: MerchantPrincipal = {
  userId: 5,
  storeIds: ["store-other"],
  storeRoles: { "store-other": "OWNER" },
};

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const disconnectedStatus: StripeAccountStatusDto = {
  connected: false,
  checkoutReady: false,
  closed: false,
};

const connectedStatus: StripeAccountStatusDto = {
  connected: true,
  stripeAccountId: "acct_test123",
  cardPaymentsStatus: "active",
  payoutsStatus: "active",
  checkoutReady: true,
  requirements: {},
  closed: false,
  dashboardUrl: "https://dashboard.stripe.com",
};

function makeService(): StripeAccountService {
  return {
    getStatus: vi.fn(async () => connectedStatus),
    createOnboardingLink: vi.fn(async () => ({ url: "https://stripe.com/onboard/link" })),
    ensureAccount: vi.fn(),
    syncAccount: vi.fn(),
    getLivePaymentReadiness: vi.fn(async () => true),
  } as unknown as StripeAccountService;
}

function setup(principal: MerchantPrincipal) {
  const authProvider: AuthProvider = { verify: async () => principal };
  const service = makeService();
  const app = express();
  app.use((req, _res, next) => { req.id = "test-req"; next(); });
  app.use(express.json());
  app.use("/api/stores/:storeId/stripe-connect", createStripeConnectRouter(service, authProvider));
  app.use(errorHandler);
  return { app, service };
}

// ---------------------------------------------------------------------------
// Route tests
// ---------------------------------------------------------------------------

describe("stripe connect routes", () => {
  describe("GET /status — auth", () => {
    it("returns 401 when no bearer token is provided", async () => {
      const { app } = setup(ownerPrincipal);
      const response = await request(app).get("/api/stores/store-1/stripe-connect/status");
      expect(response.status).toBe(401);
    });

    it("returns 403 when merchant has no access to the store", async () => {
      const { app } = setup(otherStorePrincipal);
      const response = await request(app)
        .get("/api/stores/store-1/stripe-connect/status")
        .set("Authorization", "Bearer token");
      expect(response.status).toBe(403);
    });

    it("returns 200 with status for a merchant with payments:view (OWNER)", async () => {
      const { app } = setup(ownerPrincipal);
      const response = await request(app)
        .get("/api/stores/store-1/stripe-connect/status")
        .set("Authorization", "Bearer token");
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ connected: true, checkoutReady: true });
      expect(response.body.dashboardUrl).toBe("https://dashboard.stripe.com");
    });

    it("returns 200 with status for a merchant with payments:view (ADMIN)", async () => {
      const { app } = setup(adminPrincipal);
      const response = await request(app)
        .get("/api/stores/store-1/stripe-connect/status")
        .set("Authorization", "Bearer token");
      expect(response.status).toBe(200);
    });

    it("returns 200 with status for ORDER_MANAGER (has payments:view)", async () => {
      const { app } = setup(orderManagerPrincipal);
      const response = await request(app)
        .get("/api/stores/store-1/stripe-connect/status")
        .set("Authorization", "Bearer token");
      expect(response.status).toBe(200);
    });

    it("does not expose Stripe secrets or raw account in status response", async () => {
      const { app, service } = setup(ownerPrincipal);
      vi.mocked(service.getStatus).mockResolvedValueOnce(connectedStatus);

      const response = await request(app)
        .get("/api/stores/store-1/stripe-connect/status")
        .set("Authorization", "Bearer token");

      expect(response.status).toBe(200);
      const body = JSON.stringify(response.body);
      expect(body).not.toContain("sk_");
      expect(body).not.toContain("rk_");
      expect(body).not.toContain("whsec_");
      // Response should only have DTO fields
      expect(response.body).toHaveProperty("connected");
      expect(response.body).toHaveProperty("checkoutReady");
    });
  });

  describe("POST /onboarding-link — auth", () => {
    const validBody = {
      returnUrl: "https://shop.example.test/admin/payments?return=1",
      refreshUrl: "https://shop.example.test/admin/payments?refresh=1",
    };

    it("returns 401 when no bearer token is provided", async () => {
      const { app } = setup(ownerPrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .send(validBody);
      expect(response.status).toBe(401);
    });

    it("returns 403 when merchant has no access to the store", async () => {
      const { app } = setup(otherStorePrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .set("Authorization", "Bearer token")
        .send(validBody);
      expect(response.status).toBe(403);
    });

    it("returns 403 for ORDER_MANAGER (lacks payments:manage)", async () => {
      const { app } = setup(orderManagerPrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .set("Authorization", "Bearer token")
        .send(validBody);
      expect(response.status).toBe(403);
    });

    it("returns 403 for DESIGNER (lacks payments:manage)", async () => {
      const { app } = setup(designerPrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .set("Authorization", "Bearer token")
        .send(validBody);
      expect(response.status).toBe(403);
    });

    it("succeeds for OWNER with payments:manage — returns url", async () => {
      const { app } = setup(ownerPrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .set("Authorization", "Bearer token")
        .send(validBody);
      expect(response.status).toBe(201);
      expect(response.body.url).toMatch(/https?:\/\//);
    });

    it("succeeds for ADMIN with payments:manage — returns url", async () => {
      const { app } = setup(adminPrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .set("Authorization", "Bearer token")
        .send(validBody);
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("url");
    });

    it("returns 400 for an invalid returnUrl", async () => {
      const { app } = setup(ownerPrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .set("Authorization", "Bearer token")
        .send({ returnUrl: "not-a-url", refreshUrl: "https://shop.test/refresh" });
      expect(response.status).toBe(400);
    });

    it("onboarding response does not leak Stripe secrets or raw account", async () => {
      const { app } = setup(ownerPrincipal);
      const response = await request(app)
        .post("/api/stores/store-1/stripe-connect/onboarding-link")
        .set("Authorization", "Bearer token")
        .send(validBody);

      const body = JSON.stringify(response.body);
      expect(body).not.toContain("sk_");
      expect(body).not.toContain("rk_");
      expect(body).not.toContain("whsec_");
      expect(Object.keys(response.body)).toEqual(["url"]);
    });
  });
});
