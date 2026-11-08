"use client";

import { useEditorState } from "./use-editor-state";
import { useEditorLifecycle } from "./use-editor-lifecycle";
import { useEditorDerived } from "./use-editor-derived";
import { useEditorPersistence } from "./use-editor-persistence";
import { useThemeLooks } from "./use-theme-looks";
import { useEditorActions } from "./use-editor-actions";

/**
 * All of the theme editor's state and actions, built from smaller hooks that run in a fixed
 * order. Each one receives what the earlier ones return.
 */
export function useEditorController() {
  const state = useEditorState();
  useEditorLifecycle(state);
  const derived = useEditorDerived(state);
  const persistence = useEditorPersistence({ ...state, ...derived });
  const looks = useThemeLooks({ ...state, ...derived, ...persistence });
  const actions = useEditorActions({ ...state, ...derived, ...persistence, ...looks });
  return { ...state, ...derived, ...persistence, ...looks, ...actions };
}

export type EditorController = ReturnType<typeof useEditorController>;

/** What the editor's views receive once the workspace has loaded: the api, workspace and active template are known. */
export type EditorViewContext = Omit<EditorController, "api" | "workspace" | "activeTemplate"> & {
  api: NonNullable<EditorController["api"]>;
  workspace: NonNullable<EditorController["workspace"]>;
  activeTemplate: NonNullable<EditorController["activeTemplate"]>;
};
