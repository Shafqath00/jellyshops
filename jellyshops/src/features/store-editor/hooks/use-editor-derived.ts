"use client";

/* eslint-disable react-hooks/exhaustive-deps --
   State setters and refs reach this hook through `ctx`, so the linter cannot see that they never
   change. Effects list only the values that should re-run them. */

import { useEffect, useMemo, useRef } from "react";
import { getBlockDefinition, getSectionDefinition, listSectionDefinitionsForPage } from "@jelly/storefront-registry";
import { type CommerceDataProvider, type StorefrontPageContext } from "@jelly/storefront-renderer";
import type { ThemeId } from "@jelly/storefront-schema";
import { getThemeDefinition, validateThemeManifest, resolveStorefrontThemeTokens, resolveTheme, storeLanguages } from "@jelly/storefront-themes";
import { expandRawRuntimeLayout } from "@/features/storefront/resource-loader";
import { usePreviewBindingValues } from "@/features/store-editor/use-preview-binding-values";
import { isAssignableTemplateType } from "@/features/store-editor/template-names";
import type { GlobalSectionRecord } from "@/features/store-editor/api/types";
import { themePalette } from "@/features/store-editor/color-palette";
import { sectionCategoryLabels, displayName, normalizeSection, templateSections, draftPreviewLayout, selectedInlineSection } from "@/features/store-editor/editor-page-helpers";
import { editorSearchFor } from "@/features/store-editor/editor-navigation";
import { createEditorPreviewPageContext, editorPreviewResourceOptions } from "@/features/store-editor/preview-context";
import { catalogProductToProduct } from "@/features/storefront/product-presentation";
import { fetchPublicMetaobjects } from "@/features/storefront/metaobjects-api";
import { childBlockOptions, locateBlock } from "@/features/store-editor/block-editing";
import { controlsForView, settingsForView } from "@/features/store-editor/mobile-settings";
import { controlsForLanguage, settingsForLanguage } from "@/features/store-editor/translation-settings";
import { withColorSchemeNames } from "@/features/store-editor/color-schemes";
import type { useEditorState } from "./use-editor-state";

