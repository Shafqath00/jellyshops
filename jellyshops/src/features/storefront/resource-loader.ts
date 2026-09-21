import type {
  RuntimeGlobalSectionV4,
  RuntimeStorefrontSnapshotV4,
  RuntimeTemplateV4,
  SectionNode,
} from "@jelly/storefront-schema";

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
  | { type: PublicResourceType; handle: string };

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

export function expandRuntimeLayout(
  snapshot: RuntimeStorefrontSnapshotV4,
  template: RuntimeTemplateV4,
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
  return snapshot.assignments.find(
    (assignment) => assignment.resourceType === resource.type && assignment.resourceId === resource.id,
  )?.templateId ?? snapshot.templateDefaults[resource.type];
}

export async function resolvePublicResourceReference(
  reader: PublicResourceReader,
  type: PublicResourceType,
  id: string,
): Promise<PublicStorefrontResource | null> {
  const resource = await reader.findById(type, id);
  return resource?.visible ? resource : null;
}

export async function resolveStorefrontRoute(
  snapshot: RuntimeStorefrontSnapshotV4,
  route: StorefrontRouteRequest,
  reader: PublicResourceReader,
): Promise<ResolvedStorefrontRoute> {
  if (route.type === "home") {
    const templateId = snapshot.templateDefaults.home;
    const template = templateId ? snapshot.templates[templateId] : undefined;
    if (!template) return { status: "not-found", reason: "template" };
    const layout = expandRuntimeLayout(snapshot, template);
    return { status: "ready", context: { pageType: "home", resource: null }, resource: null, template, sections: layout.template, layout };
  }

  const resource = await reader.findByHandle(route.type, route.handle);
  if (!resource?.visible) return { status: "not-found", reason: "resource" };

  const templateId = assignedTemplateId(snapshot, resource);
  const template = templateId ? snapshot.templates[templateId] : undefined;
  if (!template || template.type !== route.type) return { status: "not-found", reason: "template" };

  const layout = expandRuntimeLayout(snapshot, template);
  return { status: "ready", context: { pageType: route.type, resource }, resource, template, sections: layout.template, layout };
}
