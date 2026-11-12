import type {
  RuntimeGlobalSectionV4,
  RuntimeStorefrontSnapshotV4,
  RuntimeTemplateV4,
  SectionNode,
} from "@jelly/storefront-schema";
import type { PublicProduct } from "@jelly/storefront-renderer";
import { loadPublicBindingValues, type BindingValueLoader } from "./binding-values-api";
import { applyBindingValues, collectLayoutBindings, type BindingValues } from "./dynamic-settings";

export type PublicResourceType = "product" | "collection" | "page" | "blog" | "article";

export interface PublicStorefrontResource {
  type: PublicResourceType;
  id: string;
  handle: string;
  visible: boolean;
  data: Record<string, unknown>;
}

export interface PublicResourceReader {
  findByHandle(type: PublicResourceType, handle: string): Promise<PublicStorefrontResource | null>;
  findById(type: PublicResourceType, id: string): Promise<PublicStorefrontResource | null>;
}

export type StorefrontRouteRequest =
  | { type: "home" }
  | { type: "cart" }
  | { type: "not-found" }
  | { type: "search"; context: SearchRouteContext }
  | { type: PublicResourceType; handle: string };

export interface SearchRouteContext {
  type: "search";
  query: string;
  state: "empty" | "results" | "none";
  resultCount: number;
  results: PublicProduct[];
  searchHref?: string;
}

export type ResolvedStorefrontRoute =
  | {
      status: "ready";
      context: StorefrontPageContext;
      resource: PublicStorefrontResource | null;
      template: RuntimeTemplateV4;
      sections: SectionNode[];
      layout: ResolvedStorefrontLayout;
    }
  | {
      status: "not-found";
      reason: "resource" | "template";
    };

export type StorefrontPageContext =
  | { pageType: "home"; resource: null }
  | { pageType: "cart"; resource: null; data?: Record<string, unknown> }
  | { pageType: "not-found"; resource: null }
  | { pageType: "search"; resource: null; data: SearchRouteContext }
  | { pageType: PublicResourceType; resource: PublicStorefrontResource };

export interface ResolvedStorefrontLayout {
  announcement: SectionNode[];
  header: SectionNode[];
  template: SectionNode[];
  footer: SectionNode[];
}

function blockNode(input: unknown): SectionNode["blocks"][number] | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.type !== "string") return null;
  const settings = record.settings;
  return {
    id: record.id,
    type: record.type,
    enabled: typeof record.enabled === "boolean" ? record.enabled : true,
    settings: settings && typeof settings === "object" && !Array.isArray(settings)
      ? structuredClone(settings as Record<string, unknown>)
      : {},
    ...(record.responsive && typeof record.responsive === "object" && !Array.isArray(record.responsive)
      ? { responsive: structuredClone(record.responsive) as SectionNode["blocks"][number]["responsive"] }
      : {}),
    // Blocks inside a group.
    ...(Array.isArray(record.blocks)
      ? { blocks: record.blocks.map(blockNode).filter((block): block is NonNullable<ReturnType<typeof blockNode>> => block !== null) }
      : {}),
  };

}

function sectionNode(input: Record<string, unknown>): SectionNode | null {
  if (typeof input.id !== "string" || typeof input.type !== "string") return null;
  const settings = input.settings;
  const blocks = input.blocks;
  return {
    id: input.id,
    type: input.type,
    enabled: typeof input.enabled === "boolean" ? input.enabled : true,
    settings: settings && typeof settings === "object" && !Array.isArray(settings)
      ? structuredClone(settings as Record<string, unknown>)
      : {},
    blocks: Array.isArray(blocks)
      ? blocks.map(blockNode).filter((block): block is NonNullable<ReturnType<typeof blockNode>> => block !== null)
      : [],
    ...(input.responsive && typeof input.responsive === "object" && !Array.isArray(input.responsive)
      ? { responsive: structuredClone(input.responsive) as SectionNode["responsive"] }
      : {}),
  };
}

