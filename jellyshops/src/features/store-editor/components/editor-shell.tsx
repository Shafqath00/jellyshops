"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import type { CommerceDataProvider } from "@jelly/storefront-renderer";
import type { StorefrontDocument } from "@jelly/storefront-schema";

import type {
  DemoCatalog,
  MediaRecord,
} from "../api/types";
import { PageHierarchy } from "./page-hierarchy";
import { PreviewCanvas } from "./preview-canvas";
import { EditorToolbar } from "./editor-toolbar";
import { Inspector } from "./inspector/inspector";
import { ThemeInspector } from "./inspector/theme-inspector";
import {
  createEditorState,
  editorReducer,
} from "../state/reducer";
import {
  createAutosaveController,
  type AutosaveController,
} from "../state/autosave-controller";
import type { EditorCommand } from "../model/types";
import { StoreEditorApiError } from "../api/types";

const emptyCatalog: DemoCatalog = {
  products: [],
  collections: [],
};

type MobilePanel =
  | "sections"
  | "settings"
  | null;

export function EditorShell({
  initialDocument,
  revision,
  commerce,
  catalog = emptyCatalog,
  upload,
  onSave,
  onPublish,
  onReload,
}: {
  initialDocument: StorefrontDocument;
  revision: number;
  commerce: CommerceDataProvider;
  catalog?: DemoCatalog;
  upload?: (
    file: File,
    onProgress?: (percent: number) => void
  ) => Promise<MediaRecord>;
  onSave(
    document: StorefrontDocument,
    revision: number
  ): Promise<number> | number;
  onPublish(
    document: StorefrontDocument,
    revision: number
  ): Promise<void> | void;
  onReload?(): Promise<{
    document: StorefrontDocument;
    revision: number;
  }>;
}) {
  const [state, dispatch] = useReducer(
    editorReducer,
    createEditorState(initialDocument, revision)
  );

  const [mobilePanel, setMobilePanel] =
    useState<MobilePanel>(null);

  const operationInFlight = useRef(false);
  const autosave =
    useRef<AutosaveController | null>(null);

  const documentRef = useRef(initialDocument);
  const revisionRef = useRef(revision);
  const onSaveRef = useRef(onSave);

  documentRef.current = state.history.present;
  revisionRef.current = state.revision;
  onSaveRef.current = onSave;

  useEffect(() => {
    dispatch({
      type: "load-document",
      document: initialDocument,
      revision,
    });
  }, [initialDocument, revision]);

  const document = state.history.present;
  const activePage =
    document.pages.find(
      (page) => page.id === state.activePageId
    ) ?? document.pages[0];
  const editorDocument = activePage
    ? {
        ...document,
        regions: {
          ...document.regions,
          template: activePage.sections,
        },
      }
    : document;

  useEffect(() => {
    autosave.current = createAutosaveController({
      save: async () => {
        if (operationInFlight.current) return;

        operationInFlight.current = true;

        try {
          const nextRevision =
            await onSaveRef.current(
              documentRef.current,
              revisionRef.current
            );

          dispatch({
            type: "saved",
            revision: nextRevision,
          });
        } finally {
          operationInFlight.current = false;
        }
      },

      onStatus: (status) =>
        dispatch({
          type: "set-save-status",
          status,
        }),

      onError: (error) => {
        const isRevisionConflict =
          (error instanceof StoreEditorApiError ||
            (typeof error === "object" && error !== null)) &&
          "code" in error &&
          error.code === "REVISION_CONFLICT";

        if (isRevisionConflict) {
          dispatch({
            type: "set-save-status",
            status: "conflict",
          });

          return true;
        }

        return false;
      },
    });

    return () => {
      autosave.current?.dispose();
    };
  }, []);

  const save = async () => {
    if (operationInFlight.current) return;

    operationInFlight.current = true;

    dispatch({
      type: "set-save-status",
      status: "saving",
    });

    try {
      const nextRevision = await onSave(
        document,
        state.revision
      );

      dispatch({
        type: "saved",
        revision: nextRevision,
      });
    } catch {
      dispatch({
        type: "set-save-status",
        status: "error",
      });
    } finally {
      operationInFlight.current = false;
    }
  };

  const publish = async () => {
    if (operationInFlight.current) return;

    operationInFlight.current = true;

    dispatch({
      type: "set-save-status",
      status: "publishing",
    });

    try {
      const savedRevision = await onSave(
        document,
        state.revision
      );

      dispatch({
        type: "saved",
        revision: savedRevision,
      });

      await onPublish(document, savedRevision);

      dispatch({
        type: "set-save-status",
        status: "published",
      });
    } catch {
      dispatch({
        type: "set-save-status",
        status: "error",
      });
    } finally {
      operationInFlight.current = false;
    }
  };

  const reload = async () => {
    if (
      !onReload ||
      operationInFlight.current
    ) {
      return;
    }

    operationInFlight.current = true;

    try {
      const latest = await onReload();

      dispatch({
        type: "load-document",
        document: latest.document,
        revision: latest.revision,
      });
    } finally {
      operationInFlight.current = false;
    }
  };

  const command = (next: EditorCommand) => {
    const scoped =
      "region" in next &&
      next.region === "template"
        ? {
            ...next,
            pageId: state.activePageId,
          }
        : next;

    dispatch({
      type: "command",
      command: scoped,
    });

    autosave.current?.changed();
  };

  const handleSelection = (
    selection: typeof state.selection
  ) => {
    dispatch({
      type: "select",
      selection,
    });

    if (selection) {
      setMobilePanel("settings");
    }
  };

  const inspector = state.selection?.kind === "theme" ? (
    <ThemeInspector
      document={editorDocument}
      onSelect={handleSelection}
      onCommand={command}
    />
  ) : state.selection ? (
    <Inspector
      document={editorDocument}
      selection={state.selection}
      catalog={catalog}
      upload={upload}
      onSelect={handleSelection}
      onCommand={command}
    />
  ) : (
    <div className="flex h-full items-center justify-center px-8 text-center">
      <div className="max-w-[220px]">
        <p className="text-[13px] font-semibold text-[#303030]">
          Nothing selected
        </p>

        <p className="mt-1.5 text-[12px] leading-5 text-[#8c9196]">
          Select a section or block in the preview to edit
          its settings.
        </p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex h-dvh flex-col overflow-hidden bg-[#f4f4f5] text-[#303030]">
      <EditorToolbar
        viewport={state.viewport}
        status={state.saveStatus}
        canUndo={state.history.past.length > 0}
        canRedo={state.history.future.length > 0}
        onViewport={(viewport) =>
          dispatch({
            type: "set-viewport",
            viewport,
          })
        }
        onUndo={() =>
          dispatch({
            type: "undo",
          })
        }
        onRedo={() =>
          dispatch({
            type: "redo",
          })
        }
        onSave={() => void save()}
        onPublish={() => void publish()}
        onReload={() => void reload()}
      />

      {/* Mobile editor navigation */}
      <div className="flex h-11 shrink-0 items-center justify-center gap-1 border-b border-[#e3e3e3] bg-white px-3 lg:hidden">
        <button
          type="button"
          onClick={() =>
            setMobilePanel("sections")
          }
          className={clsx(
            "h-8 rounded-lg px-3 text-[12px] font-medium transition",
            mobilePanel === "sections"
              ? "bg-[#eeeeee] text-[#202223]"
              : "text-[#6d7175] hover:bg-[#f6f6f7]"
          )}
        >
          Sections
        </button>

        <button
          type="button"
          onClick={() =>
            setMobilePanel(null)
          }
          className={clsx(
            "h-8 rounded-lg px-3 text-[12px] font-medium transition",
            mobilePanel === null
              ? "bg-[#eeeeee] text-[#202223]"
              : "text-[#6d7175] hover:bg-[#f6f6f7]"
          )}
        >
          Preview
        </button>

        <button
          type="button"
          onClick={() =>
            setMobilePanel("settings")
          }
          className={clsx(
            "h-8 rounded-lg px-3 text-[12px] font-medium transition",
            mobilePanel === "settings"
              ? "bg-[#eeeeee] text-[#202223]"
              : "text-[#6d7175] hover:bg-[#f6f6f7]"
          )}
        >
          Settings
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[240px_minmax(0,1fr)_300px] xl:grid-cols-[250px_minmax(0,1fr)_320px]">
        {/* Mobile backdrop */}
        {mobilePanel && (
          <button
            type="button"
            aria-label="Close editor panel"
            onClick={() =>
              setMobilePanel(null)
            }
            className="absolute inset-0 z-20 bg-black/15 backdrop-blur-[1px] lg:hidden"
          />
        )}

        {/* Sections */}
        <div
          className={clsx(
            "min-h-0 overflow-y-auto border-r border-[#e3e3e3] bg-white",
            "[&_.theme-editor-sidebar]:h-full",
            "[&_.theme-editor-sidebar]:w-full",
            "[&_.theme-editor-sidebar]:border-0",
            "[&_.theme-editor-sidebar]:bg-transparent",

            "lg:relative lg:z-auto lg:block",

            mobilePanel === "sections"
              ? "absolute inset-y-0 left-0 z-30 block w-[min(320px,88vw)] shadow-xl"
              : "hidden lg:block"
          )}
        >
          <PageHierarchy
            document={editorDocument}
            activePageId={state.activePageId}
            onPageSelect={(pageId) =>
              dispatch({
                type: "set-active-page",
                pageId,
              })
            }
            selection={state.selection}
            onSelect={handleSelection}
            onCommand={command}
          />
        </div>

        {/* Preview */}
        <main className="min-h-0 min-w-0 overflow-hidden bg-[#ededee]">
          <div className="h-full min-h-0 p-3 sm:p-4 lg:p-6">
            <div className="mx-auto h-full min-h-0 w-full overflow-hidden">
              <PreviewCanvas
                document={editorDocument}
                viewport={state.viewport}
                selection={state.selection}
                commerce={commerce}
                onSelect={handleSelection}
              />
            </div>
          </div>
        </main>

        {/* Settings */}
        <div
          className={clsx(
            "min-h-0 overflow-y-auto border-l border-[#e3e3e3] bg-white",
            "[&_.theme-editor-sidebar]:h-full",
            "[&_.theme-editor-sidebar]:w-full",
            "[&_.theme-editor-sidebar]:border-0",
            "[&_.theme-editor-sidebar]:bg-transparent",

            "lg:relative lg:z-auto lg:block",

            mobilePanel === "settings"
              ? "absolute inset-y-0 right-0 z-30 block w-[min(340px,90vw)] shadow-xl"
              : "hidden lg:block"
          )}
        >
          {inspector}
        </div>
      </div>
    </div>
  );
}
