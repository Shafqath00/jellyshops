import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "../../src/http/errors.js";
import { PrismaTenantRepository } from "../../src/tenants/prisma-tenant-repository.js";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

describe("PrismaTenantRepository", () => {
  let fixture: IntegrationDatabase;
  let repository: PrismaTenantRepository;

  beforeAll(async () => {
    fixture = await createIntegrationDatabase();
    repository = new PrismaTenantRepository(fixture.database.client);
  });

  beforeEach(async () => {
    await fixture.database.client.storeMembership.deleteMany();
    await fixture.database.client.storeSettings.deleteMany();
    await fixture.database.client.store.deleteMany();
    await fixture.database.client.user.deleteMany();
  });

  afterAll(async () => {
    await fixture?.close();
  });

  it("resolves an existing Firebase UID without overwriting its stored profile", async () => {
    const existing = await fixture.database.client.user.create({
      data: {
        firebaseUid: "firebase-existing",
        email: "stored@example.test",
        name: "Stored Name",
      },
    });

    await expect(repository.resolveMerchant({
      uid: "firebase-existing",
      email: "new-token@example.test",
      name: "New Token Name",
    })).resolves.toEqual({ id: existing.id, stores: [] });
    await expect(fixture.database.client.user.findUnique({
      where: { id: existing.id },
      select: { email: true, name: true },
    })).resolves.toEqual({ email: "stored@example.test", name: "Stored Name" });
  });

  it("creates one merchant when the same Firebase identity resolves concurrently", async () => {
    const identity = { uid: "firebase-concurrent", email: "same@example.test", name: "Same" };

    const accounts = await Promise.all([
      repository.resolveMerchant(identity),
      repository.resolveMerchant(identity),
    ]);

    expect(accounts[0]).toEqual({ id: accounts[1].id, stores: [] });
    await expect(fixture.database.client.user.count()).resolves.toBe(1);
  });

  it("requires deliberate linking when an existing email has no Firebase UID", async () => {
    await fixture.database.client.user.create({
      data: { name: "Legacy", email: "legacy@example.test" },
    });

    await expect(repository.resolveMerchant({
      uid: "new-firebase-uid",
      email: "legacy@example.test",
      name: "Legacy",
    })).rejects.toMatchObject<ApiError>({ status: 409, code: "ACCOUNT_LINK_REQUIRED" });
  });

  it("loads current non-archived memberships and roles", async () => {
    const account = await repository.resolveMerchant({
      uid: "firebase-member",
      email: "member@example.test",
      name: "Member",
    });
    await fixture.database.client.store.create({
      data: {
        id: "active-store",
        name: "Active",
        slug: "active-store",
        currency: "USD",
        country: "US",
        updatedAt: new Date(),
        memberships: { create: { userId: account.id, role: "DESIGNER" } },
      },
    });
    await fixture.database.client.store.create({
      data: {
        id: "archived-store",
        name: "Archived",
        slug: "archived-store",
        currency: "USD",
        country: "US",
        archivedAt: new Date(),
        updatedAt: new Date(),
        memberships: { create: { userId: account.id, role: "OWNER" } },
      },
    });

    await expect(repository.listStores(account.id)).resolves.toEqual([{
      id: "active-store",
      name: "Active",
      slug: "active-store",
      currency: "USD",
      country: "US",
      role: "DESIGNER",
    }]);
  });

  it("returns only the requesting merchant's stores with each current role", async () => {
    const account = await repository.resolveMerchant({
      uid: "firebase-multiple",
      email: "multiple@example.test",
      name: "Multiple",
    });
    const other = await repository.resolveMerchant({
      uid: "firebase-other",
      email: "other@example.test",
      name: "Other",
    });
    const ownerStore = await repository.createStore(account.id, {
      name: "Owned",
      slug: "owned-store",
      currency: "USD",
      country: "US",
    });
    await fixture.database.client.store.create({
      data: {
        id: "staff-store",
        name: "Staff Store",
        slug: "staff-store",
        currency: "EUR",
        country: "DE",
        updatedAt: new Date(),
        memberships: { create: { userId: account.id, role: "STAFF" } },
      },
    });
    await repository.createStore(other.id, {
      name: "Other Store",
      slug: "other-store",
      currency: "GBP",
      country: "GB",
    });

    await expect(repository.listStores(account.id)).resolves.toEqual([
      ownerStore,
      {
        id: "staff-store",
        name: "Staff Store",
        slug: "staff-store",
        currency: "EUR",
        country: "DE",
        role: "STAFF",
      },
    ]);
  });

  it("creates the store, settings and owner membership atomically", async () => {
    const account = await repository.resolveMerchant({
      uid: "firebase-owner",
      email: "owner@example.test",
      name: "Owner",
    });

    const store = await repository.createStore(account.id, {
      name: "Jelly Goods",
      slug: "jelly-goods",
      currency: "USD",
      country: "US",
    });

    expect(store).toMatchObject({ slug: "jelly-goods", role: "OWNER" });
    await expect(fixture.database.client.storeSettings.findUnique({
      where: { storeId: store.id },
    })).resolves.toMatchObject({ timezone: "UTC" });
    await expect(fixture.database.client.storeMembership.findUnique({
      where: { storeId_userId: { storeId: store.id, userId: account.id } },
    })).resolves.toMatchObject({ role: "OWNER" });
  });

  it("returns a slug conflict without creating partial tenant records", async () => {
    const account = await repository.resolveMerchant({
      uid: "firebase-slug",
      email: "slug@example.test",
      name: "Slug",
    });
    const input = { name: "First", slug: "same-slug", currency: "USD", country: "US" };
    await repository.createStore(account.id, input);

    await expect(repository.createStore(account.id, { ...input, name: "Second" }))
      .rejects.toMatchObject<ApiError>({ status: 409, code: "STORE_SLUG_TAKEN" });
    await expect(fixture.database.client.store.count()).resolves.toBe(1);
    await expect(fixture.database.client.storeSettings.count()).resolves.toBe(1);
    await expect(fixture.database.client.storeMembership.count()).resolves.toBe(1);
  });

  it("rejects an unknown owner without creating a store", async () => {
    await expect(repository.createStore(999_999, {
      name: "Missing Owner",
      slug: "missing-owner",
      currency: "USD",
      country: "US",
    })).rejects.toMatchObject<ApiError>({ status: 404, code: "MERCHANT_NOT_FOUND" });
    await expect(fixture.database.client.store.count()).resolves.toBe(0);
  });
});
