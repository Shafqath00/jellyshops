import { describe, expect, it, vi } from "vitest";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import { PrismaStorefrontRepository } from "./prisma-repository.js";

describe("PrismaStorefrontRepository retries", () => {
  it("retries transaction conflicts only three times before returning DATABASE_BUSY", async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError("transaction conflict", {
      code: "P2034",
      clientVersion: "test",
    });
    const transaction = vi.fn().mockRejectedValue(conflict);
    const repository = new PrismaStorefrontRepository({ $transaction: transaction } as unknown as PrismaClient);

    await expect(repository.saveDraft("store-a", 0, {})).rejects.toMatchObject({
      status: 503,
      code: "DATABASE_BUSY",
    });
    expect(transaction).toHaveBeenCalledTimes(3);
  });
});
