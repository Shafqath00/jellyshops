import type { DynamicValueType, StorefrontDocument } from "@jelly/storefront-schema";
import type { V4StarterPackId } from "@jelly/storefront-registry";
import { resolveMediaUrls } from "@/lib/media-urls";
import {
  StoreEditorApiError,
  type CompilationResult,
  type CatalogAdminProduct,
  type CatalogAdminCollectionDetail,
  type ArticleResource,
  type BlogResource,
  type DemoCatalog,
  type DraftRecord,
  type DynamicSourceDescriptor,
  type GlobalSectionRecord,
  type MediaRecord,
  type MenuRecord,
  type PublicationRecord,
  type PageResource,
  type PublishResult,
  type SectionPresetRecord,
  type StorefrontTemplateRecord,
  type StorefrontTemplateType,
  type StarterInstallationResult,
  type TemplateAssignmentRecord,
  type TemplateMutationResult,
  type ThemeConfigurationRecord,
  type ThemeCatalogEntry,
  type WorkspaceRecord,
} from "./types";

export interface StoreEditorApi {
  installStarterPack(storeId: string, starterPackId: V4StarterPackId, options?: { replaceDraft: true; expectedGeneration: number }): Promise<StarterInstallationResult>;
  listThemeCatalog(storeId: string): Promise<ThemeCatalogEntry[]>;
  loadWorkspace(storeId: string): Promise<WorkspaceRecord>;
  listTemplates(storeId: string, type?: StorefrontTemplateType): Promise<StorefrontTemplateRecord[]>;
  getTemplate(storeId: string, templateId: string): Promise<StorefrontTemplateRecord>;
  createTemplate(storeId: string, input: { type: StorefrontTemplateType; name: string; handle?: string; layout: Record<string, unknown> }): Promise<TemplateMutationResult>;
  updateTemplate(storeId: string, templateId: string, expectedRevision: number, patch: { name?: string; handle?: string; layout?: Record<string, unknown> }): Promise<TemplateMutationResult>;
  cloneTemplate(storeId: string, templateId: string, input: { name: string; handle: string }): Promise<TemplateMutationResult>;
  /** Refused for a page type's main template and for templates still used by a product, collection or page. */
  deleteTemplate(storeId: string, templateId: string, expectedRevision: number): Promise<{ templateId: string; generation: number }>;
  /** Earlier published versions, newest first. */
  listPublications(storeId: string): Promise<{ publications: Array<{ id: string; sourceGeneration: number; publishedAt: string; isCurrent: boolean }> }>;
  /** Makes an earlier published version live again; the draft is not changed. */
  restorePublication(storeId: string, publicationId: string): Promise<{ ok: boolean }>;

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
  saveThemeConfiguration(storeId: string, expectedRevision: number | null, input: { themeId: string; themeVersion?: string; settings: Record<string, unknown>; draftArtifactId?: string | null }): Promise<{ theme: ThemeConfigurationRecord; generation: number }>;

  getAssignment(storeId: string, resourceType: TemplateAssignmentRecord["resourceType"], resourceId: string): Promise<TemplateAssignmentRecord | null>;
  assignTemplate(storeId: string, resourceType: TemplateAssignmentRecord["resourceType"], resourceId: string, templateId: string, expectedRevision: number | null): Promise<{ assignment: TemplateAssignmentRecord; generation: number }>;
  /** Puts the resource back on its page type's main template. */
  removeAssignment(storeId: string, resourceType: TemplateAssignmentRecord["resourceType"], resourceId: string, expectedRevision: number): Promise<{ generation: number }>;

  listDynamicSources(storeId: string, context: StorefrontTemplateType, acceptedTypes?: DynamicValueType[]): Promise<DynamicSourceDescriptor[]>;
  validate(storeId: string, expectedGeneration: number): Promise<CompilationResult>;
  compilePreview(storeId: string, expectedGeneration: number): Promise<CompilationResult>;
  publish(storeId: string, expectedGeneration: number, idempotencyKey?: string): Promise<PublishResult>;

