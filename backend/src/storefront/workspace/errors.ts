export class ResourceRevisionConflictError extends Error {
  readonly code = "RESOURCE_REVISION_CONFLICT";

  constructor(readonly currentRevision: number) {
    super(`Storefront resource revision conflict; current revision is ${currentRevision}`);
    this.name = "ResourceRevisionConflictError";
  }
}

export class WorkspaceGenerationConflictError extends Error {
  readonly code = "WORKSPACE_GENERATION_CONFLICT";

  constructor(readonly currentGeneration: number) {
    super(`Storefront workspace generation conflict; current generation is ${currentGeneration}`);
    this.name = "WorkspaceGenerationConflictError";
  }
}
