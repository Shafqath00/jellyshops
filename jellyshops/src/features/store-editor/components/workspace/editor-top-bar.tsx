"use client";

import { RefreshCw } from "lucide-react";
import { createRevisionedSaveQueue } from "@/features/store-editor/state/revisioned-save-queue";
import { pickInitialTemplate, pickTemplateForType } from "@/features/store-editor/template-selection";
import { mainLanguageName } from "@jelly/storefront-themes";
import { PublishControls } from "@/features/store-editor/components/publish-controls";
import { PublishHistory } from "@/features/store-editor/components/publish-history";
import { TemplateActions } from "@/features/store-editor/components/template-actions";
import { EditorPagePicker } from "@/features/store-editor/components/editor-page-picker";
import { WorkspaceToolbar } from "@/features/store-editor/components/workspace-toolbar";
import { defaultTemplateLayout } from "@/features/store-editor/editor-page-helpers";
import { RestoreSessionBanner } from "@/features/store-editor/components/restore-session-banner";
import { describeUnsaved } from "@/features/store-editor/state/unsaved-work";
import type { EditorViewContext } from "../../hooks/use-editor-controller";

/** The toolbar (page picker, language, undo, publish), the restore-session offer and the save-error banner. */
export function EditorTopBar({ ctx }: { ctx: EditorViewContext }) {
  const { editorNotice, setEditorNotice, router, backendStoreId, api, workspace, setWorkspace, templates, templateDrafts, globalDrafts, setTemplates, themeConfiguration, themeDraft, setActiveTemplateId, previewResourceId, setPreviewResourceId, previewQuery, setPreviewQuery, selection, setSelection, setActiveGlobalId, viewport, setViewport, setEditLanguage, setMobilePanel, setDesktopSidebarOpen, previewInspectorEnabled, setPreviewInspectorEnabled, diagnostics, setDiagnostics, setPreviewSnapshot, previewVersion, invalidatePreview, setLibraryRegion, setBlockPickerSectionId, saveState, setSaveState, saveError, setSaveError, isConverting, isPublishing, setIsPublishing, setLoadAttempt, history, refreshHistory, historyScope, saveQueueRef, restorable, activeTemplate, previewResources, languages, activeLanguage, selectedTheme, restoreLastSession, discardLastSession, playHistory } = ctx;
  return (
<>
      <WorkspaceToolbar
        themeName={selectedTheme?.name ?? "Theme"}
        viewport={viewport}
        inspector={previewInspectorEnabled}
        themeSelected={selection?.kind === "theme"}
        canUndo={history.canUndo(historyScope) && !isConverting && !isPublishing}
        canRedo={history.canRedo(historyScope) && !isConverting && !isPublishing}
        onBack={() => { if (!isPublishing) void saveQueueRef.current?.flush().then((saved) => { if (saved) router.push("/admin/online-store"); }); }}
        onSections={() => { setDesktopSidebarOpen(true); setSelection(null); setActiveGlobalId(undefined); setLibraryRegion(undefined); setBlockPickerSectionId(undefined); setMobilePanel("sections"); }}
        onTheme={() => { setDesktopSidebarOpen(true); setSelection({ kind: "theme" }); setActiveGlobalId(undefined); setLibraryRegion(undefined); setBlockPickerSectionId(undefined); setMobilePanel("settings"); }}
        onViewport={setViewport}
        languagePicker={languages.length ? <label className="mr-1 hidden items-center sm:flex"><span className="sr-only">Editing language</span><select aria-label="Editing language" value={activeLanguage ?? ""} onChange={(event) => setEditLanguage(event.target.value || null)} className="h-8 max-w-[130px] rounded-md border border-border bg-card px-2 text-[12px]"><option value="">{mainLanguageName(themeConfiguration?.settings)}</option>{languages.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label> : undefined}
        onInspector={() => setPreviewInspectorEnabled((enabled) => !enabled)}
        onUndo={() => { void playHistory("undo"); }}
        onRedo={() => { void playHistory("redo"); }}
        pagePicker={<div inert={isPublishing} className="flex min-w-0 items-center gap-1">          <EditorPagePicker
            templates={templates.map(({ id, type, handle, name }) => ({ id, type, handle, name }))}
            activeTemplateId={activeTemplate.id}
            previewResources={previewResources}
            previewResourceId={previewResourceId}
            previewQuery={previewQuery}
            onTemplateChange={(templateId) => {
              setActiveTemplateId(templateId);
              setSelection(null);
              setActiveGlobalId(undefined);
              invalidatePreview();
              setMobilePanel("sections");
            }}
            onPreviewResourceChange={setPreviewResourceId}
            onPreviewQueryChange={setPreviewQuery}
            onPageTypeChange={(pageType) => {
              const template = pickTemplateForType(templates, pageType);
              if (template) {
                setActiveTemplateId(template.id);
                setSelection(null);
                setActiveGlobalId(undefined);
                invalidatePreview();
                setMobilePanel("sections");
                return;
              }
              if (!api) return;
              void (async () => {
              if (!await saveQueueRef.current?.flush()) return;
              setSaveState("saving");
              await api.createTemplate(backendStoreId, {
                type: pageType,
                name: `Default ${pageType.charAt(0).toUpperCase()}${pageType.slice(1)}`,
                handle: "default",
                layout: defaultTemplateLayout(pageType),
              }).then((result) => {
                setTemplates((current) => [...current, result.template]);
                setActiveTemplateId(result.template.id);
                setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
                invalidatePreview();
                setMobilePanel("sections");
                setSaveState("saved");
              }).catch((error: unknown) => {
                setSaveError(error instanceof Error ? error.message : "Could not create this page. Try again.");
                setSaveState("error");
              });
              })();
            }}
          />
          <TemplateActions
            api={api}
            storeId={backendStoreId}
            activeTemplate={activeTemplate}
            templates={templates}
            latest={(templateId) => templateDrafts.current.find((item) => item.id === templateId)}
            blankLayout={defaultTemplateLayout(activeTemplate.type)}
            disabled={isPublishing || isConverting}
            flush={() => saveQueueRef.current?.flush() ?? Promise.resolve(true)}
            onCreated={(template, generation) => {
              setTemplates((current) => [...current, template]);
              setActiveTemplateId(template.id);
              setSelection(null);
              setActiveGlobalId(undefined);
              setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, generation) } : current);
              invalidatePreview();
              setMobilePanel("sections");
            }}
            onUpdated={(template, generation) => {
              setTemplates((current) => current.map((item) => item.id === template.id ? template : item));
              setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, generation) } : current);
            }}
            onDeleted={(templateId, generation) => {
              const remaining = templateDrafts.current.filter((item) => item.id !== templateId);
              setTemplates(remaining);
              setActiveTemplateId(pickTemplateForType(remaining, activeTemplate.type)?.id ?? pickInitialTemplate(remaining)?.id ?? "");
              setSelection(null);
              setActiveGlobalId(undefined);
              setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, generation) } : current);
              invalidatePreview();
            }}
          /></div>}
        actions={<><span role="status" className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground"><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${saveState === "error" ? "bg-destructive" : saveState === "saving" ? "bg-muted-foreground/50" : "bg-emerald-500"}`} /><span className="sr-only md:not-sr-only md:max-w-24 md:truncate">{saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}</span></span>          <PublishControls
            compact
            mobileActions={[
              { label: "Sections", action: () => { setSelection(null); setActiveGlobalId(undefined); setMobilePanel("sections"); } },
              { label: "Theme settings", action: () => { setSelection({ kind: "theme" }); setActiveGlobalId(undefined); setMobilePanel("settings"); } },
              { label: "Desktop preview", action: () => setViewport("desktop") },
              { label: previewInspectorEnabled ? "Turn off preview inspector" : "Turn on preview inspector", action: () => setPreviewInspectorEnabled((enabled) => !enabled) },
              { label: "Undo", action: () => { void playHistory("undo"); }, disabled: !history.canUndo(historyScope) || isPublishing },
              { label: "Redo", action: () => { void playHistory("redo"); }, disabled: !history.canRedo(historyScope) || isPublishing },
            ]}
            historyMenu={<PublishHistory disabled={isPublishing} list={async () => (await api.listPublications(backendStoreId)).publications} restore={async (publicationId) => { await api.restorePublication(backendStoreId, publicationId); }} />}
            onSaveDraft={() => { void saveQueueRef.current?.flush(); }}
            saveState={saveState}
            flushDraft={() => saveQueueRef.current?.flush() ?? Promise.resolve(false)}
            onPublishingChange={setIsPublishing}
            generation={workspace.generation}
            diagnostics={diagnostics}
            validate={(generation) => api.validate(backendStoreId, generation)}
            compilePreview={async (generation) => {
              const version = previewVersion.current;
              const result = await api.compilePreview(backendStoreId, generation);
              if (previewVersion.current !== version) throw new Error("Your draft changed while the preview was loading. Try again.");
              return result;
            }}
            publish={(generation, idempotencyKey) => api.publish(backendStoreId, generation, idempotencyKey)}
            refreshWorkspace={() => api.loadWorkspace(backendStoreId)}
            onDiagnostics={(next) => { setDiagnostics(next); if (next.length) { setDesktopSidebarOpen(true); setMobilePanel("settings"); } }}
            onPreview={setPreviewSnapshot}
            onGeneration={(generation) => setWorkspace((current) => current ? { ...current, generation } : current)}
          /></>}
      />

      {restorable && <RestoreSessionBanner summary={describeUnsaved(restorable)} savedAt={restorable.savedAt} onRestore={() => { void restoreLastSession(); }} onDiscard={discardLastSession} />}
      {editorNotice && <div role="status" className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-muted px-5 py-2.5 text-xs leading-5 text-foreground"><p>{editorNotice}</p><button type="button" className="shrink-0 rounded-md px-2 py-1 font-semibold underline-offset-2 hover:underline" onClick={() => setEditorNotice(undefined)}>Dismiss</button></div>}
      {saveState === "error" && <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-5 py-3 text-xs leading-5 text-destructive"><p><strong>Your changes are still here.</strong> {saveError ?? "They could not be saved."}</p><button type="button" onClick={() => { setSaveError(undefined); void saveQueueRef.current?.retry(); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-destructive/30 bg-card px-3 font-semibold"><RefreshCw size={13} />Retry saving</button><button type="button" onClick={() => { const data = new Blob([JSON.stringify({ templates: templateDrafts.current, globals: globalDrafts.current, theme: themeDraft.current }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(data); const link = document.createElement("a"); link.href = url; link.download = "jelly-shop-local-changes.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }} className="rounded-lg border border-destructive/30 bg-card px-3 py-2 font-semibold">Download local changes</button><button type="button" onClick={() => { if (!window.confirm("Discard unsaved changes and reload the latest saved workspace? Download your local changes first if you want to keep a copy.")) return; saveQueueRef.current?.dispose(); saveQueueRef.current = createRevisionedSaveQueue({ onStatus: setSaveState, onError: (error) => setSaveError(error instanceof Error ? error.message : "Your changes could not be saved.") }); history.clear(); refreshHistory((value) => value + 1); setSaveState("saved"); setSaveError(undefined); setLoadAttempt((value) => value + 1); }} className="rounded-lg border border-destructive/30 bg-card px-3 py-2 font-semibold">Discard local changes and reload</button></div>}
</>
  );
}
