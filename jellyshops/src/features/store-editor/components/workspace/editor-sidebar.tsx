"use client";

import clsx from "clsx";
import { blockLabel } from "@jelly/storefront-registry";
import { TemplateHierarchy } from "@/features/store-editor/components/template-hierarchy";
import { displayName } from "@/features/store-editor/editor-page-helpers";
import { SelectionToolbar } from "@/features/store-editor/components/selection-toolbar";
import { availableActions, blockDropLists, siblingIdsFor } from "@/features/store-editor/selection-actions";
import { reorderPlacement } from "@/features/store-editor/template-layout";
import type { EditorViewContext } from "../../hooks/use-editor-controller";

/** The page structure on the left: the floating-toolbar anchor and the section tree. */
export function EditorSidebar({ ctx }: { ctx: EditorViewContext }) {
  const { selection, setSelection, activeGlobalId, setActiveGlobalId, mobilePanel, setMobilePanel, desktopSidebarOpen, setLibraryRegion, setBlockPickerSectionId, setBlockPickerParentId, activeTemplate, validGlobals, globalLabels, persistLayout, moveSelectedPlacement, toggleSection, toolbarTarget, toolbarFound, runSelectionAction, runActionOn, runMove, runMoveTo } = ctx;
  return (
        <section
          className={clsx(
            "min-h-0 overflow-hidden rounded-xl border border-border bg-card",
            mobilePanel !== "sections" && "hidden",
            desktopSidebarOpen
              ? "lg:col-start-1 lg:row-start-1 lg:border-r lg:border-b-0"
              : "lg:hidden",
          )}
          aria-label="Page structure"
        >
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto">
              {toolbarTarget && toolbarFound && activeTemplate && (
                <SelectionToolbar
                  target={toolbarTarget}
                  label={toolbarFound.block ? blockLabel(toolbarFound.block.type) : ctx.selectedElement ? ctx.selectedElement.label : displayName(toolbarFound.section.type, ctx.themeConfiguration?.themeVersion)}
                  element={ctx.selectedElement && selection?.kind === "section" ? { id: ctx.selectedElement.id, index: selection.elementIndex } : undefined}
                  onSelectParent={() => { if (selection?.kind === "section") setSelection({ kind: "section", region: selection.region, sectionId: selection.sectionId }); }}
                  hidden={toolbarFound.block ? !toolbarFound.block.enabled : !toolbarFound.section.enabled}
                  actions={availableActions(activeTemplate.layout, toolbarTarget)}
                  onAction={(action) => { void runSelectionAction(action); }}
                  siblingIds={siblingIdsFor(activeTemplate.layout, toolbarTarget)}
                  onMove={(beforeId) => { void runMove(beforeId); }}
                  dropLists={toolbarTarget.blockId ? blockDropLists(activeTemplate.layout, toolbarTarget) : undefined}
                  onMoveTo={(parentId, beforeId) => { void runMoveTo(parentId, beforeId); }}
                />
              )}
              <TemplateHierarchy
                template={activeTemplate}
                themeVersion={ctx.themeConfiguration?.themeVersion}
                globalSections={globalLabels}
                selection={selection}
                activeGlobalId={activeGlobalId}
                onSelect={(next) => {
                  setSelection(next);
                  const owningGlobal = next && next.kind !== "theme" ? validGlobals.find((global) => global.section.id === next.sectionId) : undefined;
                  setActiveGlobalId(owningGlobal?.id);
                  setMobilePanel("settings");
                }}
                onGlobalSelect={(globalId) => {
                  setActiveGlobalId(globalId);
                  setSelection(null);
                  setMobilePanel("settings");
                }}
                onAddSection={(region) => {
                  setLibraryRegion(region);
                  setBlockPickerSectionId(undefined);
                  setMobilePanel("settings");
                }}
                onAddBlock={(sectionId, parentId) => {
                  setBlockPickerSectionId(sectionId);
                  setBlockPickerParentId(parentId);
                  setLibraryRegion(undefined);
                  setMobilePanel("settings");
                }}
                onMove={(id, direction) => { void moveSelectedPlacement(id, direction); }}
                onReorder={(from, to) => { void persistLayout(reorderPlacement(activeTemplate.layout, from, to)); }}
                onToggle={(id, enabled) => { void toggleSection(id, enabled); }}
                onRemove={(id) => { if (window.confirm("Delete this section? You can undo this with Ctrl+Z.")) void runActionOn({ sectionId: id }, "remove"); }}
                onBlockAction={(sectionId, blockId, action) => { void runActionOn({ sectionId, blockId }, action); }}
              />
            </div>
          </div>
        </section>
  );
}
