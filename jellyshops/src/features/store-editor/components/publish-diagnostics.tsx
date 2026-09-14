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
    <section aria-label="Publish diagnostics" className="rounded-xl border border-[#e3e3e3] bg-white">
      <header className="flex items-center gap-3 border-b border-[#eeeeee] px-4 py-3">
        <h2 className="text-[12px] font-semibold text-[#303030]">Storefront diagnostics</h2>
        <span className="ml-auto text-[10px] font-semibold text-[#b42318]">{errors.length} {errors.length === 1 ? "error" : "errors"}</span>
        <span className="text-[10px] font-semibold text-[#8a6116]">{warnings.length} {warnings.length === 1 ? "warning" : "warnings"}</span>
      </header>
      <div className="divide-y divide-[#eeeeee]">
        {diagnostics.map((diagnostic, index) => (
          <div key={`${diagnostic.code}:${diagnostic.location?.entityId ?? "workspace"}:${index}`} className="flex items-start gap-3 px-4 py-3">
            <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${diagnostic.severity === "error" ? "bg-red-50 text-[#b42318]" : "bg-amber-50 text-[#8a6116]"}`}>{diagnostic.severity}</span>
            <div className="min-w-0 flex-1"><p className="text-[12px] font-medium text-[#303030]">{diagnostic.message}</p><p className="mt-0.5 text-[10px] text-[#8c9196]">{diagnostic.code}</p></div>
            {diagnostic.location && (
              <button type="button" aria-label={`Open ${diagnostic.message}`} onClick={() => onOpen(diagnostic.location!)} className="h-7 shrink-0 rounded-md border border-[#c9cccf] bg-white px-2.5 text-[10px] font-semibold text-[#303030]">Open setting</button>
            )}
          </div>
        ))}
        {diagnostics.length === 0 && <p className="p-5 text-center text-[12px] text-[#6d7175]">No storefront issues found.</p>}
      </div>
    </section>
  );
}
