import { ResourceRevisionConflictError } from "./errors.js";

export type WorkspaceTransaction = unknown;

const MAX_REVISION = 2_147_483_647;

export function assertExpectedRevision(currentRevision: number, expectedRevision: number): void {
  if (currentRevision !== expectedRevision) {
    throw new ResourceRevisionConflictError(currentRevision);
  }
}

export function nextRevision(revision: number): number {
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error("Resource revision must be a nonnegative integer");
  }
  if (revision >= MAX_REVISION) {
    throw new Error("Resource revision limit reached");
  }
  return revision + 1;
}
