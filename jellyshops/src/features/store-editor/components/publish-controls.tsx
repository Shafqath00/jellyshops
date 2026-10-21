"use client";

import { useState } from "react";
import { Check, Eye, Loader2, Upload } from "lucide-react";
import type { SaveState } from "../state/revisioned-save-queue";
import type { CompilationDiagnostic, RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { StoreEditorApiError, type CompilationResult, type PublishResult, type WorkspaceRecord } from "../api/types";
import { hasBlockingDiagnostics } from "./publish-diagnostics";

export function PublishControls({
  generation,
  diagnostics,
  validate,
  compilePreview,
  publish,
  refreshWorkspace,
  onDiagnostics,
  onPreview,
  onGeneration,
  saveState = "saved",
}: {
  generation: number;
  diagnostics: CompilationDiagnostic[];
  validate(expectedGeneration: number): Promise<CompilationResult>;
  compilePreview(expectedGeneration: number): Promise<CompilationResult>;
  publish(expectedGeneration: number, idempotencyKey: string): Promise<PublishResult>;
  refreshWorkspace(): Promise<WorkspaceRecord>;
  onDiagnostics(diagnostics: CompilationDiagnostic[]): void;
  onPreview(snapshot: RuntimeStorefrontSnapshotV4 | undefined): void;
  onGeneration(generation: number): void;
  saveState?: SaveState;
}) {
  const [busy, setBusy] = useState<"validate" | "preview" | "publish" | null>(null);
  const [status, setStatus] = useState<string>();
  const [failed, setFailed] = useState(false);
  const disabled = busy !== null || saveState !== "saved";

  const runValidate = async (expectedGeneration = generation) => {
    setBusy("validate");
    setFailed(false);
    try {
      const result = await validate(expectedGeneration);
      onDiagnostics(result.diagnostics);
      setStatus(result.ok ? "Ready to publish" : "Fix errors before publishing");
      return result;
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : "Could not check your changes. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const runPreview = async () => {
    setBusy("preview");
    setFailed(false);
    try {
      const result = await compilePreview(generation);
      onDiagnostics(result.diagnostics);
      onPreview(result.snapshot);
      setStatus(result.ok ? "Preview compiled" : "Preview contains compiler errors");
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error ? error.message : "Could not load your preview. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const runPublish = async () => {
    setBusy("publish");
    setStatus(undefined);
    setFailed(false);
    try {
      const result = await publish(generation, `publish-${crypto.randomUUID()}`);
      onDiagnostics(result.diagnostics);
      setStatus(result.ok ? "Published" : "Publish blocked");
    } catch (error) {
      if (error instanceof StoreEditorApiError && error.code === "WORKSPACE_GENERATION_CONFLICT") {
        try {
          const workspace = await refreshWorkspace();
          onGeneration(workspace.generation);
          const result = await validate(workspace.generation);
          onDiagnostics(result.diagnostics);
          setStatus("Workspace changed. Diagnostics refreshed; your local edits were kept.");
        } catch (refreshError) {
          setFailed(true);
          setStatus(refreshError instanceof Error ? refreshError.message : "Could not refresh your store. Try again.");
        }
        return;
      }
      setFailed(true);
      setStatus(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-busy={busy !== null}>
      {status && <span role={failed ? "alert" : "status"} className={`order-last w-full text-right text-xs ${failed ? "text-red-700" : "text-[var(--ink-soft)]"}`}>{status}</span>}
      <button type="button" aria-label="Validate" title="Check your changes" disabled={disabled} onClick={() => { void runValidate(); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-card px-3 text-xs font-semibold disabled:opacity-40"><Check size={14} /><span className="hidden sm:inline">Check</span></button>
      <button type="button" aria-label="Preview" disabled={disabled} onClick={() => { void runPreview(); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-card px-3 text-xs font-semibold disabled:opacity-40"><Eye size={14} /><span className="hidden sm:inline">Preview</span></button>
      <button type="button" aria-label="Publish" disabled={disabled || hasBlockingDiagnostics(diagnostics)} onClick={() => { void runPublish(); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy === "publish" ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <Upload size={14} />}Publish</button>
    </div>
  );
}
