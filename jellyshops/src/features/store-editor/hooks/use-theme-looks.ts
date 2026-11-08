"use client";

/* eslint-disable react-hooks/exhaustive-deps --
   State setters and refs reach this hook through `ctx`, so the linter cannot see that they never
   change. Effects list only the values that should re-run them. */

import { useEffect } from "react";
import type { useEditorState } from "./use-editor-state";
import type { useEditorDerived } from "./use-editor-derived";
import type { useEditorPersistence } from "./use-editor-persistence";

/** The theme library: loading, saving, renaming and deleting saved looks. */
export function useThemeLooks(ctx: ReturnType<typeof useEditorState> & ReturnType<typeof useEditorDerived> & ReturnType<typeof useEditorPersistence>) {
  const { backendStoreId, api, setLooks, setLooksError, looksBusy, setLooksBusy, themeDraft, saveQueueRef } = ctx;
  useEffect(() => {
    if (!api || !backendStoreId) return;
    let active = true;
    api.listThemeLooks(backendStoreId).then((result) => { if (active) setLooks(result.looks); }).catch(() => undefined);
    return () => { active = false; };
  }, [api, backendStoreId]);

  const saveThemeLook = async (name: string) => {
    if (!api || !themeDraft.current || looksBusy) return;
    setLooksBusy(true); setLooksError("");
    try {
      if (!await saveQueueRef.current?.flush()) return;
      const current = themeDraft.current;
      const result = await api.saveThemeLook(backendStoreId, { name, themeId: current.themeId, ...(current.themeVersion ? { themeVersion: current.themeVersion } : {}), settings: current.settings });
      setLooks((existing) => [...existing, result.look]);
    } catch (error) { setLooksError(error instanceof Error ? error.message : "Could not save this look. Try again."); }
    finally { setLooksBusy(false); }
  };

  const renameThemeLook = async (look: { id: string }, name: string) => {
    if (!api || looksBusy) return;
    setLooksBusy(true); setLooksError("");
    try { const result = await api.renameThemeLook(backendStoreId, look.id, name); setLooks((existing) => existing.map((item) => item.id === look.id ? result.look : item)); }
    catch (error) { setLooksError(error instanceof Error ? error.message : "Could not rename this look. Try again."); }
    finally { setLooksBusy(false); }
  };

  const deleteThemeLook = async (look: { id: string }) => {
    if (!api || looksBusy) return;
    setLooksBusy(true); setLooksError("");
    try { await api.deleteThemeLook(backendStoreId, look.id); setLooks((existing) => existing.filter((item) => item.id !== look.id)); }
    catch (error) { setLooksError(error instanceof Error ? error.message : "Could not delete this look. Try again."); }
    finally { setLooksBusy(false); }
  };
  return { saveThemeLook, renameThemeLook, deleteThemeLook };
}
