"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { useEditorController } from "@/features/store-editor/hooks/use-editor-controller";
import { EditorWorkspaceView } from "@/features/store-editor/components/workspace/editor-workspace-view";

export default function OnlineStoreEditorPage() {
  const { activeStore } = useAuth();
  return <StoreEditorWorkspace key={activeStore?.id ?? "loading"} />;
}

function StoreEditorWorkspace() {
  const ctx = useEditorController();
  const { api, loadError, workspace, templates, activeTemplate, mountedOnClient, setLoadError, setLoadAttempt } = ctx;

  if (!api) {
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center text-[var(--ink)]"><div><h1 className="text-xl font-semibold">Online Store editor is disabled</h1><p className="mt-2 text-sm text-[var(--ink-soft)]">Connect merchant authentication to use the editor.</p></div></main>;
  }

  if (loadError) {
    return <main className="grid min-h-[70vh] place-items-center p-8 text-center text-[var(--ink)]"><div><h1 className="text-xl font-semibold">Could not load Online Store</h1><p role="alert" className="mt-2 text-sm text-[var(--destructive)]">{loadError}</p><button type="button" onClick={() => { setLoadError(undefined); setLoadAttempt((value) => value + 1); }} className="mt-5 rounded-xl border border-[var(--line)] px-5 py-3 text-sm font-semibold">Try again</button></div></main>;
  }

  if (!workspace) {
    return <main className="grid min-h-[70vh] place-items-center text-[13px] text-[var(--ink-soft)]" aria-live="polite">Loading Online Store editor…</main>;
  }

  if (templates.length === 0) {
    return (
      <main className="grid min-h-[70vh] place-items-center p-8 text-center">
        <div>
          <h1 className="text-xl font-semibold">No theme installed</h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">Please choose a template from the Online Store overview to get started.</p>
          <Link href="/admin/online-store" className="mt-4 inline-block text-sm font-semibold text-[var(--ink)] hover:underline">Go to Online Store</Link>
        </div>
      </main>
    );
  }

  if (!activeTemplate) {
    return <main className="grid min-h-[70vh] place-items-center text-[13px] text-[var(--ink-soft)]" aria-live="polite">Loading template…</main>;
  }

  const shell = <EditorWorkspaceView ctx={{ ...ctx, api, workspace, activeTemplate }} />;
  // The admin shell animates each page's opacity, which creates a stacking context that would trap this
  // full-screen editor under the admin header. Render it on <body> once mounted on the client.
  return mountedOnClient ? createPortal(shell, document.body) : shell;
}
