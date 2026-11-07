"use client";

import type { CompilationDiagnosticLocation, BlockNode, SectionNode, RichTextDocument } from "@jelly/storefront-schema";
import { copyBlockWithNewIds, updateBlock } from "@jelly/storefront-schema";
import { displayName } from "@/features/store-editor/editor-page-helpers";
import { applySelectionAction, findTarget, moveBefore, moveBlockTo, type SelectionAction, type SelectionTarget } from "@/features/store-editor/selection-actions";
import { useEditorShortcuts } from "@/features/store-editor/use-editor-shortcuts";
import { addBlockTo, createBlock } from "@/features/store-editor/block-editing";
import { applySettingsPatch, type SettingsNode } from "@/features/store-editor/mobile-settings";
import { applyLanguagePatch } from "@/features/store-editor/translation-settings";
import { createLibrarySection } from "@/features/store-editor/section-options";
import { appendBlock, appendGlobalPlacement, appendInlineSection, detachGlobalPlacement, movePlacement, removeInlineSection, replaceInlineWithGlobal, setInlineSectionEnabled, updateInlineSection } from "@/features/store-editor/template-layout";
import type { useEditorState } from "./use-editor-state";
import type { useEditorDerived } from "./use-editor-derived";
import type { useEditorPersistence } from "./use-editor-persistence";
import type { useThemeLooks } from "./use-theme-looks";

