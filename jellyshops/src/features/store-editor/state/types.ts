import type { StorefrontDocument } from "@jelly/storefront-schema";
import type { EditorCommand, EditorHistory, EditorSelection } from "../model/types";

export type SaveStatus = "loading" | "saved" | "dirty" | "saving" | "error" | "conflict" | "publishing" | "published";
export type EditorViewport = "desktop" | "tablet" | "mobile";
export interface ValidationIssue { path: string; message: string }
export interface EditorState {
  history: EditorHistory;
  selection: EditorSelection;
  viewport: EditorViewport;
  revision: number;
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
  | { type: "set-active-page"; pageId: string }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "set-save-status"; status: SaveStatus }
  | { type: "saved"; revision: number }
  | { type: "set-validation-issues"; issues: ValidationIssue[] }
  | { type: "set-active-uploads"; count: number };
