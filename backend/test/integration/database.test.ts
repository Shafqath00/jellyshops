import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIntegrationDatabase, type IntegrationDatabase } from "./database.js";

describe("phase-one PostgreSQL fixture", () => {
  let fixture: IntegrationDatabase;

  beforeAll(async () => {
    fixture = await createIntegrationDatabase();
  });

  afterAll(async () => {
    await fixture?.close();
  });

  it("uses the migrated schema through the generated Prisma client", async () => {
    const created = await fixture.database.client.user.create({
      data: {
        name: "Integration merchant",
        email: "integration@example.test",
      },
    });

    expect(created.id).toBe(1);
    await expect(fixture.database.client.user.count()).resolves.toBe(1);
  });
});
