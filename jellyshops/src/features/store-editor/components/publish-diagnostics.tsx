import type { CompilationDiagnostic, CompilationDiagnosticLocation } from "@jelly/storefront-schema";

export function hasBlockingDiagnostics(diagnostics: CompilationDiagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}

export function PublishDiagnostics({
  diagnostics,
  onOpen,
}: {
  diagnostics: CompilationDiagnostic[];
  onOpen(location: CompilationDiagnosticLocation): void;
}) {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning");

  return (
    <section aria-label="Publish diagnostics" className="rounded-xl border border-border bg-card">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <h2 className="text-[12px] font-semibold text-foreground">Storefront diagnostics</h2>
        <span className="ml-auto text-[10px] font-semibold text-destructive">{errors.length} {errors.length === 1 ? "error" : "errors"}</span>
        <span className="text-[10px] font-semibold text-[var(--warn-fg)]">{warnings.length} {warnings.length === 1 ? "warning" : "warnings"}</span>
      </header>
      <div className="divide-y divide-border">
        {diagnostics.map((diagnostic, index) => (
          <div key={`${diagnostic.code}:${diagnostic.location?.entityId ?? "workspace"}:${index}`} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${diagnostic.severity === "error" ? "bg-red-50 text-destructive" : "bg-amber-50 text-[var(--warn-fg)]"}`}>{diagnostic.severity}</span>
            <div className="min-w-0 flex-1"><p className="text-[12px] font-medium text-foreground">{diagnostic.message}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{diagnostic.code}</p></div>
            {diagnostic.location && (
              <button type="button" aria-label={`Open ${diagnostic.message}`} onClick={() => onOpen(diagnostic.location!)} className="h-7 shrink-0 rounded-md border border-border bg-card px-2.5 text-[10px] font-semibold text-foreground">Open setting</button>
            )}
          </div>
        ))}
        {diagnostics.length === 0 && <p className="p-5 text-center text-[12px] text-muted-foreground">No storefront issues found.</p>}
      </div>
    </section>
  );
}
