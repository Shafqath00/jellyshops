import type { CompilationDiagnostic, StorefrontDocument } from "@jelly/storefront-schema";
import type { EditorCommand, EditorHistory, EditorSelection } from "../model/types";

export type SaveStatus = "loading" | "saved" | "dirty" | "saving" | "error" | "conflict" | "publishing" | "published";
export type EditorViewport = "desktop" | "tablet" | "mobile";
export interface ValidationIssue { path: string; message: string }
export interface EditorState {
  history: EditorHistory;
  selection: EditorSelection;
  viewport: EditorViewport;
  revision: number;
  generation: number;
  resourceRevisions: Record<string, number>;
  publishDiagnostics: CompilationDiagnostic[];
  saveStatus: SaveStatus;
  validationIssues: ValidationIssue[];
  activeUploads: number;
  focusRequestId: number;
  activePageId: string;
}
export type EditorAction =
  | { type: "command"; command: EditorCommand }
  | { type: "select"; selection: EditorSelection }
  | { type: "set-viewport"; viewport: EditorViewport }
  | { type: "load-document"; document: StorefrontDocument; revision: number }
  | { type: "load-workspace"; generation: number; resourceRevisions: Record<string, number> }
  | { type: "resource-saved"; resourceKey: string; revision: number; generation: number }
  | { type: "workspace-refreshed"; generation: number; diagnostics: CompilationDiagnostic[] }
  | { type: "set-publish-diagnostics"; diagnostics: CompilationDiagnostic[] }
  | { type: "set-active-page"; pageId: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set-save-status"; status: SaveStatus }
  | { type: "saved"; revision: number }
  | { type: "set-validation-issues"; issues: ValidationIssue[] }
  | { type: "set-active-uploads"; count: number };
