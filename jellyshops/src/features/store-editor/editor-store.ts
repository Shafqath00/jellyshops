import type { PageType, StoreDesignDocument, ThemeId } from "@jelly/storefront-schema";

export interface EditorState { document: StoreDesignDocument; selectedSectionId: string | null; saving: boolean; }
export function createEditorState(document: StoreDesignDocument): EditorState { return { document: structuredClone(document), selectedSectionId: null, saving: false }; }
export function setTheme(state: EditorState, themeId: ThemeId): EditorState { return { ...state, document: { ...state.document, theme: { ...state.document.theme, id: themeId } } }; }
export function moveSection(state: EditorState, page: PageType, sectionId: string, direction: "up" | "down"): EditorState {
  const sections = [...state.document.pages[page].sections]; const index = sections.findIndex((section) => section.id === sectionId); const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= sections.length) return state;
  [sections[index], sections[target]] = [sections[target], sections[index]];
  return { ...state, document: { ...state.document, pages: { ...state.document.pages, [page]: { ...state.document.pages[page], sections } } } };
}

export interface WorkspaceEditorState {
  generation: number;
  resourceRevisions: Record<string, number>;
}

export function createWorkspaceEditorState(
  generation: number,
  resourceRevisions: Record<string, number> = {},
): WorkspaceEditorState {
  return { generation, resourceRevisions: { ...resourceRevisions } };
}

export function applyResourceSave(
  state: WorkspaceEditorState,
  resourceKey: string,
  revision: number,
  generation: number,
): WorkspaceEditorState {
  if (generation < state.generation) {
    throw new Error("Workspace generation cannot move backwards");
  }
  return {
    generation,
    resourceRevisions: {
      ...state.resourceRevisions,
      [resourceKey]: revision,
    },
  };
}
