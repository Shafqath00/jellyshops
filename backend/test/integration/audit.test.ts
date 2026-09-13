import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PrismaAuditRepository } from "../../src/audit/prisma-audit-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

async function seedStore(database: IntegrationDatabase) {
  const user = await database.database.client.user.create({
    data: { name: "Audit User", email: "audit@example.test" },
  });
  const store = await database.database.client.store.create({
    data: {
      id: "audit-store",
      name: "Audit Store",
      slug: "audit-store",
      currency: "USD",
      country: "US",
    },
  });
  return { user, store };
}

describe("PrismaAuditRepository", () => {
  let integration: IntegrationDatabase;

  beforeEach(async () => {
    integration = await createIntegrationDatabase();
  });

  afterEach(async () => {
    await integration.close();
  });

  it("records a store-scoped audit event", async () => {
    const { user, store } = await seedStore(integration);
    const repository = new PrismaAuditRepository(integration.database.client);

    const event = await repository.create({
      storeId: store.id,
      actorUserId: user.id,
      action: "STOREFRONT_PUBLISHED",
      subjectType: "StorefrontPublication",
      subjectId: "pub-1",
      metadata: { generation: 9 },
    });

    expect(event).toMatchObject({
      storeId: store.id,
      actorUserId: user.id,
      action: "STOREFRONT_PUBLISHED",
      subjectType: "StorefrontPublication",
      subjectId: "pub-1",
      metadata: { generation: 9 },
    });
  });

  it("rejects an event whose store does not exist", async () => {
    const { user } = await seedStore(integration);
    const repository = new PrismaAuditRepository(integration.database.client);

    await expect(repository.create({
      storeId: "missing-store",
      actorUserId: user.id,
      action: "STOREFRONT_PUBLISHED",
      subjectType: "StorefrontPublication",
      subjectId: "pub-2",
      metadata: { generation: 10 },
    })).rejects.toBeTruthy();
  });

  it("rejects an event whose actor does not exist", async () => {
    const { store } = await seedStore(integration);
    const repository = new PrismaAuditRepository(integration.database.client);

    await expect(repository.create({
      storeId: store.id,
      actorUserId: 999_999,
      action: "STOREFRONT_PUBLISHED",
      subjectType: "StorefrontPublication",
      subjectId: "pub-3",
      metadata: { generation: 11 },
    })).rejects.toBeTruthy();
  });
});