function globalSectionNode(global: RuntimeGlobalSectionV4 | undefined): SectionNode | null {
  if (!global) return null;
  return sectionNode(global.section);
}

export function expandRuntimeTemplate(
  snapshot: RuntimeStorefrontSnapshotV4,
  template: RuntimeTemplateV4,
): SectionNode[] {
  return expandRuntimeLayout(snapshot, template).template;
}

function regionFor(section: SectionNode): keyof ResolvedStorefrontLayout {
  if (section.type === "announcement-bar") return "announcement";
  if (section.type === "header") return "header";
  if (section.type === "footer") return "footer";
  return "template";
}

/**
 * The template's sections, ready to render. Settings connected to custom fields
 * show their fallback here; `resolveStorefrontRoute` fills in the real values.
 */
export function expandRuntimeLayout(
  snapshot: RuntimeStorefrontSnapshotV4,
  template: RuntimeTemplateV4,
): ResolvedStorefrontLayout {
  return applyBindingValues(expandRawRuntimeLayout(snapshot, template), new Map(), snapshot.theme.version);
}

/**
 * The template's sections exactly as saved, with custom-field connections still in place (for the editor preview,
 * which looks values up itself). The one place a template's placements become regions: the live store, the theme
 * preview and the editor (saved or draft) all lay pages out here.
 */
export function expandRawRuntimeLayout(
  snapshot: Pick<RuntimeStorefrontSnapshotV4, "globalSections">,
  template: Pick<RuntimeTemplateV4, "layout">,
): ResolvedStorefrontLayout {
  const layoutSections = template.layout.sections;
  const layout: ResolvedStorefrontLayout = { announcement: [], header: [], template: [], footer: [] };
  if (!Array.isArray(layoutSections)) return layout;

  for (const placement of layoutSections) {
    if (!placement || typeof placement !== "object" || Array.isArray(placement)) continue;
    const candidate = placement as Record<string, unknown>;
    if (candidate.kind === "inline" && candidate.section && typeof candidate.section === "object" && !Array.isArray(candidate.section)) {
      const section = sectionNode(candidate.section as Record<string, unknown>);
      if (section) layout[regionFor(section)].push(section);
      continue;
    }
    if (candidate.kind === "global" && typeof candidate.globalSectionId === "string") {
      const section = globalSectionNode(snapshot.globalSections[candidate.globalSectionId]);
      if (section) layout[regionFor(section)].push(section);
    }
  }
  return layout;
}

function assignedTemplateId(
  snapshot: RuntimeStorefrontSnapshotV4,
  resource: PublicStorefrontResource,
): string | undefined {
  const assignedTemplateId = snapshot.assignments.find(
    (assignment) => assignment.resourceType === resource.type && assignment.resourceId === resource.id,
  )?.templateId;
  const assignedTemplate = assignedTemplateId ? snapshot.templates[assignedTemplateId] : undefined;

  return assignedTemplate?.type === resource.type
    ? assignedTemplateId
    : snapshot.templateDefaults[resource.type];
}

export async function resolvePublicResourceReference(
  reader: PublicResourceReader,
  type: PublicResourceType,
  id: string,
): Promise<PublicStorefrontResource | null> {
  const resource = await reader.findById(type, id);
  return resource?.visible ? resource : null;
}

export function resolveStorefrontNotFound(snapshot: RuntimeStorefrontSnapshotV4): ResolvedStorefrontRoute {
  return buildStorefrontRoute(snapshot, { type: "not-found" }, null);
}

function defaultTemplate(snapshot: RuntimeStorefrontSnapshotV4, type: RuntimeTemplateV4["type"], requireType = true): RuntimeTemplateV4 | undefined {
  const templateId = snapshot.templateDefaults[type];
  const template = templateId ? snapshot.templates[templateId] : undefined;
  return template && (!requireType || template.type === type) ? template : undefined;
}

function isResourceRoute(route: StorefrontRouteRequest): route is Extract<StorefrontRouteRequest, { handle: string }> {
  return route.type !== "home" && route.type !== "cart" && route.type !== "search" && route.type !== "not-found";
}

