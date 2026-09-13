import type { WorkspaceTransaction } from "./concurrency.js";

export interface WorkspaceMutationRunResult<T> {
  result: T;
  generation: number;
}

export interface WorkspaceMutationRunner {
  run<T>(
    storeId: string,
    operation: (transaction: WorkspaceTransaction) => Promise<T>,
  ): Promise<WorkspaceMutationRunResult<T>>;
}
