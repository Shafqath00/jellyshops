"use client";

import { ChevronLeft, LayoutPanelTop, Plus, Trash2 } from "lucide-react";
import { blockLabel } from "@jelly/storefront-registry";
import { GlobalSectionPanel } from "@/features/store-editor/components/global-section-panel";
import { SettingGroups } from "@/features/store-editor/components/inspector/setting-groups";
import { RichTextDocumentEditor } from "@/features/store-editor/components/inspector/rich-text-document-editor";
import { ThemeSettingsPanel } from "@/features/store-editor/components/inspector/theme-settings-panel";
import { ThemeLibraryPanel } from "@/features/store-editor/components/theme-library-panel";
import { PublishDiagnostics } from "@/features/store-editor/components/publish-diagnostics";
import { SectionLibrary } from "@/features/store-editor/components/section-library";
import { displayName } from "@/features/store-editor/editor-page-helpers";
import { mobileKeys } from "@/features/store-editor/mobile-settings";
import { MobileEditingNote } from "@/features/store-editor/components/mobile-editing-note";
import type { EditorViewContext } from "../../hooks/use-editor-controller";

/** The settings panel on the side: theme settings and saved looks, the section library, the block picker, section and block settings and shared sections. */
export function EditorInspectorPanel({ ctx }: { ctx: EditorViewContext }) {
  const { backendStoreId, api, looks, looksError, looksBusy, dynamicSources, catalog, themeCatalog, themeConfiguration, selection, setSelection, activeGlobalId, setMobilePanel, diagnostics, libraryRegion, setLibraryRegion, blockPickerSectionId, setBlockPickerSectionId, blockPickerParentId, setBlockPickerParentId, activeTemplate, presetOptions, globalOptions, selectedGlobal, localSection, selectedLocation, selectedBlock, selectedChildOptions, sectionDefinition, baseControls, responsiveView, selectedControls, selectedSettings, builtInSections, blockPickerSection, blockPickerDefinition, blockPickerTypes, selectedTheme, persistThemeSetting, saveThemeLook, renameThemeLook, deleteThemeLook, insertPreset, saveToLibrary, deletePreset, insertBuiltIn, addBlock, removeSelectedSection, insertGlobal, makeGlobal, detachGlobal, updateSelectedSetting, updateSelectedSettings, saveRichTextDocument, openDiagnostic } = ctx;
  return (
    <>
      {selection?.kind === "theme" && (
        <>
        <ThemeLibraryPanel
          looks={looks}
          currentThemeName={selectedTheme?.name ?? "Current theme"}
          themeName={(themeId) => themeCatalog.find((theme) => theme.id === themeId)?.name ?? themeId}
          busy={looksBusy}
          error={looksError}
          onSave={(name) => { void saveThemeLook(name); }}
          onApply={(look) => { void persistThemeSetting("", undefined, false, look); }}
          onRename={(look, name) => { void renameThemeLook(look, name); }}
          onDelete={(look) => { void deleteThemeLook(look); }}
        />
        <ThemeSettingsPanel
          schema={selectedTheme?.settingsSchema ?? []}
          settings={themeConfiguration?.settings ?? {}}
          saving={false}
          upload={(file, onProgress) => api.uploadMedia(backendStoreId, file, onProgress)}
          onChange={(path, value) => { void persistThemeSetting(path, value); }}
        />
        </>
      )}

      {diagnostics.length > 0 && (
        <div className="border-b border-[var(--line)] p-3">
          <PublishDiagnostics diagnostics={diagnostics} onOpen={openDiagnostic} />
        </div>
      )}

      {libraryRegion && (
        <>
          <div className="flex h-14 items-center gap-2 border-b border-[var(--line)] px-3">
            <button
              type="button"
              aria-label="Back to sections"
              onClick={() => { setLibraryRegion(undefined); setMobilePanel("sections"); }}
              className="grid size-8 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <p className="text-[12px] text-[var(--ink-soft)]">{displayName(libraryRegion)}</p>
              <h2 className="text-[13px] font-semibold">Add section</h2>
            </div>
          </div>
          <SectionLibrary
            presets={presetOptions}
            builtIns={builtInSections}
            onInsertPreset={(section) => { void insertPreset(section); setLibraryRegion(undefined); }}
            onInsertBuiltIn={(sectionType) => { void insertBuiltIn(sectionType); }}
            onDeletePreset={(presetId) => { void deletePreset(presetId); }}
          />
        </>
      )}

      {blockPickerSection && blockPickerDefinition && !libraryRegion && (
        <>
          <div className="flex h-14 items-center gap-2 border-b border-[var(--line)] px-3">
            <button
              type="button"
              aria-label="Back to section settings"
              onClick={() => { setBlockPickerSectionId(undefined); setBlockPickerParentId(undefined); setMobilePanel("settings"); }}
              className="grid size-8 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <p className="text-[12px] text-[var(--ink-soft)]">{displayName(blockPickerSection.type, ctx.themeConfiguration?.themeVersion)}</p>
              <h2 className="text-[13px] font-semibold">{blockPickerParentId ? "Add block to group" : "Add content block"}</h2>
            </div>
          </div>
          <div className="space-y-1 p-3">
            {blockPickerTypes.map((blockType) => (
              <button
                key={blockType}
                type="button"
                onClick={() => { void addBlock(blockType); }}
                className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium hover:bg-[var(--paper)]"
              >
                <span className="grid size-8 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)]">
                  <Plus size={15} />
                </span>
                {blockLabel(blockType)}
              </button>
            ))}
            {blockPickerTypes.length === 0 && (
              <p className="py-8 text-center text-[12px] text-[var(--ink-soft)]">This section does not support content blocks.</p>
            )}
          </div>
        </>
      )}

      {localSection && !libraryRegion && !blockPickerSectionId && (
        <>
          <div className="sticky top-0 z-10 flex min-h-12 items-center justify-between gap-3 border-b border-[var(--line)] bg-card px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                aria-label={selectedLocation?.parent ? "Back to group" : selectedBlock ? "Back to section settings" : "Back to sections"}
                onClick={() => {
                  const region = selection && selection.kind !== "theme" ? selection.region : "template";
                  setSelection(selectedLocation?.parent
                    ? { kind: "block", region, sectionId: localSection.id, blockId: selectedLocation.parent.id }
                    : selectedBlock ? { kind: "section", region, sectionId: localSection.id } : null);
                  if (!selectedBlock) setMobilePanel("sections");
                }}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--paper)]"
              >
                <ChevronLeft size={16} />
              </button>
              <LayoutPanelTop size={16} className="text-[var(--ink-soft)]" />
              <div className="min-w-0">
                <p className="text-[12px] text-[var(--ink-soft)]">
                  {selectedBlock && localSection.type !== "rich-text" ? displayName(localSection.type, ctx.themeConfiguration?.themeVersion) : "Section settings"}
                </p>
                <p className="truncate text-[13px] font-semibold">
                  {localSection.type === "rich-text" || !selectedBlock ? displayName(localSection.type, ctx.themeConfiguration?.themeVersion) : blockLabel(selectedBlock.type)}
                </p>
              </div>
            </div>
            {!selectedBlock && !selectedGlobal && (
              <button
                type="button"
                aria-label="Remove section"
                onClick={() => { void removeSelectedSection(); }}
                className="grid size-8 place-items-center rounded-lg text-[var(--destructive)] hover:bg-[var(--paper-deep)]"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>

          <div className="border-b border-[var(--line)] px-4 py-4">
            {responsiveView !== "desktop" && localSection.type !== "rich-text" && <MobileEditingNote device={responsiveView} phoneSettings={mobileKeys(baseControls).size} />}
            {localSection.type === "rich-text" ? (
              <RichTextDocumentEditor
                key={`${activeTemplate.id}:${localSection.id}`}
                section={localSection}
                onSave={saveRichTextDocument}
              />
            ) : selectedControls.length > 0 ? (
              <SettingGroups
                controls={selectedControls}
                settings={selectedSettings}
                catalog={catalog}
                upload={(file, onProgress) => api.uploadMedia(backendStoreId, file, onProgress)}
                dynamicSources={dynamicSources}
                onChange={(key, nextValue) => { void updateSelectedSetting(key, nextValue); }}
                onPatch={(patch) => { void updateSelectedSettings(patch); }}
              />
            ) : (
              <p className="py-8 text-center text-[12px] text-[var(--ink-soft)]">This item has no additional settings.</p>
            )}
          </div>

          {!selectedBlock && localSection.blocks.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Content blocks</p>
              {localSection.blocks.map((block) => <button key={block.id} type="button" onClick={() => setSelection({ kind: "block", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, blockId: block.id })} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs hover:bg-muted">{blockLabel(block.type)}</button>)}
            </div>
          )}
          {selectedBlock && !selectedGlobal && selectedChildOptions.types.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              {(selectedBlock.blocks ?? []).length > 0 && <p className="mb-2 text-xs font-semibold text-muted-foreground">Blocks in this group</p>}
              {(selectedBlock.blocks ?? []).map((block) => <button key={block.id} type="button" onClick={() => setSelection({ kind: "block", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, blockId: block.id })} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs hover:bg-muted">{blockLabel(block.type)}{block.enabled ? "" : " (hidden)"}</button>)}
              <button
                type="button"
                disabled={selectedChildOptions.full}
                onClick={() => { setBlockPickerParentId(selectedBlock.id); setBlockPickerSectionId(localSection.id); }}
                className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--paper-deep)] disabled:opacity-50"
              >
                <Plus size={15} /> {selectedChildOptions.full ? "This group is full" : "Add block to group"}
              </button>
            </div>
          )}
          {!selectedBlock && !selectedGlobal && localSection.type !== "rich-text" && sectionDefinition && sectionDefinition.allowedBlockTypes.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <button
                type="button"
                onClick={() => { setBlockPickerParentId(undefined); setBlockPickerSectionId(localSection.id); }}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 text-[12px] font-semibold text-[var(--ink)] hover:bg-[var(--paper-deep)]"
              >
                <Plus size={15} /> Add content block
              </button>
            </div>
          )}
        </>
      )}

      {!localSection && selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && (
        <div className="px-6 py-12 text-center">
          <LayoutPanelTop className="mx-auto text-[var(--ink-soft)]" size={28} />
          <p className="mt-3 text-[13px] font-semibold">Select a section to edit</p>
          <p className="mt-1 text-[13px] leading-5 text-[var(--ink-soft)]">Choose a section or content block from the page structure, or add a new section.</p>
        </div>
      )}

      {selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && (
        <>
          <details className="border-t border-border">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium">Shared and saved sections</summary>
          <GlobalSectionPanel
            globalSections={globalOptions}
            localSection={selectedGlobal ? undefined : localSection ?? undefined}
            attachedGlobalId={activeGlobalId}
            onMakeGlobal={(section) => { void makeGlobal(section); }}
            onInsertGlobal={(globalId) => { void insertGlobal(globalId); }}
            onDetachGlobal={(section) => { void detachGlobal(section); }}
            onSaveToLibrary={(section, name) => { void saveToLibrary(section, name); }}
            suggestedName={localSection ? displayName(localSection.type, ctx.themeConfiguration?.themeVersion) : undefined}
          />
          </details>
        </>
      )}
    </>
  );
}
