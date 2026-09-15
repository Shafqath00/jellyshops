import type {
  CompilationDiagnostic,
  RuntimeStorefrontSnapshotV4,
} from "@jelly/storefront-schema";
import { buildDependencyGraph, type StorefrontDependencyGraph } from "./dependency-graph.js";
import { assembleRuntimeSnapshot } from "./snapshot.js";
import type {
  CompilerDynamicSourceResolver,
  CompilerRegistry,
  StorefrontCompilationInput,
} from "./types.js";
import { validateBindings } from "./validate-bindings.js";
import { validateContext } from "./validate-context.js";
import { validateReferences } from "./validate-references.js";
import { validateRegistry } from "./validate-registry.js";

export interface CompilationResult {
  ok: boolean;
  snapshot?: RuntimeStorefrontSnapshotV4;
  dependencies: StorefrontDependencyGraph;
  diagnostics: CompilationDiagnostic[];
}

function sortDiagnostics(diagnostics: CompilationDiagnostic[]): CompilationDiagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const left = `${a.location?.entityType ?? ""}:${a.location?.entityId ?? ""}:${a.location?.sectionId ?? ""}:${a.location?.blockId ?? ""}:${a.location?.fieldKey ?? ""}:${a.code}`;
    const right = `${b.location?.entityType ?? ""}:${b.location?.entityId ?? ""}:${b.location?.sectionId ?? ""}:${b.location?.blockId ?? ""}:${b.location?.fieldKey ?? ""}:${b.code}`;
    return left.localeCompare(right);
  });
}

export async function compileStorefront(
  input: StorefrontCompilationInput,
  registry: CompilerRegistry,
  sources: CompilerDynamicSourceResolver,
  compilerVersion: string,
): Promise<CompilationResult> {
  const dependencies = buildDependencyGraph(input);
  const diagnostics = sortDiagnostics([
    ...validateRegistry(input, registry),
    ...validateReferences(input),
    ...validateContext(input),
    ...await validateBindings(input, registry, sources),
  ]);

  if (diagnostics.some(({ severity }) => severity === "error")) {
    return { ok: false, dependencies, diagnostics };
  }

  try {
    const snapshot = assembleRuntimeSnapshot(input, dependencies, compilerVersion);
    return { ok: true, snapshot, dependencies, diagnostics };
  } catch (error) {
    return {
      ok: false,
      dependencies,
      diagnostics: sortDiagnostics([
        ...diagnostics,
        {
          severity: "error",
          code: "RUNTIME_SNAPSHOT_INVALID",
          message: error instanceof Error ? error.message : "Runtime storefront snapshot is invalid",
          location: { entityType: "workspace", entityId: input.storeId },
        },
      ]),
    };
  }
}
