"use client";

import { type CSSProperties } from "react";
import clsx from "clsx";
import { ColorPaletteProvider } from "@/features/store-editor/components/inspector/color-palette-context";
import { EditorPanelNavigation } from "@/features/store-editor/components/editor-panel-navigation";
import { EditorPreviewPane } from "./editor-preview-pane";
import { EditorInspectorPanel } from "./editor-inspector-panel";
import { EditorTopBar } from "./editor-top-bar";
import { EditorSidebar } from "./editor-sidebar";
import type { EditorViewContext } from "../../hooks/use-editor-controller";

/** The full-screen editor layout. */
export function EditorWorkspaceView({ ctx }: { ctx: EditorViewContext }) {
  const { selection, activeGlobalId, mobilePanel, setMobilePanel, desktopSidebarOpen, libraryRegion, blockPickerSectionId, isConverting, isPublishing, selectedGlobal, colorPalette } = ctx;
  return (
    <div
      data-testid="theme-editor-shell"
      style={{ "--paper": "var(--card)", "--paper-deep": "var(--background)", "--ink": "var(--foreground)", "--ink-soft": "var(--muted-foreground)", "--line": "var(--border)", "--white": "var(--card)" } as CSSProperties}
      className="admin-store-editor fixed inset-0 z-[60] flex h-dvh flex-col overflow-hidden bg-[var(--paper-deep)] text-[var(--ink)]"
    >
      <EditorTopBar ctx={ctx} />


      <EditorPanelNavigation value={mobilePanel} onChange={setMobilePanel} editPanel={selection || activeGlobalId || libraryRegion || blockPickerSectionId ? "settings" : "sections"} />

      <div
        className={clsx(
          "grid min-h-0 flex-1 grid-cols-1 grid-rows-1 gap-1 bg-muted/50 p-1",
          desktopSidebarOpen
              ? "lg:grid-cols-[300px_minmax(0,1fr)] lg:grid-rows-1"
            : "lg:grid-cols-[minmax(0,1fr)] lg:grid-rows-1",
        )}
        inert={isConverting || isPublishing}
        aria-busy={isConverting || isPublishing}
      >
        <EditorSidebar ctx={ctx} />

        <EditorPreviewPane ctx={ctx} />

        <aside
          className={clsx(
            "min-h-0 overflow-y-auto rounded-xl border border-border bg-card",
            mobilePanel !== "settings" && "hidden",
            desktopSidebarOpen
              ? "lg:col-start-1 lg:row-start-1 lg:border-r lg:border-[var(--line)]"
              : "lg:hidden",
          )}
          aria-label="Section settings"
        >
          {selectedGlobal && <p className="mx-3 mt-3 rounded-lg bg-muted p-3 text-xs text-muted-foreground">This shared section appears on other templates. Changes apply everywhere it is used.</p>}
          <ColorPaletteProvider value={colorPalette}><EditorInspectorPanel ctx={ctx} /></ColorPaletteProvider>
        </aside>
      </div>
    </div>
  );
}
