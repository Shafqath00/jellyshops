import { describe, expect, it, vi } from "vitest";
import type { AuditRepository } from "./repository.js";
import { AuditService } from "./service.js";

function repository(): AuditRepository {
  return { create: vi.fn(async (input) => ({ id: "audit-1", ...input, createdAt: new Date(0) })) };
}

describe("AuditService", () => {
  it("records non-sensitive metadata", async () => {
    const repo = repository();
    const service = new AuditService(repo);

    await service.record({
      storeId: "store-a",
      actorUserId: 7,
      action: "STOREFRONT_PUBLISHED",
      subjectType: "StorefrontPublication",
      subjectId: "pub-1",
      metadata: { generation: 9 },
    });

    expect(repo.create).toHaveBeenCalledOnce();
  });

  it.each(["token", "secret", "password", "authorization"]) (
    "rejects sensitive metadata key %s",
    async (key) => {
      const service = new AuditService(repository());
      await expect(service.record({
        storeId: "store-a",
        actorUserId: 7,
        action: "SECURITY_TEST",
        subjectType: "Test",
        metadata: { nested: { [key]: "do-not-log" } },
      })).rejects.toThrow(/sensitive/i);
    },
  );
});
