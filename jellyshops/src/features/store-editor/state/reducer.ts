import type { StorefrontDocument } from "@jelly/storefront-schema";
import { applyCommand } from "../model/commands";
import { createHistory, execute, redo, undo } from "../model/history";
import { reconcileSelection } from "../model/selection";
import type { EditorAction, EditorState } from "./types";

function synchronizeHomeTemplate(
  document: StorefrontDocument,
): StorefrontDocument {
  const home = document.pages.find(
    (page) => page.type === "home",
  );
  if (!home || home.sections === document.regions.template) {
    return document;
  }
  return {
    ...document,
    pages: document.pages.map((page) =>
      page.id === home.id
        ? { ...page, sections: document.regions.template }
        : page,
    ),
  };
}

export function createEditorState(document: StorefrontDocument, revision: number): EditorState {
  const synchronized = synchronizeHomeTemplate(document);
  return {
    history: createHistory(synchronized),
    selection: null,
    viewport: "desktop",
    revision,
    generation: 0,
    resourceRevisions: {},
    saveStatus: "saved",
    validationIssues: [],
    activeUploads: 0,
    focusRequestId: 0,
    activePageId: synchronized.pages.find((page) => page.type === "home")?.id ?? synchronized.pages[0].id,
  };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "select") {
    if (action.selection?.kind === "block" && action.selection.fieldKey) {
      const focusRequestId = state.focusRequestId + 1;
      return { ...state, focusRequestId, selection: { ...action.selection, focusRequestId } };
    }
    return { ...state, selection: action.selection };
  }
  if (action.type === "set-viewport") return { ...state, viewport: action.viewport };
  if (action.type === "load-document") {
    const document = synchronizeHomeTemplate(action.document);
    return {
      ...state,
      history: createHistory(document),
      selection: reconcileSelection(document, state.selection),
      revision: action.revision,
      saveStatus: "saved",
      activePageId: document.pages.some((page) => page.id === state.activePageId)
        ? state.activePageId
        : document.pages.find((page) => page.type === "home")?.id ?? document.pages[0].id,
    };
  }
  if (action.type === "load-workspace") {
    return {
      ...state,
      generation: action.generation,
      resourceRevisions: { ...action.resourceRevisions },
    };
  }
  if (action.type === "resource-saved") {
    return {
      ...state,
      generation: action.generation,
      resourceRevisions: {
        ...state.resourceRevisions,
        [action.resourceKey]: action.revision,
      },
      saveStatus: "saved",
    };
  }
  if (action.type === "set-active-page") {
    if (!state.history.present.pages.some((page) => page.id === action.pageId)) return state;
    return { ...state, activePageId: action.pageId, selection: null };
  }
  if (action.type === "set-save-status") return { ...state, saveStatus: action.status };
  if (action.type === "saved") return { ...state, revision: action.revision, saveStatus: "saved" };
  if (action.type === "set-validation-issues") return { ...state, validationIssues: action.issues };
  if (action.type === "set-active-uploads") return { ...state, activeUploads: action.count };

  const history = action.type === "command"
    ? execute(state.history, applyCommand(state.history.present, action.command))
    : action.type === "undo" ? undo(state.history) : redo(state.history);
  if (history === state.history) return state;
  return {
    ...state,
    history,
    selection: reconcileSelection(history.present, state.selection),
    activePageId: history.present.pages.some(
      (page) => page.id === state.activePageId,
    )
      ? state.activePageId
      : history.present.pages.find(
          (page) => page.type === "home",
        )?.id ?? history.present.pages[0].id,
    saveStatus: "dirty",
  };
}
