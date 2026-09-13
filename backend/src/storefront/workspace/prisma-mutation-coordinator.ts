import type { PrismaClient } from "../../generated/prisma/client.js";
import {
  lockWorkspaceGeneration,
  nextGeneration,
  type WorkspaceTransaction,
} from "./concurrency.js";

export interface WorkspaceMutationResult<T> {
  result: T;
  generation: number;
}

export class PrismaWorkspaceMutationCoordinator {
  constructor(private readonly client: PrismaClient) {}

  async run<T>(
    storeId: string,
    operation: (transaction: WorkspaceTransaction) => Promise<T>,
  ): Promise<WorkspaceMutationResult<T>> {
    return this.client.$transaction(async (transaction) => {
      const currentGeneration = await lockWorkspaceGeneration(storeId, transaction, true);
      const result = await operation(transaction);
      const generation = nextGeneration(currentGeneration);
      await transaction.storefrontWorkspace.update({
        where: { storeId },
        data: { generation },
      });
      return { result, generation };
    });
  }
}