/** The template a route is drawn with: the page type's default, or the one assigned to the resource. */
export function storefrontRouteTemplate(
  snapshot: RuntimeStorefrontSnapshotV4,
  route: StorefrontRouteRequest,
  resource: PublicStorefrontResource | null,
): RuntimeTemplateV4 | undefined {
  if (route.type === "home") return defaultTemplate(snapshot, "home", false);
  if (!isResourceRoute(route)) return defaultTemplate(snapshot, route.type);
  if (!resource?.visible) return undefined;
  const templateId = assignedTemplateId(snapshot, resource);
  const template = templateId ? snapshot.templates[templateId] : undefined;
  return template?.type === route.type ? template : undefined;
}

/**
 * Custom-field values for the sections of a route's template. The server looks these up before rendering, so the
 * page arrives complete; a failed lookup gives no values (each setting shows its fallback).
 */
export async function loadStorefrontRouteValues(
  snapshot: RuntimeStorefrontSnapshotV4,
  route: StorefrontRouteRequest,
  resource: PublicStorefrontResource | null,
  loadValues: BindingValueLoader = loadPublicBindingValues,
): Promise<BindingValues> {
  const template = storefrontRouteTemplate(snapshot, route, resource);
  if (!template) return new Map();
  const bindings = collectLayoutBindings(expandRawRuntimeLayout(snapshot, template));
  if (!bindings.length) return new Map();
  try {
    return await loadValues({ storeId: snapshot.storeId, bindings, ...(resource ? { resource: { type: resource.type, id: resource.id } } : {}) });
  } catch {
    return new Map();
  }
}

/** Values in a form that can travel from a server page to a client page. */
export function serializeRouteValues(values: BindingValues): Array<[string, unknown]> {
  return [...values.entries()];
}

export function deserializeRouteValues(entries: ReadonlyArray<readonly [string, unknown]> | undefined): BindingValues {
  return new Map(entries ?? []);
}

/**
 * Lays a route out synchronously from data already in hand (the resource and its custom-field values), so a page
 * renders complete on the server and re-renders on the client (option changes, bag changes) without a loading step.
 */
export function buildStorefrontRoute(
  snapshot: RuntimeStorefrontSnapshotV4,
  route: StorefrontRouteRequest,
  resource: PublicStorefrontResource | null,
  values: BindingValues = new Map(),
): ResolvedStorefrontRoute {
  if (isResourceRoute(route) && !resource?.visible) return { status: "not-found", reason: "resource" };
  const template = storefrontRouteTemplate(snapshot, route, resource);
  if (!template) return { status: "not-found", reason: "template" };
  const layout = applyBindingValues(expandRawRuntimeLayout(snapshot, template), values, snapshot.theme.version);
  const base = { status: "ready" as const, template, sections: layout.template, layout };
  if (route.type === "home") return { ...base, context: { pageType: "home", resource: null }, resource: null };
  if (route.type === "cart") return { ...base, context: { pageType: "cart", resource: null }, resource: null };
  if (route.type === "not-found") return { ...base, context: { pageType: "not-found", resource: null }, resource: null };
  if (route.type === "search") return { ...base, context: { pageType: "search", resource: null, data: route.context }, resource: null };
  const found = resource as PublicStorefrontResource;
  return { ...base, context: { pageType: route.type, resource: found }, resource: found };
}

export async function resolveStorefrontRoute(
  snapshot: RuntimeStorefrontSnapshotV4,
  route: StorefrontRouteRequest,
  reader: PublicResourceReader,
  loadValues: BindingValueLoader = loadPublicBindingValues,
): Promise<ResolvedStorefrontRoute> {
  const resource = isResourceRoute(route) ? await reader.findByHandle(route.type, route.handle) : null;
  const values = resource && !resource.visible ? new Map() : await loadStorefrontRouteValues(snapshot, route, resource, loadValues);
  return buildStorefrontRoute(snapshot, route, resource, values);
}
