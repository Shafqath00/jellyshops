import type { CompilationResult } from "../compiler/compiler.js";
import type {
  CompiledPublicationRecord,
  CompiledPublicationRepository,
  PublicationHistoryEntry,
} from "./repository.js";
import { ApiError } from "../../http/errors.js";

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

  async history(storeId: string, limit = 20): Promise<PublicationHistoryEntry[]> {
    return this.repository.list(storeId, limit);
  }

  /** Makes an earlier published version the live one again. The draft is not touched. */
  async restore(storeId: string, publicationId: string): Promise<{ id: string; sourceGeneration: number; alreadyCurrent: boolean }> {
    const publication = await this.repository.get(storeId, publicationId);
    if (!publication) throw new ApiError(404, "PUBLICATION_NOT_FOUND", "That published version was not found.");
    const current = await this.repository.getCurrentPublicationId(storeId);
    if (current !== publication.id) await this.repository.activate(storeId, publication.id);
    return { id: publication.id, sourceGeneration: publication.sourceGeneration, alreadyCurrent: current === publication.id };
  }
}