/** Everything worked out from the loaded data: the active template, the selected section and block, its controls and the preview layout. */
export function useEditorDerived(ctx: ReturnType<typeof useEditorState>) {
  const { backendStoreId, token, api, handoff, templates, globals, presets, setDynamicSources, catalog, pages, blogs, articles, themeCatalog, themeConfiguration, activeTemplateId, previewResourceId, setPreviewResourceId, previewQuery, previewProduct, setPreviewProduct, previewCollection, setPreviewCollection, previewProductSelections, setPreviewProductSelections, previewProductQuantity, setPreviewProductQuantity, selection, setSelection, activeGlobalId, viewport, editLanguage, previewSnapshot, libraryRegion, blockPickerSectionId, blockPickerParentId } = ctx;
  const activeTemplate = templates.find((template) => template.id === activeTemplateId);
  const previewThemeStyle = useMemo(() => {
    const resolved = resolveTheme(themeConfiguration?.themeId, themeConfiguration?.settings ?? {}, themeConfiguration?.themeVersion);
    // Same token layer as the published storefront, so the preview matches the live store.
    return resolveStorefrontThemeTokens(resolved.id as ThemeId, resolved.settings, {}, resolved.version);
  }, [themeConfiguration]);

  useEffect(() => {
    if (!api || !activeTemplate) {
      setDynamicSources([]);
      return;
    }
    let active = true;
    setDynamicSources([]);
    void api.listDynamicSources(backendStoreId, activeTemplate.type)
      .then((sources) => { if (active) setDynamicSources(sources); })
      .catch(() => { if (active) setDynamicSources([]); });
    return () => { active = false; };
  }, [api, activeTemplate, backendStoreId]);

  useEffect(() => {
    if (!api || activeTemplate?.type !== "product" || !previewResourceId) {
      setPreviewProduct(null);
      setPreviewProductSelections([]);
      setPreviewProductQuantity(1);
      return;
    }
    let active = true;
    setPreviewProduct(null);
    setPreviewProductSelections([]);
    setPreviewProductQuantity(1);
    void api.getProduct(backendStoreId, previewResourceId)
      .then((detail) => { if (active && detail?.storeId === backendStoreId) setPreviewProduct(catalogProductToProduct(detail)); })
      .catch(() => { if (active) setPreviewProduct(null); });
    return () => { active = false; };
  }, [api, activeTemplate?.type, backendStoreId, previewResourceId]);

  useEffect(() => {
    if (!api || activeTemplate?.type !== "collection" || !previewResourceId) {
      setPreviewCollection(null);
      return;
    }
    let active = true;
    setPreviewCollection(null);
    void api.getCollection(backendStoreId, previewResourceId)
      .then((detail) => { if (active && detail?.storeId === backendStoreId) setPreviewCollection(detail); })
      .catch(() => { if (active) setPreviewCollection(null); });
    return () => { active = false; };
  }, [api, activeTemplate?.type, backendStoreId, previewResourceId]);

  const validGlobals = useMemo(
    () => globals.filter((global): global is GlobalSectionRecord => Boolean(global?.id)),
    [globals],
  );
  const globalMap = useMemo(() => new Map(validGlobals.map((global) => [global.id, global])), [validGlobals]);
  const sections = useMemo(
    () => activeTemplate ? templateSections(activeTemplate, globalMap) : [],
    [activeTemplate, globalMap],
  );
  // The selected section and block live in the address (?section=…&block=…), so a reload or a shared link opens the same place.
  const urlSelectionApplied = useRef(false);
  useEffect(() => {
    if (urlSelectionApplied.current || !activeTemplate) return;
    urlSelectionApplied.current = true;
    const section = handoff.sectionId ? sections.find((item) => item.id === handoff.sectionId) : undefined;
    if (!section) return;
    const hasBlock = handoff.blockId ? section.blocks.some((block) => block.id === handoff.blockId || block.blocks?.some((child) => child.id === handoff.blockId)) : false;
    setSelection(hasBlock && handoff.blockId ? { kind: "block", region: "template", sectionId: section.id, blockId: handoff.blockId } : { kind: "section", region: "template", sectionId: section.id });
  }, [activeTemplate, sections, handoff]);
  useEffect(() => {
    if (!urlSelectionApplied.current || !activeTemplateId || typeof window === "undefined") return;
    const inTemplate = selection && selection.kind !== "theme" && selection.region === "template" ? selection : null;
    const search = editorSearchFor(window.location.search, { templateId: activeTemplateId, sectionId: inTemplate?.sectionId, blockId: inTemplate?.kind === "block" ? inTemplate.blockId : undefined });
    if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [selection, activeTemplateId]);
  const previewResources = useMemo(
    () => {
      const options = editorPreviewResourceOptions(activeTemplate?.type, catalog, { pages, blogs, articles });
      if (handoff.resourceId && handoff.resourceType === activeTemplate?.type && !options.some((option) => option.id === handoff.resourceId)) {
        options.push({ id: handoff.resourceId, label: `Selected ${handoff.resourceType}` });
      }
      return options;
    },
    [activeTemplate, articles, blogs, catalog, handoff, pages],
  );
  const globalLabels = useMemo(() => Object.fromEntries(validGlobals.map((global) => [
    global.id,
    {
      id: global.id,
      name: global.name,
      sectionType: typeof global.section.type === "string" ? global.section.type : undefined,
      sectionId: typeof global.section.id === "string" ? global.section.id : undefined,
      blocks: Array.isArray(global.section.blocks) ? global.section.blocks.flatMap((block) => block && typeof block === "object" && typeof block.id === "string" && typeof block.type === "string" ? [{ id: block.id, type: block.type }] : []) : [],
    },
  ])), [validGlobals]);
  const presetOptions = useMemo(() => presets.flatMap((preset) => {
    const section = normalizeSection(preset.section);
    return section ? [{ id: preset.id, name: preset.name, section }] : [];
  }), [presets]);
  const globalOptions = useMemo(() => validGlobals.flatMap((global) => {
    const section = normalizeSection(global.section);
    return section ? [{ id: global.id, name: global.name, section }] : [];
  }), [validGlobals]);
  const selectedGlobal = activeGlobalId ? globalMap.get(activeGlobalId) : undefined;
  const localSection = selectedGlobal ? normalizeSection(selectedGlobal.section) : activeTemplate ? selectedInlineSection(activeTemplate, selection) : null;
  // Blocks are found at any depth (blocks inside a group too).
  const selectedLocation = selection?.kind === "block" ? locateBlock(localSection, selection.blockId) : null;
  const selectedBlock = selectedLocation?.block;
  const selectedChildOptions = localSection && selectedBlock ? childBlockOptions(localSection, selectedBlock.id) : { types: [], full: false };
  const sectionDefinition = localSection ? getSectionDefinition(localSection.type, themeConfiguration?.themeVersion) : undefined;
  const blockDefinition = selectedBlock ? getBlockDefinition(selectedBlock.type) : undefined;
  const baseControls = selectedBlock ? blockDefinition?.controls ?? [] : sectionDefinition?.controls ?? [];
  // On the Mobile preview, phone settings show and save their phone values.
  const responsiveView = viewport;
  const selectedNode = selectedBlock ?? localSection;
  // The colour scheme picker shows the theme's schemes by name.
  // Theme and colour scheme colours offered under every colour field.
  const colorPalette = useMemo(() => themePalette(themeConfiguration?.themeId, themeConfiguration?.settings, themeConfiguration?.themeVersion), [themeConfiguration]);
  const languages = storeLanguages(themeConfiguration?.settings);
  const activeLanguage = editLanguage && languages.some((item) => item.code === editLanguage) ? editLanguage : null;
  const activeLanguageName = languages.find((item) => item.code === activeLanguage)?.name ?? "";
  // In another language, text settings show and save that language's text.
  const selectedControls = controlsForLanguage(controlsForView(withColorSchemeNames(baseControls, themeConfiguration?.settings, selectedNode?.settings), responsiveView, selectedNode?.settings), activeLanguage, activeLanguageName, selectedNode?.settings);
  const selectedSettings = selectedNode ? settingsForLanguage(settingsForView(selectedNode, baseControls, responsiveView), baseControls, activeLanguage) : {};
  const compiledTemplate = activeTemplate && previewSnapshot ? previewSnapshot.templates[activeTemplate.id] : undefined;
  // Kept stable between renders so the preview only redraws sections whose content changed.
  const rawPreviewLayout = useMemo(() => compiledTemplate && previewSnapshot
    ? expandRawRuntimeLayout(previewSnapshot, compiledTemplate)
    : activeTemplate ? draftPreviewLayout(activeTemplate, globalMap) : { announcement: [], header: [], template: [], footer: [] },
  [compiledTemplate, previewSnapshot, activeTemplate, globalMap]);
  // Settings connected to custom fields show the value for the item being previewed.
  const previewLayout = usePreviewBindingValues(rawPreviewLayout, {
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
    storeId: backendStoreId,
    themeVersion: themeConfiguration?.themeVersion,
    resource: activeTemplate && isAssignableTemplateType(activeTemplate.type) && previewResourceId ? { type: activeTemplate.type, id: previewResourceId } : undefined,
  });
  const previewPageContext: StorefrontPageContext | null = useMemo(() => activeTemplate
    ? createEditorPreviewPageContext({ type: activeTemplate.type, resourceId: previewResourceId, storeId: backendStoreId, catalog, content: { pages, blogs, articles }, searchQuery: previewQuery, productDetail: previewProduct, productRuntime: { selections: previewProductSelections, quantity: previewProductQuantity, onSelectionsChange: setPreviewProductSelections, onQuantityChange: setPreviewProductQuantity }, collectionDetail: previewCollection })
    : null,
  [activeTemplate?.type, previewResourceId, backendStoreId, catalog, pages, blogs, articles, previewQuery, previewProduct, previewProductSelections, previewProductQuantity, previewCollection]);
  const builtInSections = useMemo(() => {
    if (!activeTemplate || !libraryRegion) return [];
    return listSectionDefinitionsForPage(activeTemplate.type, libraryRegion, themeConfiguration?.themeId, themeConfiguration?.themeVersion)
      .map((definition) => ({
        id: definition.type,
        name: definition.label ?? displayName(definition.type),
        category: sectionCategoryLabels[definition.category],
      }));
  }, [activeTemplate, libraryRegion, themeConfiguration]);
  const blockPickerSection = sections.find((section) => section.id === blockPickerSectionId);
  const blockPickerDefinition = blockPickerSection ? getSectionDefinition(blockPickerSection.type, themeConfiguration?.themeVersion) : undefined;
  const blockPickerTypes = blockPickerSection && blockPickerParentId
    ? childBlockOptions(blockPickerSection, blockPickerParentId).types
    : blockPickerDefinition?.allowedBlockTypes ?? [];
  const selectedTheme = useMemo(() => {
    if (!themeConfiguration) return undefined;
    try { const manifest = validateThemeManifest(getThemeDefinition(themeConfiguration.themeId, themeConfiguration.themeVersion).manifest); return { ...manifest, available: manifest.enabled }; }
    catch { return themeCatalog.find((theme) => theme.id === themeConfiguration.themeId && theme.version === themeConfiguration.themeVersion); }
  }, [themeCatalog, themeConfiguration]);

  const commerce = useMemo<CommerceDataProvider>(() => ({
    getMetaobjects: backendStoreId ? (handle) => fetchPublicMetaobjects(backendStoreId, handle) : undefined,
    async getProducts() {
      return catalog.products.map((product) => ({
        id: product.id,
        name: product.name,
        href: `/products/${product.slug}`,
        imageUrl: product.imageUrl,
        price: new Intl.NumberFormat("en-US", { style: "currency", currency: product.currency }).format(product.priceMinor / 100),
      }));
    },
  }), [catalog, backendStoreId]);

  useEffect(() => {
    if (previewResources.length === 0) {
      setPreviewResourceId(undefined);
      return;
    }
    if (!previewResources.some((resource) => resource.id === previewResourceId)) {
      setPreviewResourceId(previewResources[0]?.id);
    }
  }, [previewResourceId, previewResources]);
  return { activeTemplate, previewThemeStyle, validGlobals, sections, previewResources, globalLabels, presetOptions, globalOptions, selectedGlobal, localSection, selectedLocation, selectedBlock, selectedChildOptions, sectionDefinition, baseControls, responsiveView, colorPalette, languages, activeLanguage, selectedControls, selectedSettings, previewLayout, previewPageContext, builtInSections, blockPickerSection, blockPickerDefinition, blockPickerTypes, selectedTheme, commerce };
}