  // V3 compatibility only while the old editor route is being retired.
  loadDraft(storeId: string): Promise<DraftRecord>;
  saveDraft(storeId: string, expectedRevision: number, document: StorefrontDocument): Promise<DraftRecord>;
  getPublic(storeId: string): Promise<PublicationRecord>;

  listCatalog(storeId: string): Promise<DemoCatalog>;
  listPages(storeId: string): Promise<PageResource[]>;
  listBlogs(storeId: string): Promise<BlogResource[]>;
  listArticles(storeId: string): Promise<ArticleResource[]>;
  uploadMedia(storeId: string, file: File, onProgress?: (percent: number) => void): Promise<MediaRecord>;
  listMedia?(storeId: string): Promise<MediaRecord[]>;
  deleteMedia(storeId: string, mediaId: string): Promise<void>;
  listProducts(storeId: string): Promise<{ nodes: CatalogAdminProduct[]; nextCursor: string | null }>;
  /** Full, store-scoped catalog record for runtime-only editor preview. */
  getProduct(storeId: string, productId: string): Promise<CatalogAdminProduct | null>;
  getCollection(storeId: string, collectionId: string): Promise<CatalogAdminCollectionDetail | null>;
  createProduct(storeId: string, input: { media?: Array<{ mediaId: string; altText?: string | null; appliesTo?: Record<string, string[]> }>; imageUrl?: string; handle: string; title: string; description?: string; productType?: string | null; vendor?: string | null; tags?: string[]; status?: "DRAFT" | "ACTIVE" | "ARCHIVED"; primaryCategoryId?: string | null; additionalCategoryIds?: string[]; brandId?: string | null; collectionIds?: string[]; categoryMetadata?: unknown | null; brandMetadata?: unknown | null; collectionMetadata?: unknown[]; options?: unknown[]; inventoryOptionIds?: string[]; variants?: Array<{ title: string; sku?: string; priceMinor: number; compareAtPriceMinor?: number | null; costMinor?: number | null; unitPricing?: { totalAmount: number; totalUnit: string; baseAmount: number; baseUnit: string } | null; quantity?: number; trackInventory?: boolean; options?: Record<string, string> }> }): Promise<CatalogAdminProduct>;
  updateProduct(storeId: string, productId: string, input: { media?: Array<{ mediaId: string; altText?: string | null; appliesTo?: Record<string, string[]> }>; imageUrl?: string; handle?: string; title?: string; description?: string; productType?: string | null; vendor?: string | null; tags?: string[]; status?: "DRAFT" | "ACTIVE" | "ARCHIVED"; primaryCategoryId?: string | null; additionalCategoryIds?: string[]; brandId?: string | null; collectionIds?: string[]; categoryMetadata?: unknown | null; brandMetadata?: unknown | null; collectionMetadata?: unknown[]; options?: unknown[]; inventoryOptionIds?: string[]; variants?: Array<{ id?: string; title: string; sku?: string; priceMinor: number; compareAtPriceMinor?: number | null; costMinor?: number | null; unitPricing?: { totalAmount: number; totalUnit: string; baseAmount: number; baseUnit: string } | null; quantity?: number; trackInventory?: boolean; options?: Record<string, string> }> }): Promise<CatalogAdminProduct>;
}

interface ClientOptions { baseUrl: string; token: string; fetch?: typeof fetch }

