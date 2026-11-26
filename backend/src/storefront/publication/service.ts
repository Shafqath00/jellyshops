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

/** What publishing the draft now would change on the live store. */
export type PublishCheckResult =
  | { ok: true; live: boolean; menus: string[]; design: boolean }
  | { ok: false; diagnostics: CompilationResult["diagnostics"] };

const DESIGN_KEYS = ["theme", "templates", "globalSections", "sectionGroups", "templateDefaults", "assignments"] as const;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Menu handles whose links differ between two snapshots (added and removed menus included). */
export function changedMenus(draft: Record<string, { handle: string; items: unknown }>, live: Record<string, { handle: string; items: unknown }>): string[] {
  const byHandle = (menus: Record<string, { handle: string; items: unknown }>) => new Map(Object.values(menus).map((menu) => [menu.handle, menu.items]));
  const next = byHandle(draft);
  const current = byHandle(live);
  const handles = new Set([...next.keys(), ...current.keys()]);
  return [...handles].filter((handle) => !same(next.get(handle), current.get(handle))).sort();
}

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

  /**
   * Compares the draft with the live store without publishing: which menus would change and whether anything else
   * in the store design would too. Lets the menus page publish menu changes on their own safely.
   */
  async check(storeId: string, expectedGeneration: number): Promise<PublishCheckResult> {
    const compilation = await this.compiler.compile(storeId, expectedGeneration);
    if (!compilation.ok || !compilation.snapshot) return { ok: false, diagnostics: compilation.diagnostics };
    const current = await this.repository.getCurrent(storeId);
    const draft = compilation.snapshot;
    if (!current) return { ok: true, live: false, menus: Object.values(draft.menus).map((menu) => menu.handle).sort(), design: true };
    const live = current.snapshot;
    const design = DESIGN_KEYS.some((key) => !same((draft as Record<string, unknown>)[key], (live as Record<string, unknown>)[key]));
    return { ok: true, live: true, menus: changedMenus(draft.menus, live.menus), design };
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
