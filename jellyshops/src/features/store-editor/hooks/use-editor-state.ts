"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type SetStateAction } from "react";
import { useRouter } from "next/navigation";
import { createRevisionedSaveQueue } from "@/features/store-editor/state/revisioned-save-queue";
import { createSessionHistory } from "@/features/store-editor/state/session-history";
import type { CompilationDiagnostic, RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import { createStoreEditorApi } from "@/features/store-editor/api/client";
import { useAuth } from "@/features/auth/providers/auth-provider";
import type { DemoCatalog, ArticleResource, BlogResource, CatalogAdminCollectionDetail, DynamicSourceDescriptor, GlobalSectionRecord, MenuRecord, SectionPresetRecord, StorefrontTemplateRecord, ThemeCatalogEntry, ThemeConfigurationRecord, ThemeLookRecord, PageResource, WorkspaceRecord } from "@/features/store-editor/api/types";
import { type EditorPanel } from "@/features/store-editor/components/editor-panel-navigation";
import { type HierarchyRegion } from "@/features/store-editor/editor-page-helpers";
import { parseEditorNavigationTarget } from "@/features/store-editor/editor-navigation";
import type { ConfiguredOptionSelection, Product } from "@/lib/domain";
import type { EditorSelection } from "@/features/store-editor/model/types";
import { type UnsavedWork } from "@/features/store-editor/state/unsaved-work";
import type { EditorViewport } from "@/features/store-editor/state/types";

function subscribeNoop() { return () => {}; }

/** The editor's state: store data, drafts, selection, preview options, save status and history. */
export function useEditorState() {
  const mountedOnClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const router = useRouter();
  const { session, activeStore } = useAuth();
  const backendStoreId = activeStore?.id ?? "";
  const token = session?.access_token;
  const api = useMemo(() => (token && backendStoreId) ? createStoreEditorApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001",
    token,
  }) : null, [token, backendStoreId]);
  const [handoff] = useState(() => typeof window === "undefined" ? {} : parseEditorNavigationTarget(window.location.search));

  const [workspace, setWorkspace] = useState<WorkspaceRecord | null>(null);
  const [templates, setTemplateState] = useState<StorefrontTemplateRecord[]>([]);
  const [globals, setGlobalState] = useState<GlobalSectionRecord[]>([]);
  const templateDrafts = useRef<StorefrontTemplateRecord[]>([]);
  const globalDrafts = useRef<GlobalSectionRecord[]>([]);
  const setTemplates = (next: SetStateAction<StorefrontTemplateRecord[]>) => {
    templateDrafts.current = typeof next === "function" ? next(templateDrafts.current) : next;
    setTemplateState(templateDrafts.current);
  };
  const setGlobals = (next: SetStateAction<GlobalSectionRecord[]>) => {
    globalDrafts.current = typeof next === "function" ? next(globalDrafts.current) : next;
    setGlobalState(globalDrafts.current);
  };
  const [menuRecords, setMenuRecords] = useState<MenuRecord[]>([]);
  const [presets, setPresets] = useState<SectionPresetRecord[]>([]);
  // Theme library (saved looks); stays empty on a backend without it.
  const [looks, setLooks] = useState<ThemeLookRecord[]>([]);
  const [looksError, setLooksError] = useState("");
  const [looksBusy, setLooksBusy] = useState(false);
  const [dynamicSources, setDynamicSources] = useState<DynamicSourceDescriptor[]>([]);
  const [catalog, setCatalog] = useState<DemoCatalog>({ products: [], collections: [] });
  const [pages, setPages] = useState<PageResource[]>([]);
  const [blogs, setBlogs] = useState<BlogResource[]>([]);
  const [articles, setArticles] = useState<ArticleResource[]>([]);
  const [themeCatalog, setThemeCatalog] = useState<ThemeCatalogEntry[]>([]);
  const [themeConfiguration, setThemeState] = useState<ThemeConfigurationRecord | null>(null);
  const themeDraft = useRef<ThemeConfigurationRecord | null>(null);
  const setThemeConfiguration = (next: ThemeConfigurationRecord | null) => {
    themeDraft.current = next;
    setThemeState(next);
  };
  const [activeTemplateId, setActiveTemplateId] = useState("");
  const [previewResourceId, setPreviewResourceId] = useState<string | undefined>(handoff.resourceId);
  const [previewQuery, setPreviewQuery] = useState("cake");
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [previewCollection, setPreviewCollection] = useState<CatalogAdminCollectionDetail | null>(null);
  const [previewProductSelections, setPreviewProductSelections] = useState<ConfiguredOptionSelection[]>([]);
  const [previewProductQuantity, setPreviewProductQuantity] = useState(1);
  const [selection, setSelection] = useState<EditorSelection>(null);
  const [activeGlobalId, setActiveGlobalId] = useState<string>();
  const [viewport, setViewport] = useState<EditorViewport>("desktop");
  // The language being edited: null = the main language; others come from theme settings > Languages.
  const [editLanguage, setEditLanguage] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<EditorPanel>("sections");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [previewInspectorEnabled, setPreviewInspectorEnabled] = useState(true);
  const [diagnostics, setDiagnostics] = useState<CompilationDiagnostic[]>([]);
  const [previewSnapshot, setPreviewSnapshot] = useState<RuntimeStorefrontSnapshotV4>();
  const previewVersion = useRef(0);
  const invalidatePreview = () => { previewVersion.current += 1; setPreviewSnapshot(undefined); };
  const [loadError, setLoadError] = useState<string>();
  const [libraryRegion, setLibraryRegion] = useState<HierarchyRegion>();
  const [blockPickerSectionId, setBlockPickerSectionId] = useState<string>();
  // Set when the block picker adds to a group rather than to the section.
  const [blockPickerParentId, setBlockPickerParentId] = useState<string>();
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [saveError, setSaveError] = useState<string>();
  const [isConverting, setIsConverting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const convertingRef = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [history] = useState(() => createSessionHistory<{ kind: "template" | "global" | "theme"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }>());
  const [, refreshHistory] = useState(0);
  const historyScope = `${backendStoreId}:${activeTemplateId}`;
  const previewSelectionKind = selection?.kind;
  const previewSelectionSectionId = selection && selection.kind !== "theme" ? selection.sectionId : undefined;
  const previewSelectionBlockId = selection?.kind === "block" ? selection.blockId : undefined;
  const recordHistory = (change: { kind: "template" | "global" | "theme"; id: string; before: Record<string, unknown>; after: Record<string, unknown> }) => {
    if (JSON.stringify(change.before) === JSON.stringify(change.after)) return;
    history.push(historyScope, change); refreshHistory((value) => value + 1);
  };
  const saveQueueRef = useRef<ReturnType<typeof createRevisionedSaveQueue> | null>(null);
  // Changes the last session never got saved (offered as "Restore your last session").
  const [restorable, setRestorable] = useState<UnsavedWork | null>(null);
  // Remembered work is only forgotten once the offer has been decided, so loading never erases it.
  const unsavedDecided = useRef(false);
  return { mountedOnClient, router, session, activeStore, backendStoreId, token, api, handoff, workspace, setWorkspace, templates, globals, templateDrafts, globalDrafts, setTemplates, setGlobals, menuRecords, setMenuRecords, presets, setPresets, looks, setLooks, looksError, setLooksError, looksBusy, setLooksBusy, dynamicSources, setDynamicSources, catalog, setCatalog, pages, setPages, blogs, setBlogs, articles, setArticles, themeCatalog, setThemeCatalog, themeConfiguration, themeDraft, setThemeConfiguration, activeTemplateId, setActiveTemplateId, previewResourceId, setPreviewResourceId, previewQuery, setPreviewQuery, previewProduct, setPreviewProduct, previewCollection, setPreviewCollection, previewProductSelections, setPreviewProductSelections, previewProductQuantity, setPreviewProductQuantity, selection, setSelection, activeGlobalId, setActiveGlobalId, viewport, setViewport, editLanguage, setEditLanguage, mobilePanel, setMobilePanel, desktopSidebarOpen, setDesktopSidebarOpen, previewInspectorEnabled, setPreviewInspectorEnabled, diagnostics, setDiagnostics, previewSnapshot, setPreviewSnapshot, previewVersion, invalidatePreview, loadError, setLoadError, libraryRegion, setLibraryRegion, blockPickerSectionId, setBlockPickerSectionId, blockPickerParentId, setBlockPickerParentId, saveState, setSaveState, saveError, setSaveError, isConverting, setIsConverting, isPublishing, setIsPublishing, convertingRef, loadAttempt, setLoadAttempt, history, refreshHistory, historyScope, previewSelectionKind, previewSelectionSectionId, previewSelectionBlockId, recordHistory, saveQueueRef, restorable, setRestorable, unsavedDecided };
}
