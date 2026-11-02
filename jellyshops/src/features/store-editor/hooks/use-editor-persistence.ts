"use client";

import type { SectionNode } from "@jelly/storefront-schema";
import { setThemeSetting } from "@/features/store-editor/editor-page-helpers";
import { clearUnsaved, rememberUnsaved } from "@/features/store-editor/state/unsaved-work";
import type { useEditorState } from "./use-editor-state";
import type { useEditorDerived } from "./use-editor-derived";

/** Saving templates, shared sections and the theme through the save queue, plus undo, redo and restoring the last session. */
export function useEditorPersistence(ctx: ReturnType<typeof useEditorState> & ReturnType<typeof useEditorDerived>) {
  const { backendStoreId, api, setWorkspace, templateDrafts, globalDrafts, setTemplates, setGlobals, themeDraft, setThemeConfiguration, setDiagnostics, invalidatePreview, convertingRef, history, refreshHistory, historyScope, recordHistory, saveQueueRef, restorable, setRestorable, unsavedDecided, activeTemplate, selectedGlobal } = ctx;
  const persistLayout = (layout: Record<string, unknown>, record = true) =>
    activeTemplate ? persistTemplateLayout(activeTemplate.id, layout, record) : Promise.resolve(false);

  const persistTemplateLayout = async (templateId: string, layout: Record<string, unknown>, record = true) => {
    if (convertingRef.current) return false;
    const previous = templateDrafts.current.find((template) => template.id === templateId);
    if (!api || !previous) return false;
    if (record) recordHistory({ kind: "template", id: previous.id, before: previous.layout, after: layout });
    const draft = { ...previous, layout };
    rememberUnsaved(backendStoreId, { kind: "template", id: draft.id, baseRevision: draft.revision, value: layout });
    setTemplates((current) => current.map((template) => template.id === draft.id ? draft : template));
    invalidatePreview();
    setDiagnostics([]);
    return saveQueueRef.current?.save(`template:${draft.id}`, draft, {
      async persist(value) {
        const result = await api.updateTemplate(backendStoreId, value.id, value.revision, { layout: value.layout });
        setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, result.generation) } : current);
        return result.template;
      },
      onSaved(saved, pending) {
        setTemplates((current) => current.map((template) => template.id === saved.id ? pending ? { ...template, revision: saved.revision } : saved : template));
      },
    }) ?? false;
  };

  const persistThemeSetting = async (path: string, value: unknown, record = true, look?: { themeId: string; themeVersion: string; settings: Record<string, unknown> }) => {
    if (convertingRef.current) return;
    if (!api || !themeDraft.current) return;
    const previous = themeDraft.current;
    const settings = look ? structuredClone(look.settings) : path ? setThemeSetting(previous.settings, path, value) : value as Record<string, unknown>;
    // Applying a saved look also changes the theme itself, which undo does not bring back; save the current look first to keep it.
    if (record && !look) recordHistory({ kind: "theme", id: "theme", before: previous.settings, after: settings });
    const draft = { ...previous, settings, ...(look ? { themeId: look.themeId, themeVersion: look.themeVersion } : {}) };
    if (!look) rememberUnsaved(backendStoreId, { kind: "theme", id: "theme", baseRevision: draft.revision, value: settings });
    setThemeConfiguration(draft);
    invalidatePreview();
    setDiagnostics([]);
    await saveQueueRef.current?.save("theme", draft, {
      async persist(value) {
        const result = await api.saveThemeConfiguration(backendStoreId, value.revision, { themeId: value.themeId, themeVersion: value.themeVersion, settings: value.settings, draftArtifactId: value.draftArtifactId ?? null });
        setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, result.generation) } : current);
        return result.theme;
      },
      onSaved(saved, pending) { setThemeConfiguration(pending && themeDraft.current ? { ...themeDraft.current, revision: saved.revision } : saved); },
    });
  };

  const persistGlobalSection = async (section: SectionNode, record = true, targetId = selectedGlobal?.id) => {
    if (convertingRef.current) return false;
    if (!api || !targetId) return false;
    const previous = globalDrafts.current.find((global) => global.id === targetId);
    if (!previous) return false;
    const nextSection = section as unknown as Record<string, unknown>;
    if (record) recordHistory({ kind: "global", id: previous.id, before: previous.section, after: nextSection });
    const draft = { ...previous, section: nextSection };
    rememberUnsaved(backendStoreId, { kind: "global", id: draft.id, baseRevision: draft.revision, value: nextSection });
    setGlobals((current) => current.map((global) => global.id === draft.id ? draft : global));
    invalidatePreview();
    setDiagnostics([]);
    return saveQueueRef.current?.save(`global:${draft.id}`, draft, {
      async persist(value) {
        const result = await api.updateGlobalSection(backendStoreId, value.id, value.revision, { section: value.section });
        setWorkspace((current) => current ? { ...current, generation: Math.max(current.generation, result.generation) } : current);
        return result.globalSection;
      },
      onSaved(saved, pending) { setGlobals((current) => current.map((global) => global.id === saved.id ? pending ? { ...global, revision: saved.revision } : saved : global)); },
    }) ?? false;
  };

  /** Puts the last session's unsaved changes back; they save like any other edit (and can be undone). */
  const restoreLastSession = async () => {
    const work = restorable;
    if (!work) return;
    setRestorable(null);
    unsavedDecided.current = true;
    for (const item of Object.values(work.items)) {
      if (item.kind === "template") await persistTemplateLayout(item.id, item.value);
      else if (item.kind === "global") await persistGlobalSection(item.value as unknown as SectionNode, true, item.id);
      else await persistThemeSetting("", item.value);
    }
  };
  const discardLastSession = () => {
    setRestorable(null);
    unsavedDecided.current = true;
    clearUnsaved(backendStoreId);
  };

  const playHistory = async (direction: "undo" | "redo") => {
    const change = direction === "undo" ? history.undo(historyScope) : history.redo(historyScope);
    if (!change) return;
    refreshHistory((value) => value + 1);
    const value = direction === "undo" ? change.before : change.after;
    if (change.kind === "template") await persistLayout(value, false);
    else if (change.kind === "global") await persistGlobalSection(value as unknown as SectionNode, false, change.id);
    else await persistThemeSetting("", value, false);
  };
  return { persistLayout, persistThemeSetting, persistGlobalSection, restoreLastSession, discardLastSession, playHistory };
}
