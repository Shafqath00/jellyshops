"use client";

import { useState, type ReactNode } from "react";
import { Check, Eye, Loader2, Upload, MoreHorizontal, ChevronDown } from "lucide-react";
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
  flushDraft,
  onPublishingChange,
  compact = false,
  onSaveDraft,
  mobileActions,
  historyMenu,
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
  flushDraft?(): Promise<boolean>;
  onPublishingChange?(busy: boolean): void;
  compact?: boolean;
  onSaveDraft?(): void;
  mobileActions?: Array<{ label: string; action(): void; disabled?: boolean }>;
  /** Extra "More actions" entry, e.g. the version history. */
  historyMenu?: ReactNode;
}) {
  const [busy, setBusy] = useState<"validate" | "preview" | "publish" | null>(null);
  const [status, setStatus] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [publishedGeneration, setPublishedGeneration] = useState<number>();
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
    onPublishingChange?.(true);
    setStatus(undefined);
    setFailed(false);
    try {
      let publishGeneration = generation;
      if (flushDraft) {
        if (!await flushDraft()) {
          setFailed(true);
          setStatus("Your draft could not be saved. Retry saving before publishing.");
          return;
        }
        const workspace = await refreshWorkspace();
        publishGeneration = workspace.generation;
        onGeneration(publishGeneration);
        const validation = await validate(publishGeneration);
        onDiagnostics(validation.diagnostics);
        if (!validation.ok || hasBlockingDiagnostics(validation.diagnostics)) {
          setStatus("Fix errors before publishing");
          return;
        }
      }
      const result = await publish(publishGeneration, `publish-${crypto.randomUUID()}`);
      onDiagnostics(result.diagnostics);
      setPublishedGeneration(result.ok ? publishGeneration : undefined);
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
      onPublishingChange?.(false);
    }
  };

  if (compact) return <div className="relative flex items-center gap-1" aria-busy={busy !== null}>
    <details className="relative"><summary aria-label="More actions" title="More actions" className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-border text-[18px] hover:bg-muted"><MoreHorizontal size={17} /></summary><div className="absolute right-0 z-[80] mt-1 w-44 rounded-lg border border-border bg-card p-1 shadow-lg">{mobileActions?.map((item) => <button key={item.label} type="button" disabled={item.disabled} onClick={(event) => { item.action(); event.currentTarget.closest("details")?.removeAttribute("open"); }} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-50 sm:hidden">{item.label}</button>)}<button type="button" disabled={disabled} onClick={() => { void runValidate(); }} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-50">Check changes</button><button type="button" disabled={disabled} onClick={() => { void runPreview(); }} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-50">Compiled preview</button>{historyMenu}</div></details>
    <div className="flex rounded-lg bg-primary text-primary-foreground"><button type="button" onClick={onSaveDraft} disabled={busy !== null || saveState === "error"} className="flex h-9 items-center gap-1.5 px-3 text-xs font-semibold disabled:opacity-50"><span aria-hidden="true" className={`size-1.5 rounded-full md:hidden ${saveState === "error" ? "bg-red-400" : saveState === "saving" ? "bg-amber-400" : "bg-emerald-400"}`} /><span className="sr-only">{saveState === "error" ? "Changes not saved. " : saveState === "saving" ? "Saving changes. " : "Draft saved. "}</span>Save draft</button><details className="relative border-l border-primary-foreground/20"><summary aria-label="Publishing options" title="Publishing options" className="grid h-9 w-8 cursor-pointer list-none place-items-center text-sm"><ChevronDown size={14} /></summary><div className="absolute right-0 z-[80] mt-1 w-40 rounded-lg border border-border bg-card p-1 text-foreground shadow-lg"><button type="button" disabled={busy !== null || (!flushDraft && (disabled || hasBlockingDiagnostics(diagnostics)))} onClick={() => { void runPublish(); }} className="block w-full rounded-md px-3 py-2 text-left text-xs hover:bg-muted disabled:opacity-50">{busy === "publish" ? "Publishing…" : "Publish"}</button></div></details></div>
    {status && (status !== "Published" || (saveState === "saved" && publishedGeneration === generation)) && <span role={failed ? "alert" : "status"} className="absolute right-0 top-full z-[70] mt-2 w-64 rounded-lg border border-border bg-card p-2 text-xs text-foreground shadow-lg">{status}</span>}
  </div>;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-busy={busy !== null}>
      {status && (status !== "Published" || (saveState === "saved" && publishedGeneration === generation)) && <span role={failed ? "alert" : "status"} className={`order-last w-full text-right text-xs ${failed ? "text-red-700" : "text-[var(--ink-soft)]"}`}>{status}</span>}
      <details className="relative">
        <summary className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-2 text-xs font-semibold">More actions</summary>
        <div className="absolute right-0 z-50 mt-1 flex gap-2 rounded-lg border border-[var(--line)] bg-card p-2 shadow-lg">
      <button type="button" aria-label="Validate" title="Check your changes" disabled={disabled} onClick={() => { void runValidate(); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-card px-3 text-xs font-semibold disabled:opacity-40"><Check size={14} /><span className="hidden sm:inline">Check</span></button>
      <button type="button" aria-label="Preview" disabled={disabled} onClick={() => { void runPreview(); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--line)] bg-card px-3 text-xs font-semibold disabled:opacity-40"><Eye size={14} /><span className="hidden sm:inline">Preview</span></button>
        </div>
      </details>
      <button type="button" aria-label="Publish" disabled={busy !== null || (!flushDraft && (disabled || hasBlockingDiagnostics(diagnostics)))} onClick={() => { void runPublish(); }} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{busy === "publish" ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : <Upload size={14} />}Publish</button>
    </div>
  );
}
