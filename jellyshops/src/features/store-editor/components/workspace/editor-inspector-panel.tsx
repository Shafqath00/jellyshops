"use client";

import { ChevronLeft, LayoutPanelTop, MousePointerClick, Plus, Trash2 } from "lucide-react";
import { blockLabel, getBlockDefinition } from "@jelly/storefront-registry";
import { GlobalSectionPanel } from "@/features/store-editor/components/global-section-panel";
import { SettingGroups } from "@/features/store-editor/components/inspector/setting-groups";
import { RichTextDocumentEditor } from "@/features/store-editor/components/inspector/rich-text-document-editor";
import { ThemeSettingsPanel } from "@/features/store-editor/components/inspector/theme-settings-panel";
import { ThemeLibraryPanel } from "@/features/store-editor/components/theme-library-panel";
import { ThemeStylesPanel } from "@/features/store-editor/components/theme-styles-panel";
import { applyThemeStyle, listThemeStyles, resolveTheme } from "@jelly/storefront-themes";
import { PublishDiagnostics } from "@/features/store-editor/components/publish-diagnostics";
import { SectionLibrary } from "@/features/store-editor/components/section-library";
import { blockIcon } from "@/features/store-editor/components/outline-parts";
import { displayName } from "@/features/store-editor/editor-page-helpers";
import { mobileKeys } from "@/features/store-editor/mobile-settings";
import { MobileEditingNote } from "@/features/store-editor/components/mobile-editing-note";
import type { EditorViewContext } from "../../hooks/use-editor-controller";
import { ResetDesignButton } from "@/features/store-editor/components/inspector/reset-design-button";

/** Add block choices grouped by kind (product blocks first), in their own order inside each group. */
export function blockPickerGroups(types: string[]): Array<[string, string[]]> {
  const groupOf = (type: string) => {
    const sets = getBlockDefinition(type)?.sets ?? [];
    return sets.includes("@product") ? "Product" : sets.includes("@app") ? "Apps" : sets.includes("@content") ? "Content" : "Blocks";
  };
  const order = ["Product", "Blocks", "Content", "Apps"];
  const groups = new Map<string, string[]>();
  for (const type of types) groups.set(groupOf(type), [...(groups.get(groupOf(type)) ?? []), type]);
  return [...groups.entries()].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b));
}

