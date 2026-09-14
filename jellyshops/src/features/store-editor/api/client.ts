import type { DynamicValueType, StorefrontDocument } from "@jelly/storefront-schema";
import {
  StoreEditorApiError,
  type CompilationResult,
  type DemoCatalog,
  type DraftRecord,
  type DynamicSourceDescriptor,
  type GlobalSectionRecord,
  type MediaRecord,
  type MenuRecord,
  type PublicationRecord,
  type PublishResult,
  type SectionPresetRecord,
  type StorefrontTemplateRecord,
  type StorefrontTemplateType,
  type TemplateAssignmentRecord,
  type TemplateMutationResult,
  type ThemeConfigurationRecord,
  type WorkspaceRecord,
} from "./types";

export interface StoreEditorApi {
  loadWorkspace(storeId: string): Promise<WorkspaceRecord>;
  listTemplates(storeId: string, type?: StorefrontTemplateType): Promise<StorefrontTemplateRecord[]>;
  getTemplate(storeId: string, templateId: string): Promise<StorefrontTemplateRecord>;
  createTemplate(storeId: string, input: { type: StorefrontTemplateType; name: string; handle?: string; layout: Record<string, unknown> }): Promise<TemplateMutationResult>;
  updateTemplate(storeId: string, templateId: string, expectedRevision: number, patch: { name?: string; handle?: string; layout?: Record<string, unknown> }): Promise<TemplateMutationResult>;
  cloneTemplate(storeId: string, templateId: string, input: { name: string; handle: string }): Promise<TemplateMutationResult>;

  listGlobalSections(storeId: string): Promise<GlobalSectionRecord[]>;
  createGlobalSection(storeId: string, input: { name: string; section: Record<string, unknown> }): Promise<{ globalSection: GlobalSectionRecord; generation: number }>;
  updateGlobalSection(storeId: string, sectionId: string, expectedRevision: number, patch: { name?: string; section?: Record<string, unknown> }): Promise<{ globalSection: GlobalSectionRecord; generation: number }>;
  listPresets(storeId: string): Promise<SectionPresetRecord[]>;
  createPreset(storeId: string, input: { name: string; section: Record<string, unknown> }): Promise<{ preset: SectionPresetRecord; generation: number }>;
  instantiatePreset(storeId: string, presetId: string): Promise<Record<string, unknown>>;

  listMenus(storeId: string): Promise<MenuRecord[]>;
  createMenu(storeId: string, input: { name: string; handle: string; items: unknown[] }): Promise<{ menu: MenuRecord; generation: number }>;
  updateMenu(storeId: string, menuId: string, expectedRevision: number, patch: { name?: string; handle?: string; items?: unknown[] }): Promise<{ menu: MenuRecord; generation: number }>;

  getThemeConfiguration(storeId: string): Promise<ThemeConfigurationRecord | null>;
  saveThemeConfiguration(storeId: string, expectedRevision: number | null, input: { themeId: string; settings: Record<string, unknown>; draftArtifactId?: string | null }): Promise<{ theme: ThemeConfigurationRecord; generation: number }>;

  getAssignment(storeId: string, resourceType: TemplateAssignmentRecord["resourceType"], resourceId: string): Promise<TemplateAssignmentRecord | null>;
  assignTemplate(storeId: string, resourceType: TemplateAssignmentRecord["resourceType"], resourceId: string, templateId: string, expectedRevision: number | null): Promise<{ assignment: TemplateAssignmentRecord; generation: number }>;

  listDynamicSources(storeId: string, context: StorefrontTemplateType, acceptedTypes?: DynamicValueType[]): Promise<DynamicSourceDescriptor[]>;
  validate(storeId: string, expectedGeneration: number): Promise<CompilationResult>;
  compilePreview(storeId: string, expectedGeneration: number): Promise<CompilationResult>;
  publish(storeId: string, expectedGeneration: number, idempotencyKey?: string): Promise<PublishResult>;

  // V3 compatibility only while the old editor route is being retired.
  loadDraft(storeId: string): Promise<DraftRecord>;
  saveDraft(storeId: string, expectedRevision: number, document: StorefrontDocument): Promise<DraftRecord>;
  getPublic(storeId: string): Promise<PublicationRecord>;

  listCatalog(): Promise<DemoCatalog>;
  uploadMedia(storeId: string, file: File, onProgress?: (percent: number) => void): Promise<MediaRecord>;
  deleteMedia(storeId: string, mediaId: string): Promise<void>;
}

interface ClientOptions { baseUrl: string; token: string; fetch?: typeof fetch }

