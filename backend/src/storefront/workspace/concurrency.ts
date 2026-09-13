import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  ResourceRevisionConflictError,
  WorkspaceGenerationConflictError,
} from "./errors.js";

export const MAX_STORE_REVISION = 2_147_483_647;

function nextCounter(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a nonnegative integer`);
  }
  if (value >= MAX_STORE_REVISION) {
    throw new Error(`${label} reached the supported integer limit`);
  }
  return value + 1;
}

export function nextRevision(currentRevision: number): number {
  return nextCounter(currentRevision, "Resource revision");
}

export function nextGeneration(currentGeneration: number): number {
  return nextCounter(currentGeneration, "Workspace generation");
}

export function assertExpectedRevision(currentRevision: number, expectedRevision: number): void {
  if (currentRevision !== expectedRevision) {
    throw new ResourceRevisionConflictError(currentRevision);
  }
}

export type WorkspaceTransaction = Prisma.TransactionClient;

export async function lockWorkspaceGeneration(
  storeId: string,
  transaction: WorkspaceTransaction,
  createIfMissing = false,
): Promise<number> {
  if (createIfMissing) {
    await transaction.$executeRaw(
      Prisma.sql`INSERT INTO "StorefrontWorkspace" ("storeId", "generation", "updatedAt")
                 VALUES (${storeId}, 0, CURRENT_TIMESTAMP)
                 ON CONFLICT ("storeId") DO NOTHING`,
    );
  }

  const rows = await transaction.$queryRaw<Array<{ generation: number }>>(
    Prisma.sql`SELECT "generation" FROM "StorefrontWorkspace"
               WHERE "storeId" = ${storeId}
               FOR UPDATE`,
  );
  if (rows.length !== 1) throw new Error("Storefront workspace was not found");
  return rows[0].generation;
}

export async function assertWorkspaceGeneration(
  storeId: string,
  expectedGeneration: number,
  transaction: WorkspaceTransaction,
): Promise<number> {
  const currentGeneration = await lockWorkspaceGeneration(storeId, transaction);
  if (currentGeneration !== expectedGeneration) {
    throw new WorkspaceGenerationConflictError(currentGeneration);
  }
  return currentGeneration;
}

export type PrismaClientWithTransactions = Pick<PrismaClient, "$transaction">;
