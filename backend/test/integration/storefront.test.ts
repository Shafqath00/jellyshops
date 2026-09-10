import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaStorefrontRepository } from "../../src/storefront/prisma-repository.js";
import { PrismaTenantRepository } from "../../src/tenants/prisma-tenant-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

const document = (value: string) => ({ value });

describe("PrismaStorefrontRepository", () => {
  let fixture: IntegrationDatabase;
  let repository: PrismaStorefrontRepository;
  let tenants: PrismaTenantRepository;
  let sequence = 0;

  beforeAll(async () => {
    fixture = await createIntegrationDatabase();
    repository = new PrismaStorefrontRepository(fixture.database.client);
    tenants = new PrismaTenantRepository(fixture.database.client);
  });

  afterAll(async () => {
    await fixture?.close();
  });

  async function createStore() {
    sequence += 1;
    const account = await tenants.resolveMerchant({
      uid: `storefront-user-${sequence}`,
      email: `storefront-${sequence}@example.test`,
      name: "Storefront",
    });
    return tenants.createStore(account.id, {
      name: `Store ${sequence}`,
      slug: `storefront-${sequence}`,
      currency: "USD",
      country: "US",
    });
  }

  it("allows exactly one simultaneous first save at revision zero", async () => {
    const store = await createStore();
    const results = await Promise.allSettled([
      repository.saveDraft(store.id, 0, document("first")),
      repository.saveDraft(store.id, 0, document("second")),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    const rejection = results.find(({ status }) => status === "rejected");
    expect(rejection).toMatchObject({ reason: { code: "DRAFT_CONFLICT", currentRevision: 1 } });
    await expect(repository.getDraft(store.id)).resolves.toMatchObject({ revision: 1 });
  });

  it("allows exactly one simultaneous edit at the same revision", async () => {
    const store = await createStore();
    await repository.saveDraft(store.id, 0, document("initial"));

    const results = await Promise.allSettled([
      repository.saveDraft(store.id, 1, document("edit-a")),
      repository.saveDraft(store.id, 1, document("edit-b")),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.find(({ status }) => status === "rejected"))
      .toMatchObject({ reason: { code: "DRAFT_CONFLICT", currentRevision: 2 } });
  });

  it("serializes a save racing a publish", async () => {
    const store = await createStore();
    await repository.saveDraft(store.id, 0, document("revision-one"));

    const [save, publish] = await Promise.allSettled([
      repository.saveDraft(store.id, 1, document("revision-two")),
      repository.publish(store.id, 1),
    ]);

    expect(save.status).toBe("fulfilled");
    if (publish.status === "fulfilled") {
      expect(publish.value).toMatchObject({ sourceRevision: 1, document: document("revision-one") });
    } else {
      expect(publish.reason).toMatchObject({ code: "DRAFT_CONFLICT", currentRevision: 2 });
    }
    await expect(repository.getDraft(store.id)).resolves.toMatchObject({
      revision: 2,
      document: document("revision-two"),
    });
  });

  it("keeps every concurrent publication immutable and points live at a committed snapshot", async () => {
    const store = await createStore();
    await repository.saveDraft(store.id, 0, document("live"));

    const publications = await Promise.all([
      repository.publish(store.id, 1),
      repository.publish(store.id, 1),
    ]);

    expect(new Set(publications.map(({ id }) => id)).size).toBe(2);
    await expect(fixture.database.client.storefrontPublication.count({
      where: { storeId: store.id },
    })).resolves.toBe(2);
    const live = await repository.getPublic(store.id);
    expect(publications.map(({ id }) => id)).toContain(live?.id);
    await expect(fixture.database.client.storefrontPublication.update({
      where: { id: publications[0].id },
      data: { sourceRevision: 2 },
    })).rejects.toThrow(/immutable/i);
    await expect(fixture.database.client.storefrontPublication.delete({
      where: { id: publications[0].id },
    })).rejects.toThrow(/immutable/i);
  });

  it("rolls back an inserted publication when updating the live pointer fails", async () => {
    const store = await createStore();
    await repository.saveDraft(store.id, 0, document("rollback"));
    await fixture.database.client.$executeRawUnsafe(`
      CREATE FUNCTION reject_test_live_pointer() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'test pointer failure';
      END;
      $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_test_live_pointer
      BEFORE UPDATE OF "currentPublicationId" ON "Store"
      FOR EACH ROW WHEN (NEW.id = '${store.id}')
      EXECUTE FUNCTION reject_test_live_pointer();
    `);

    try {
      await expect(repository.publish(store.id, 1)).rejects.toThrow();
      await expect(fixture.database.client.storefrontPublication.count({
        where: { storeId: store.id },
      })).resolves.toBe(0);
    } finally {
      await fixture.database.client.$executeRawUnsafe(`DROP TRIGGER reject_test_live_pointer ON "Store"`);
      await fixture.database.client.$executeRawUnsafe(`DROP FUNCTION reject_test_live_pointer()`);
    }
  });

  it("distinguishes missing and archived stores from unpublished active stores", async () => {
    const store = await createStore();
    await expect(repository.getDraft("missing-store")).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    await expect(repository.getPublic("missing-store")).resolves.toBeNull();
    await expect(repository.getPublic(store.id)).resolves.toBeNull();
    await fixture.database.client.store.update({
      where: { id: store.id },
      data: { archivedAt: new Date() },
    });
    await expect(repository.getDraft(store.id)).rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    await expect(repository.getPublic(store.id)).resolves.toBeNull();
  });

  it("rejects writes for a missing store and prevents revision overflow", async () => {
    await expect(repository.saveDraft("missing-write-store", 0, document("missing")))
      .rejects.toMatchObject({ code: "STORE_NOT_FOUND" });
    await expect(repository.publish("missing-write-store", 0))
      .rejects.toMatchObject({ code: "STORE_NOT_FOUND" });

    const store = await createStore();
    await repository.saveDraft(store.id, 0, document("maximum"));
    await fixture.database.client.storefrontDraft.update({
      where: { storeId: store.id },
      data: { revision: 2_147_483_647 },
    });
    await expect(repository.saveDraft(store.id, 2_147_483_647, document("overflow")))
      .rejects.toMatchObject({ status: 409, code: "REVISION_LIMIT_REACHED" });
  });
});