/** Editing actions: adding, moving, hiding and deleting sections and blocks, shared sections, settings changes and keyboard shortcuts. */
export function useEditorActions(ctx: ReturnType<typeof useEditorState> & ReturnType<typeof useEditorDerived> & ReturnType<typeof useEditorPersistence> & ReturnType<typeof useThemeLooks>) {
  const { backendStoreId, api, setWorkspace, templates, templateDrafts, setTemplates, setGlobals, setPresets, setActiveTemplateId, selection, setSelection, activeGlobalId, setActiveGlobalId, setMobilePanel, setDesktopSidebarOpen, invalidatePreview, libraryRegion, setLibraryRegion, setBlockPickerSectionId, blockPickerParentId, setBlockPickerParentId, setSaveState, setSaveError, setIsConverting, convertingRef, saveQueueRef, activeTemplate, selectedGlobal, localSection, baseControls, responsiveView, activeLanguage, blockPickerSection, persistLayout, persistGlobalSection, playHistory } = ctx;
  // A saved section is added as its own copy, with new ids each time.
  const insertPreset = async (section: SectionNode) => {
    if (!activeTemplate) return;
    const createId = () => crypto.randomUUID();
    const copy = { ...structuredClone(section), id: createId(), blocks: section.blocks.map((block) => copyBlockWithNewIds(block, createId)) };
    if (!await persistLayout(appendInlineSection(activeTemplate.layout, copy))) return;
    setSelection({ kind: "section", region: "template", sectionId: copy.id });
  };

  const saveToLibrary = async (section: SectionNode, name: string) => {
    if (!api) return;
    try {
      const created = await api.createPreset(backendStoreId, { name, section: structuredClone(section) as unknown as Record<string, unknown> });
      setPresets((current) => [...current, created.preset]);
      setWorkspace((current) => current ? { ...current, generation: created.generation } : current);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not save this section. Try again.");
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!api) return;
    try {
      const result = await api.deletePreset(backendStoreId, presetId);
      setPresets((current) => current.filter((preset) => preset.id !== presetId));
      setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not remove the saved section. Try again.");
    }
  };

  const insertBuiltIn = async (sectionType: string) => {
    if (!activeTemplate || !libraryRegion) return;
    // A designed preset ("Collection list: Bento") brings its own settings and blocks; a plain section its defaults.
    const section = createLibrarySection(sectionType, () => crypto.randomUUID(), ctx.themeConfiguration?.themeVersion);
    await persistLayout(appendInlineSection(activeTemplate.layout, section));
    setSelection({ kind: "section", region: libraryRegion, sectionId: section.id });
    setLibraryRegion(undefined);
  };

  const addBlock = async (blockType: string) => {
    if (!activeTemplate || !blockPickerSection) return;
    const block: BlockNode | null = createBlock(blockType);
    if (!block) return;
    const layout = blockPickerParentId
      ? updateInlineSection(activeTemplate.layout, blockPickerSection.id, (current) => addBlockTo(current, blockPickerParentId, block))
      : appendBlock(activeTemplate.layout, blockPickerSection.id, block);
    if (!await persistLayout(layout)) return;
    setSelection({ kind: "block", region: "template", sectionId: blockPickerSection.id, blockId: block.id });
    setBlockPickerSectionId(undefined);
    setBlockPickerParentId(undefined);
  };

  const removeSelectedSection = async () => {
    if (!activeTemplate || !localSection) return;
    void persistLayout(removeInlineSection(activeTemplate.layout, localSection.id));
    setSelection(null);
    setMobilePanel("sections");
  };

  const moveSelectedPlacement = async (id: string, direction: "up" | "down") => {
    if (!activeTemplate) return;
    await persistLayout(movePlacement(activeTemplate.layout, id, direction));
  };

  const toggleSection = async (id: string, enabled: boolean) => {
    if (!activeTemplate) return;
    await persistLayout(setInlineSectionEnabled(activeTemplate.layout, id, enabled));
  };

  const insertGlobal = async (globalSectionId: string) => {
    if (!activeTemplate) return;
    if (!await persistLayout(appendGlobalPlacement(activeTemplate.layout, globalSectionId))) return;
    setActiveGlobalId(globalSectionId);
    setSelection(null);
  };

  const makeGlobal = async (section: SectionNode) => {
    if (!api || !activeTemplate) return;
    if (convertingRef.current) return;
    convertingRef.current = true;
    setIsConverting(true);
    try {
    if (!await saveQueueRef.current?.flush()) return;
    setSaveState("saving");
    const created = await api.createGlobalSection(backendStoreId, {
      name: `Shared ${displayName(section.type).toLowerCase()}`,
      section: structuredClone(section) as unknown as Record<string, unknown>,
    });
    if (!created.globalSection?.id) return;
    setGlobals((current) => [...current, created.globalSection]);
    setWorkspace((current) => current ? { ...current, generation: created.generation } : current);
    const result = await api.updateTemplate(
      backendStoreId,
      activeTemplate.id,
      templateDrafts.current.find((template) => template.id === activeTemplate.id)?.revision ?? activeTemplate.revision,
      { layout: replaceInlineWithGlobal(templateDrafts.current.find((template) => template.id === activeTemplate.id)?.layout ?? activeTemplate.layout, section.id, created.globalSection.id) },
    );
    setTemplates((current) => current.map((template) => template.id === result.template.id ? result.template : template));
    setWorkspace((current) => current ? { ...current, generation: result.generation } : current);
    invalidatePreview();
    setSelection(null);
    setActiveGlobalId(created.globalSection.id);
    setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not create a shared section. Try again.");
    } finally {
      convertingRef.current = false;
      setIsConverting(false);
    }
  };

  const detachGlobal = async (section: SectionNode) => {
    if (!activeTemplate || !activeGlobalId) return;
    if (!await persistLayout(detachGlobalPlacement(activeTemplate.layout, activeGlobalId, section))) return;
    setActiveGlobalId(undefined);
    setSelection({ kind: "section", region: "template", sectionId: section.id });
  };

  const updateSelectedSetting = (key: string, value: unknown) => updateSelectedSettings({ [key]: value });
  // Several settings in one save (rich text keeps its plain text and formatted copy together).
  const updateSelectedSettings = async (patch: Record<string, unknown>) => {
    if (convertingRef.current) return;
    if (!activeTemplate || !localSection || selection?.kind === "theme") return;
    const applyPatch = <T extends SettingsNode>(node: T): T => applyLanguagePatch(node, patch, baseControls, activeLanguage) ?? applySettingsPatch(node, patch, baseControls, responsiveView);
    if (selectedGlobal) {
      await persistGlobalSection(selection?.kind === "block"
        ? { ...localSection, blocks: updateBlock(localSection.blocks, selection.blockId, applyPatch) }
        : applyPatch(localSection));
      return;
    }
    if (!selection) return;
    const layout = updateInlineSection(activeTemplate.layout, localSection.id, (current) => {
      if (selection.kind === "block") return { ...current, blocks: updateBlock(current.blocks, selection.blockId, applyPatch) };
      return applyPatch(current);
    });
    await persistLayout(layout);
  };

  const saveRichTextDocument = async (document: RichTextDocument) => {
    if (convertingRef.current) throw new Error("Wait for the shared section update to finish.");
    if (!activeTemplate || !localSection || localSection.type !== "rich-text") throw new Error("Select a rich text section first.");
    if (selectedGlobal) {
      if (!await persistGlobalSection({ ...localSection, settings: { ...localSection.settings, document } })) throw new Error("Your shared text could not be saved. Try again.");
      return;
    }
    const layout = updateInlineSection(activeTemplate.layout, localSection.id, (current) => ({
      ...current,
      settings: { ...current.settings, document },
    }));
    if (!await persistLayout(layout)) throw new Error("Rich text could not be saved. Please try again.");
  };

  const openDiagnostic = (location: CompilationDiagnosticLocation) => {
    setDesktopSidebarOpen(true);
    setMobilePanel("settings");
    if (location.entityType === "template" && location.entityId && templates.some((template) => template.id === location.entityId)) {
      setActiveTemplateId(location.entityId);
      setActiveGlobalId(undefined);
    }
    if (location.entityType === "global_section" && location.entityId) {
      setActiveGlobalId(location.entityId);
      setSelection(null);
      return;
    }
    if (location.sectionId) {
      setActiveGlobalId(undefined);
      setSelection(location.blockId
        ? { kind: "block", region: "template", sectionId: location.sectionId, blockId: location.blockId, fieldKey: location.fieldKey }
        : { kind: "section", region: "template", sectionId: location.sectionId });
    }
  };

  // Floating toolbar and shortcuts act on the selected section or block of this template (not shared sections).
  const toolbarTarget: SelectionTarget | null = activeTemplate && !selectedGlobal && selection && selection.kind !== "theme"
    ? { sectionId: selection.sectionId, ...(selection.kind === "block" ? { blockId: selection.blockId } : {}) }
    : null;
  const toolbarFound = toolbarTarget && activeTemplate ? findTarget(activeTemplate.layout, toolbarTarget) : null;
  const selectedElementId = selection && selection.kind !== "theme" ? selection.elementId : undefined;
  const runSelectionAction = async (action: SelectionAction) => {
    if (!activeTemplate || !toolbarTarget || !toolbarFound) return;
    const result = applySelectionAction(activeTemplate.layout, toolbarTarget, action);
    if (!result || !await persistLayout(result.layout)) return;
    const region = selection && selection.kind !== "theme" ? selection.region : "template";
    setSelection(result.select ? (result.select.blockId ? { kind: "block", region, sectionId: result.select.sectionId, blockId: result.select.blockId } : { kind: "section", region, sectionId: result.select.sectionId }) : null);
    if (!result.select) setMobilePanel("sections");
  };
  // The same actions from the page tree's hover buttons (hide/show or delete a section or block); the selection stays unless it was deleted.
  const runActionOn = async (target: SelectionTarget, action: "toggle" | "remove") => {
    if (!activeTemplate) return;
    const result = applySelectionAction(activeTemplate.layout, target, action);
    if (!result || !await persistLayout(result.layout)) return;
    const removedSelected = action === "remove" && selection && selection.kind !== "theme" && selection.sectionId === target.sectionId && (!target.blockId || (selection.kind === "block" && selection.blockId === target.blockId));
    if (removedSelected) {
      const region = selection.region ?? "template";
      setSelection(result.select ? (result.select.blockId ? { kind: "block", region, sectionId: result.select.sectionId, blockId: result.select.blockId } : { kind: "section", region, sectionId: result.select.sectionId }) : null);
    }
  };
  // Dragging the toolbar's grip over the preview drops the selection before a sibling (or at the end).
  const runMove = async (beforeId: string | null) => {
    if (!activeTemplate || !toolbarTarget || !toolbarFound) return;
    const result = moveBefore(activeTemplate.layout, toolbarTarget, beforeId);
    if (result) await persistLayout(result.layout);
  };
  // A block dragged into another list (into or out of a group).
  const runMoveTo = async (parentId: string | null, beforeId: string | null) => {
    if (!activeTemplate || !toolbarTarget || !toolbarFound) return;
    const result = moveBlockTo(activeTemplate.layout, toolbarTarget, parentId, beforeId);
    if (result) await persistLayout(result.layout);
  };
  useEditorShortcuts({
    undo: () => { void playHistory("undo"); },
    redo: () => { void playHistory("redo"); },
    save: () => { void saveQueueRef.current?.flush(); },
    // With a section element selected, Delete/Duplicate would hit the whole section, so they are off; Escape goes up to the section.
    remove: toolbarFound && !selectedElementId ? () => { void runSelectionAction("remove"); } : undefined,
    duplicate: toolbarFound && !selectedElementId ? () => { void runSelectionAction("duplicate"); } : undefined,
    deselect: selection ? () => setSelection(selection.kind === "section" && selection.elementId ? { kind: "section", region: selection.region, sectionId: selection.sectionId }
      : selection.kind === "block" && selection.elementId ? { kind: "block", region: selection.region, sectionId: selection.sectionId, blockId: selection.blockId } : null) : undefined,
  });
  return { insertPreset, saveToLibrary, deletePreset, insertBuiltIn, addBlock, removeSelectedSection, moveSelectedPlacement, toggleSection, insertGlobal, makeGlobal, detachGlobal, updateSelectedSetting, updateSelectedSettings, saveRichTextDocument, openDiagnostic, toolbarTarget, toolbarFound, runSelectionAction, runActionOn, runMove, runMoveTo };
}
