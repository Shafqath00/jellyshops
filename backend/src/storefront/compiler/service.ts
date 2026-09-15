import type { CompilerDynamicSourceResolver, CompilerRegistry } from "./types.js";
import type { CompilationResult } from "./compiler.js";
import { compileStorefront } from "./compiler.js";

export interface CompilationInputLoader {
  load(storeId: string, expectedGeneration: number, registryManifestHash: string): Promise<import("./types.js").StorefrontCompilationInput>;
}

export class StorefrontCompilationService {
  constructor(
    private readonly loader: CompilationInputLoader,
    private readonly registry: CompilerRegistry,
    private readonly sources: CompilerDynamicSourceResolver,
    private readonly compilerVersion: string,
    private readonly registryManifestHash: () => string,
  ) {}

  async compile(storeId: string, expectedGeneration: number): Promise<CompilationResult> {
    const input = await this.loader.load(storeId, expectedGeneration, this.registryManifestHash());
    return compileStorefront(input, this.registry, this.sources, this.compilerVersion);
  }
}
