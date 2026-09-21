import type { CompilationResult } from "../compiler/compiler.js";
import type {
  CompiledPublicationRecord,
  CompiledPublicationRepository,
} from "./repository.js";

export interface StorefrontCompilerPublisherApi {
  compile(storeId: string, expectedGeneration: number): Promise<CompilationResult>;
}

export type PublishStorefrontResult =
  | {
      ok: true;
      publication: CompiledPublicationRecord;
      diagnostics: CompilationResult["diagnostics"];
      reused: boolean;
    }
  | {
      ok: false;
      diagnostics: CompilationResult["diagnostics"];
    };

export class CompiledStorefrontPublicationService {
  constructor(
    private readonly compiler: StorefrontCompilerPublisherApi,
    private readonly repository: CompiledPublicationRepository,
  ) {}

  async publish(
    storeId: string,
    expectedGeneration: number,
    idempotencyKey: string,
    actorUserId: string,
  ): Promise<PublishStorefrontResult> {
    const existing = await this.repository.findByIdempotencyKey(storeId, idempotencyKey);
    if (existing) {
      const currentPublicationId = await this.repository.getCurrentPublicationId(storeId);
      if (currentPublicationId !== existing.id) {
        await this.repository.activate(storeId, existing.id);
      }
      return { ok: true, publication: existing, diagnostics: [], reused: true };
    }

    const compilation = await this.compiler.compile(storeId, expectedGeneration);
    if (!compilation.ok || !compilation.snapshot) {
      return { ok: false, diagnostics: compilation.diagnostics };
    }

    const publication = await this.repository.save({
      storeId,
      expectedGeneration,
      idempotencyKey,
      actorUserId,
      snapshot: compilation.snapshot,
      dependencies: compilation.dependencies,
    });
    await this.repository.activate(storeId, publication.id);
    return {
      ok: true,
      publication,
      diagnostics: compilation.diagnostics,
      reused: false,
    };
  }
}