/** The settings panel on the side: theme settings and saved looks, the section library, the block picker, section and block settings and shared sections. */
export function EditorInspectorPanel({ ctx }: { ctx: EditorViewContext }) {
  const { backendStoreId, api, looks, looksError, looksBusy, dynamicSources, catalog, themeCatalog, themeConfiguration, selection, setSelection, activeGlobalId, setMobilePanel, diagnostics, libraryRegion, setLibraryRegion, blockPickerSectionId, setBlockPickerSectionId, blockPickerParentId, setBlockPickerParentId, activeTemplate, presetOptions, globalOptions, selectedGlobal, localSection, selectedLocation, selectedBlock, selectedElement, selectedChildOptions, sectionDefinition, baseControls, responsiveView, selectedControls, selectedSettings, builtInSections, blockPickerSection, blockPickerDefinition, blockPickerTypes, selectedTheme, persistThemeSetting, saveThemeLook, renameThemeLook, deleteThemeLook, insertPreset, saveToLibrary, deletePreset, insertBuiltIn, addBlock, removeSelectedSection, insertGlobal, makeGlobal, detachGlobal, updateSelectedSetting, updateSelectedSettings, resetSelectedDesign, saveRichTextDocument, openDiagnostic } = ctx;
  return (
    <>
      {selection?.kind === "theme" && (
        <>
        <ThemeStylesPanel
          styles={listThemeStyles(themeConfiguration?.themeId)}
          settings={themeConfiguration ? resolveTheme(themeConfiguration.themeId, themeConfiguration.settings, themeConfiguration.themeVersion).settings : {}}
          busy={looksBusy}
          onApply={(style) => { void persistThemeSetting("", applyThemeStyle(themeConfiguration?.settings ?? {}, style)); }}
        />
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
              onClick={() => { setLibraryRegion(undefined); ctx.setLibraryPreviewId(undefined); setMobilePanel("sections"); }}
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
            onPreview={ctx.setLibraryPreviewId}
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
            {blockPickerGroups(blockPickerTypes).map(([group, types], index, groups) => (
              <div key={group} className={index > 0 ? "pt-3" : undefined}>
                {groups.length > 1 && <h3 className="mb-1 px-3 text-[11px] font-semibold text-[var(--ink-soft)]">{group}</h3>}
                {types.map((blockType) => (
                  <button
                    key={blockType}
                    type="button"
                    onClick={() => { void addBlock(blockType); }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium hover:bg-[var(--paper)]"
                  >
                    <span className="grid size-8 place-items-center rounded-lg border border-[var(--line)] text-[var(--ink)]">
                      {(() => { const Glyph = blockIcon(blockType); return <Glyph size={15} aria-hidden="true" />; })()}
                    </span>
                    {blockLabel(blockType)}
                  </button>
                ))}
              </div>
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
                aria-label={selectedElement && selectedBlock ? "Back to block settings" : selectedLocation?.parent ? "Back to group" : selectedBlock || selectedElement ? "Back to section settings" : "Back to sections"}
                onClick={() => {
                  const region = selection && selection.kind !== "theme" ? selection.region : "template";
                  if (selectedElement) { setSelection(selectedBlock ? { kind: "block", region, sectionId: localSection.id, blockId: selectedBlock.id } : { kind: "section", region, sectionId: localSection.id }); return; }
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
                <nav aria-label="You are editing" className="flex min-w-0 items-center gap-1 text-[12px] text-[var(--ink-soft)]">
                  <span className="truncate">{activeTemplate.name}</span>
                  {(selectedBlock || selectedElement) && localSection.type !== "rich-text" && <><span aria-hidden="true">›</span><button type="button" className="truncate underline-offset-2 hover:text-[var(--ink)] hover:underline" onClick={() => setSelection({ kind: "section", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id })}>{displayName(localSection.type, ctx.themeConfiguration?.themeVersion)}</button></>}
                  {selectedElement && selectedBlock && <><span aria-hidden="true">›</span><button type="button" className="truncate underline-offset-2 hover:text-[var(--ink)] hover:underline" onClick={() => setSelection({ kind: "block", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, blockId: selectedBlock.id })}>{blockLabel(selectedBlock.type)}</button></>}
                </nav>
                <p className="truncate text-[13px] font-semibold">
                  {selectedElement ? selectedElement.label : localSection.type === "rich-text" || !selectedBlock ? displayName(localSection.type, ctx.themeConfiguration?.themeVersion) : blockLabel(selectedBlock.type)}
                </p>
              </div>
            </div>
          </div>

          <div className="border-b border-[var(--line)] px-4 py-4">
            {responsiveView !== "desktop" && localSection.type !== "rich-text" && <MobileEditingNote device={responsiveView} phoneSettings={mobileKeys(baseControls).size} />}
            {selectedElement?.kind === "product-card" && (
              <div className="mb-4 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3 text-[12px] text-[var(--ink-soft)]">
                <p>The card design (corners, shadow, badges, what each card shows) is the same in every product list.</p>
                <button type="button" onClick={() => setSelection({ kind: "theme" })} className="mt-2 font-semibold text-[var(--ink)] underline underline-offset-2">Edit product card design</button>
              </div>
            )}
            {localSection.type === "rich-text" && !selectedElement ? (
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

          {!selectedBlock && !selectedElement && selection?.kind === "section" && (
            <div className="border-b border-[var(--line)] p-3"><ResetDesignButton onReset={() => { void resetSelectedDesign(); }} /></div>
          )}
          {!selectedBlock && !selectedElement && (sectionDefinition?.elements ?? []).length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Parts of this section</p>
              {(sectionDefinition?.elements ?? []).map((element) => <button key={element.id} type="button" onClick={() => setSelection({ kind: "section", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, elementId: element.id })} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs hover:bg-muted">{element.label}</button>)}
            </div>
          )}
          {!selectedBlock && !selectedElement && localSection.blocks.length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Content blocks</p>
              {localSection.blocks.map((block) => <button key={block.id} type="button" onClick={() => setSelection({ kind: "block", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, blockId: block.id })} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs hover:bg-muted">{blockLabel(block.type)}</button>)}
            </div>
          )}
          {selectedBlock && !selectedElement && (getBlockDefinition(selectedBlock.type)?.elements ?? []).length > 0 && (
            <div className="border-b border-[var(--line)] p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Parts of this block</p>
              {(getBlockDefinition(selectedBlock.type)?.elements ?? []).map((element) => <button key={element.id} type="button" onClick={() => setSelection({ kind: "block", region: selection && selection.kind !== "theme" ? selection.region : "template", sectionId: localSection.id, blockId: selectedBlock.id, elementId: element.id })} className="flex min-h-9 w-full items-center rounded-lg px-2 text-left text-xs hover:bg-muted">{element.label}</button>)}
            </div>
          )}
          {selectedBlock && !selectedElement && !selectedGlobal && selectedChildOptions.types.length > 0 && (
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
          {!selectedBlock && !selectedElement && !selectedGlobal && (
            <div className="p-3">
              <button type="button" aria-label="Remove section" onClick={() => { void removeSelectedSection(); }} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-[var(--destructive)] hover:bg-[var(--paper-deep)]">
                <Trash2 size={15} aria-hidden="true" /> Remove section
              </button>
            </div>
          )}
        </>
      )}

      {!localSection && selection?.kind !== "theme" && !libraryRegion && !blockPickerSectionId && (
        <div className="px-6 py-12 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[var(--jk-tone-lime-bg)] text-[var(--jk-tone-lime-fg)]"><MousePointerClick size={24} aria-hidden="true" /></span>
          <p className="mt-4 text-[15px] font-semibold">Select a section to edit</p>
          <p className="mx-auto mt-1 max-w-[240px] text-[13px] leading-5 text-[var(--ink-soft)]">Click anything in the preview, or pick a section in the list on the left. Its settings open here.</p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <button type="button" onClick={() => { setLibraryRegion("template"); setMobilePanel("settings"); }} className="inline-flex h-9 items-center gap-2 rounded-full bg-[var(--jk-accent)] px-4 text-[13px] font-semibold text-[var(--jk-accent-text)]"><Plus size={15} aria-hidden="true" /> Add section</button>
            <button type="button" onClick={() => setSelection({ kind: "theme" })} className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium text-[var(--ink)] hover:bg-[var(--paper)]">Theme settings: colours and fonts</button>
          </div>
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