export function createStoreEditorApi({ baseUrl, token, fetch: fetcher = fetch }: ClientOptions): StoreEditorApi {
  const origin = baseUrl.replace(/\/$/, "");
  const url = (path: string) => `${origin}${path}`;
  const headers = (init: RequestInit, authenticated: boolean) => ({
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    ...init.headers,
  });
  const apiError = async (response: Response): Promise<StoreEditorApiError> => {
    const body = await response.json().catch(() => ({})) as {
      error?: {
        code?: string;
        message?: string;
        issues?: never[];
        currentRevision?: number;
        currentGeneration?: number;
      };
    };
    return new StoreEditorApiError(
      response.status,
      body.error?.code ?? "REQUEST_FAILED",
      body.error?.message ?? "Request failed",
      body.error?.issues,
      body.error?.currentRevision,
      body.error?.currentGeneration,
    );
  };
  const request = async <T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> => {
    const response = await fetcher(url(path), { ...init, headers: headers(init, authenticated) });
    if (!response.ok) throw await apiError(response);
    if (response.status === 204) return undefined as T;
    return await response.json() as T;
  };
  const compilerRequest = async (path: string, expectedGeneration: number): Promise<CompilationResult> => {
    const init: RequestInit = { method: "POST", body: JSON.stringify({ expectedGeneration }) };
    const response = await fetcher(url(path), { ...init, headers: headers(init, true) });
    if (response.ok || response.status === 422) return await response.json() as CompilationResult;
    throw await apiError(response);
  };

  const storefrontPath = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/storefront${suffix}`;
  const customDataPath = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/custom-data${suffix}`;

  return {
    loadWorkspace: (storeId) => request(storefrontPath(storeId, "/workspace")),
    listTemplates: (storeId, type) => request(storefrontPath(storeId, `/templates${type ? `?type=${encodeURIComponent(type)}` : ""}`)),
    getTemplate: (storeId, templateId) => request(storefrontPath(storeId, `/templates/${encodeURIComponent(templateId)}`)),
    createTemplate: (storeId, input) => request(storefrontPath(storeId, "/templates"), { method: "POST", body: JSON.stringify(input) }),
    updateTemplate: (storeId, templateId, expectedRevision, patch) => request(storefrontPath(storeId, `/templates/${encodeURIComponent(templateId)}`), { method: "PATCH", body: JSON.stringify({ expectedRevision, ...patch }) }),
    cloneTemplate: (storeId, templateId, input) => request(storefrontPath(storeId, `/templates/${encodeURIComponent(templateId)}/clone`), { method: "POST", body: JSON.stringify(input) }),

    listGlobalSections: (storeId) => request(storefrontPath(storeId, "/global-sections")),
    createGlobalSection: (storeId, input) => request(storefrontPath(storeId, "/global-sections"), { method: "POST", body: JSON.stringify(input) }),
    updateGlobalSection: (storeId, sectionId, expectedRevision, patch) => request(storefrontPath(storeId, `/global-sections/${encodeURIComponent(sectionId)}`), { method: "PATCH", body: JSON.stringify({ expectedRevision, ...patch }) }),
    listPresets: (storeId) => request(storefrontPath(storeId, "/presets")),
    createPreset: (storeId, input) => request(storefrontPath(storeId, "/presets"), { method: "POST", body: JSON.stringify(input) }),
    instantiatePreset: (storeId, presetId) => request(storefrontPath(storeId, `/presets/${encodeURIComponent(presetId)}/instantiate`), { method: "POST" }),

    listMenus: (storeId) => request(storefrontPath(storeId, "/menus")),
    createMenu: (storeId, input) => request(storefrontPath(storeId, "/menus"), { method: "POST", body: JSON.stringify(input) }),
    updateMenu: (storeId, menuId, expectedRevision, patch) => request(storefrontPath(storeId, `/menus/${encodeURIComponent(menuId)}`), { method: "PATCH", body: JSON.stringify({ expectedRevision, ...patch }) }),

    getThemeConfiguration: (storeId) => request(storefrontPath(storeId, "/theme-settings")),
    saveThemeConfiguration: (storeId, expectedRevision, input) => request(storefrontPath(storeId, "/theme-settings"), { method: "PUT", body: JSON.stringify({ expectedRevision, ...input }) }),

    getAssignment: (storeId, resourceType, resourceId) => request(storefrontPath(storeId, `/assignments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`)),
    assignTemplate: (storeId, resourceType, resourceId, templateId, expectedRevision) => request(storefrontPath(storeId, `/assignments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`), { method: "PUT", body: JSON.stringify({ templateId, expectedRevision }) }),

    listDynamicSources: (storeId, context, acceptedTypes) => {
      const query = new URLSearchParams({ context });
      if (acceptedTypes?.length) query.set("accepts", acceptedTypes.join(","));
      return request(customDataPath(storeId, `/dynamic-sources?${query.toString()}`));
    },
    validate: (storeId, expectedGeneration) => compilerRequest(storefrontPath(storeId, "/validate"), expectedGeneration),
    compilePreview: (storeId, expectedGeneration) => compilerRequest(storefrontPath(storeId, "/preview/compile"), expectedGeneration),
    publish: (storeId, expectedGeneration, idempotencyKey) => {
      if (!idempotencyKey) {
        throw new StoreEditorApiError(410, "LEGACY_PUBLISH_UNSUPPORTED", "Publishing now requires a workspace generation and idempotency key");
      }
      return request(storefrontPath(storeId, "/publish"), { method: "POST", body: JSON.stringify({ expectedGeneration, idempotencyKey }) });
    },

    loadDraft: (storeId) => request(storefrontPath(storeId, "/draft")),
    saveDraft: (storeId, expectedRevision, document) => request(storefrontPath(storeId, "/draft"), { method: "PUT", body: JSON.stringify({ expectedRevision, document }) }),
    getPublic: (storeId) => request(storefrontPath(storeId, "/public"), {}, false),

    listCatalog: () => request("/api/demo/catalog", {}, false),
    uploadMedia: async (storeId, file, onProgress) => {
      onProgress?.(0);
      const form = new FormData(); form.append("file", file);
      const result = await request<MediaRecord>(`/api/stores/${encodeURIComponent(storeId)}/media`, { method: "POST", body: form });
      onProgress?.(100);
      return { ...result, url: result.url.startsWith("/") ? `${origin}${result.url}` : result.url };
    },
    deleteMedia: (storeId, mediaId) => request(`/api/stores/${encodeURIComponent(storeId)}/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" }),
  };
}
