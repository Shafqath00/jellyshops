"use client";

import { useState } from "react";
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
}) {
  const [busy, setBusy] = useState<"validate" | "preview" | "publish" | null>(null);
  const [status, setStatus] = useState<string>();

  const runValidate = async (expectedGeneration = generation) => {
    setBusy("validate");
    try {
      const result = await validate(expectedGeneration);
      onDiagnostics(result.diagnostics);
      setStatus(result.ok ? "Ready to publish" : "Fix errors before publishing");
      return result;
    } finally {
      setBusy(null);
    }
  };

  const runPreview = async () => {
    setBusy("preview");
    try {
      const result = await compilePreview(generation);
      onDiagnostics(result.diagnostics);
      onPreview(result.snapshot);
      setStatus(result.ok ? "Preview compiled" : "Preview contains compiler errors");
    } finally {
      setBusy(null);
    }
  };

  const runPublish = async () => {
    setBusy("publish");
    setStatus(undefined);
    try {
      const result = await publish(generation, `publish-${crypto.randomUUID()}`);
      onDiagnostics(result.diagnostics);
      setStatus(result.ok ? "Published" : "Publish blocked");
    } catch (error) {
      if (error instanceof StoreEditorApiError && error.code === "WORKSPACE_GENERATION_CONFLICT") {
        const workspace = await refreshWorkspace();
        onGeneration(workspace.generation);
        const result = await validate(workspace.generation);
        onDiagnostics(result.diagnostics);
        setStatus("Workspace changed. Diagnostics refreshed; your local edits were kept.");
        return;
      }
      setStatus(error instanceof Error ? error.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {status && <span role="status" className="mr-1 text-[10px] text-[#616161]">{status}</span>}
      <button type="button" disabled={busy !== null} onClick={() => { void runValidate(); }} className="h-8 rounded-md border border-[#c9cccf] bg-white px-3 text-[11px] font-semibold disabled:opacity-50">Validate</button>
      <button type="button" disabled={busy !== null} onClick={() => { void runPreview(); }} className="h-8 rounded-md border border-[#c9cccf] bg-white px-3 text-[11px] font-semibold disabled:opacity-50">Preview</button>
      <button type="button" aria-label="Publish" disabled={busy !== null || hasBlockingDiagnostics(diagnostics)} onClick={() => { void runPublish(); }} className="h-8 rounded-md bg-[#303030] px-3 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Publish</button>
    </div>
  );
}