export function createStoreEditorApi({ baseUrl, token, fetch: fetcher = fetch }: ClientOptions): StoreEditorApi {
  const origin = baseUrl.replace(/\/$/, "");
  const url = (path: string) => `${origin}${path}`;
  const absolute = (value: string) => (value.startsWith("/") ? `${origin}${value}` : value);
  // Media paths are API-relative; the browser would otherwise request them from the frontend origin.
  const withAbsoluteMedia = <T extends { imageUrl?: string | null; media?: { url: string }[] }>(product: T): T => ({
    ...product,
    ...(product.imageUrl ? { imageUrl: absolute(product.imageUrl) } : {}),
    ...(product.media ? { media: product.media.map((photo) => ({ ...photo, url: absolute(photo.url) })) } : {}),
  });
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
    return resolveMediaUrls(await response.json() as T, origin);
  };
  const compilerRequest = async (path: string, expectedGeneration: number): Promise<CompilationResult> => {
    const init: RequestInit = { method: "POST", body: JSON.stringify({ expectedGeneration }) };
    const response = await fetcher(url(path), { ...init, headers: headers(init, true) });
    if (response.ok || response.status === 422) return resolveMediaUrls(await response.json() as CompilationResult, origin);
    throw await apiError(response);
  };

  const storefrontPath = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/storefront${suffix}`;
  const customDataPath = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/custom-data${suffix}`;
  const contentPath = (storeId: string, suffix: string) => `/api/stores/${encodeURIComponent(storeId)}/content${suffix}`;

  return {
    installStarterPack: (storeId, starterPackId, options) => request(storefrontPath(storeId, `/starters/${encodeURIComponent(starterPackId)}/install`), { method: "POST", ...(options ? { body: JSON.stringify(options) } : {}) }),
    listThemeCatalog: (storeId) => request(storefrontPath(storeId, "/themes")),
    loadWorkspace: (storeId) => request(storefrontPath(storeId, "/workspace")),
    listTemplates: (storeId, type) => request(storefrontPath(storeId, `/templates${type ? `?type=${encodeURIComponent(type)}` : ""}`)),
    getTemplate: (storeId, templateId) => request(storefrontPath(storeId, `/templates/${encodeURIComponent(templateId)}`)),
    createTemplate: (storeId, input) => request(storefrontPath(storeId, "/templates"), { method: "POST", body: JSON.stringify(input) }),
    updateTemplate: (storeId, templateId, expectedRevision, patch) => request(storefrontPath(storeId, `/templates/${encodeURIComponent(templateId)}`), { method: "PATCH", body: JSON.stringify({ expectedRevision, ...patch }) }),
    cloneTemplate: (storeId, templateId, input) => request(storefrontPath(storeId, `/templates/${encodeURIComponent(templateId)}/clone`), { method: "POST", body: JSON.stringify(input) }),
    deleteTemplate: (storeId, templateId, expectedRevision) => request(storefrontPath(storeId, `/templates/${encodeURIComponent(templateId)}`), { method: "DELETE", body: JSON.stringify({ expectedRevision }) }),
    listPublications: (storeId) => request(storefrontPath(storeId, "/publications")),
    restorePublication: (storeId, publicationId) => request(storefrontPath(storeId, `/publications/${encodeURIComponent(publicationId)}/restore`), { method: "POST" }),

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
    removeAssignment: (storeId, resourceType, resourceId, expectedRevision) => request(storefrontPath(storeId, `/assignments/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`), { method: "DELETE", body: JSON.stringify({ expectedRevision }) }),

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
      return fetcher(url(storefrontPath(storeId, "/publish")), {
        method: "POST",
        headers: headers({ method: "POST", body: JSON.stringify({ expectedGeneration, idempotencyKey }) }, true),
        body: JSON.stringify({ expectedGeneration, idempotencyKey }),
      }).then(async (response) => {
        if (response.ok || response.status === 422) return resolveMediaUrls(await response.json() as PublishResult, origin);
        throw await apiError(response);
      });
    },

    loadDraft: (storeId) => request(storefrontPath(storeId, "/draft")),
    saveDraft: (storeId, expectedRevision, document) => request(storefrontPath(storeId, "/draft"), { method: "PUT", body: JSON.stringify({ expectedRevision, document }) }),
    getPublic: (storeId) => request(storefrontPath(storeId, "/public"), {}, false),

    listCatalog: async (storeId) => {
      const catalogPath = `/api/stores/${encodeURIComponent(storeId)}/catalog`;
      const [products, collections] = await Promise.all([
        request<{ nodes: CatalogAdminProduct[] }>(`${catalogPath}/products?limit=100`),
        request<{ nodes: Array<{ id: string; handle: string; title: string }> }>(`${catalogPath}/collections?limit=100`),
      ]);
      return {
        products: products.nodes.map((product) => ({
          id: product.id,
          slug: product.handle,
          name: product.title,
          imageUrl: product.media[0]?.url ?? "",
          priceMinor: product.variants[0]?.priceMinor ?? 0,
          currency: "USD" as const,
        })),
        collections: collections.nodes.map((collection) => ({
          id: collection.id,
          slug: collection.handle,
          name: collection.title,
          imageUrl: "",
          productIds: products.nodes.filter((product) => product.collectionIds?.includes(collection.id)).map((product) => product.id),
        })),
      };
    },
    listPages: (storeId) => request(contentPath(storeId, "/pages")),
    listBlogs: (storeId) => request(contentPath(storeId, "/blogs")),
    listArticles: (storeId) => request(contentPath(storeId, "/articles")),
    uploadMedia: async (storeId, file, onProgress) => {
      const form = new FormData(); form.append("file", file);
      const path = `/api/stores/${encodeURIComponent(storeId)}/media`;
      let result: MediaRecord;
      if (onProgress) {
        result = await new Promise<MediaRecord>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", url(path));
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
          xhr.onerror = () => reject(new Error("Photo upload failed. Check your connection and retry."));
          xhr.onabort = () => reject(new Error("Photo upload was cancelled."));
          xhr.onload = () => {
            let body: MediaRecord & { error?: { code?: string; message?: string } };
            try { body = JSON.parse(xhr.responseText) as typeof body; }
            catch { reject(new StoreEditorApiError(xhr.status, "REQUEST_FAILED", "The server returned an invalid upload response.")); return; }
            if (xhr.status < 200 || xhr.status >= 300) {
              reject(new StoreEditorApiError(xhr.status, body.error?.code ?? "REQUEST_FAILED", body.error?.message ?? "Photo upload failed."));
              return;
            }
            onProgress(100);
            resolve(body);
          };
          xhr.send(form);
        });
      } else {
        result = await request<MediaRecord>(path, { method: "POST", body: form });
      }
      return { ...result, url: result.url.startsWith("/") ? `${origin}${result.url}` : result.url };
    },
    listMedia: async (storeId) => {
      const result = await request<MediaRecord[] | { nodes: MediaRecord[] }>(`/api/stores/${encodeURIComponent(storeId)}/media?limit=100`);
      return (Array.isArray(result) ? result : result.nodes).map((item) => ({ ...item, url: item.url.startsWith("/") ? `${origin}${item.url}` : item.url }));
    },
    deleteMedia: (storeId, mediaId) => request(`/api/stores/${encodeURIComponent(storeId)}/media/${encodeURIComponent(mediaId)}`, { method: "DELETE" }),
    listProducts: (storeId) => request(`/api/stores/${encodeURIComponent(storeId)}/catalog/products?limit=100`),
    getProduct: async (storeId, productId) => withAbsoluteMedia(await request<CatalogAdminProduct>(`/api/stores/${encodeURIComponent(storeId)}/catalog/products/${encodeURIComponent(productId)}`)),
    getCollection: (storeId, collectionId) => request(`/api/stores/${encodeURIComponent(storeId)}/catalog/collections/${encodeURIComponent(collectionId)}`),
    createProduct: async (storeId, input) => withAbsoluteMedia(await request<CatalogAdminProduct>(`/api/stores/${encodeURIComponent(storeId)}/catalog/products`, { method: "POST", body: JSON.stringify(input) })),
    updateProduct: async (storeId, productId, input) => withAbsoluteMedia(await request<CatalogAdminProduct>(`/api/stores/${encodeURIComponent(storeId)}/catalog/products/${encodeURIComponent(productId)}`, { method: "PATCH", body: JSON.stringify(input) })),
  };
}
