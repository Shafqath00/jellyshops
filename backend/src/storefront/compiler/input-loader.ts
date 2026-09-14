import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import { dynamicValueTypeSchema, type DynamicValueType } from "@jelly/storefront-schema";
import { WorkspaceGenerationConflictError } from "../workspace/errors.js";
import type {
  CompilerGlobalSectionInput,
  CompilerMetaobjectDefinitionInput,
  CompilerResponsiveSettings,
  CompilerSectionNode,
  CompilerTemplateInput,
  StorefrontCompilationInput,
} from "./types.js";

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function responsive(value: unknown): CompilerResponsiveSettings | undefined {
  if (value === undefined) return undefined;
  const record = object(value, "Responsive settings");
  if (record.mobile === undefined) return {};
  return { mobile: object(record.mobile, "Mobile responsive settings") };
}

function sectionNode(value: unknown): CompilerSectionNode {
  const record = object(value, "Section");
  if (typeof record.id !== "string" || !record.id) throw new Error("Section id is required");
  if (typeof record.type !== "string" || !record.type) throw new Error("Section type is required");
  const settings = object(record.settings ?? {}, "Section settings");
  const sectionResponsive = responsive(record.responsive);
  const blocks = record.blocks === undefined
    ? undefined
    : Array.isArray(record.blocks)
      ? record.blocks.map((block) => {
          const item = object(block, "Block");
          if (typeof item.id !== "string" || !item.id) throw new Error("Block id is required");
          if (typeof item.type !== "string" || !item.type) throw new Error("Block type is required");
          const blockResponsive = responsive(item.responsive);
          return {
            id: item.id,
            type: item.type,
            ...(typeof item.enabled === "boolean" ? { enabled: item.enabled } : {}),
            settings: object(item.settings ?? {}, "Block settings"),
            ...(blockResponsive ? { responsive: blockResponsive } : {}),
          };
        })
      : (() => { throw new Error("Section blocks must be an array"); })();
  return {
    id: record.id,
    type: record.type,
    ...(typeof record.enabled === "boolean" ? { enabled: record.enabled } : {}),
    settings,
    ...(sectionResponsive ? { responsive: sectionResponsive } : {}),
    ...(blocks ? { blocks } : {}),
  };
}

export function parseTemplateLayout(value: unknown): CompilerTemplateInput["layout"] {
  const record = object(value, "Template layout");
  if (!Array.isArray(record.sections)) throw new Error("Template layout sections must be an array");
  const sections = record.sections.map((placement) => {
    const item = object(placement, "Template layout placement");
    if (item.kind === "inline") return { kind: "inline" as const, section: sectionNode(item.section) };
    if (item.kind === "global" && typeof item.globalSectionId === "string" && item.globalSectionId) {
      return { kind: "global" as const, globalSectionId: item.globalSectionId };
    }
    throw new Error("Template layout contains an invalid section placement");
  });
  return { sections };
}

function parseGlobalSection(value: unknown): CompilerGlobalSectionInput["section"] {
  return sectionNode(value);
}

function parseMetaobjectFields(value: unknown): CompilerMetaobjectDefinitionInput["fields"] {
  if (!Array.isArray(value)) throw new Error("Metaobject definition fields must be an array");
  return value.map((field) => {
    const item = object(field, "Metaobject field");
    const type = dynamicValueTypeSchema.parse(item.type) as DynamicValueType;
    if (typeof item.handle !== "string" || !item.handle) throw new Error("Metaobject field handle is required");
    return { handle: item.handle, type, storefrontVisible: item.storefrontVisible === true };
  });
}

function metaobjectDefinitionId(validations: unknown): string | undefined {
  if (!validations || typeof validations !== "object" || Array.isArray(validations)) return undefined;
  const value = (validations as Record<string, unknown>).metaobjectDefinitionId;
  return typeof value === "string" && value ? value : undefined;
}

export function assertCompilationGeneration(current: number, expected: number): void {
  if (current !== expected) throw new WorkspaceGenerationConflictError(current);
}

function templateType(value: string): CompilerTemplateInput["type"] {
  const normalized = value.toLowerCase();
  if (["home", "product", "collection", "page", "blog", "article", "search", "cart"].includes(normalized)) {
    return normalized as CompilerTemplateInput["type"];
  }
  throw new Error(`Unsupported storefront template type: ${value}`);
}

function assignmentType(value: string): "product" | "collection" | "page" | "blog" | "article" | null {
  return ["product", "collection", "page", "blog", "article"].includes(value)
    ? value as "product" | "collection" | "page" | "blog" | "article"
    : null;
}

export class PrismaCompilerInputLoader {
  constructor(private readonly client: PrismaClient) {}

  async load(storeId: string, expectedGeneration: number, registryManifestHash: string): Promise<StorefrontCompilationInput> {
    return this.client.$transaction(async (tx) => {
      const workspace = await tx.storefrontWorkspace.findUnique({ where: { storeId } });
      if (!workspace) throw new Error("Storefront workspace was not found");
      assertCompilationGeneration(workspace.generation, expectedGeneration);

      const [theme, templates, globals, menus, assignments, metafields, metaobjects, products, collections, pages, blogs, articles] = await Promise.all([
        tx.themeConfiguration.findUnique({ where: { storeId } }),
        tx.storefrontTemplate.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
        tx.globalSection.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
        tx.navigationMenu.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
        tx.storefrontTemplateAssignment.findMany({ where: { storeId }, orderBy: [{ resourceType: "asc" }, { resourceId: "asc" }] }),
        tx.metafieldDefinition.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
        tx.metaobjectDefinition.findMany({ where: { storeId }, orderBy: { id: "asc" } }),
        tx.product.findMany({ where: { storeId }, select: { id: true } }),
        tx.collection.findMany({ where: { storeId }, select: { id: true } }),
        tx.storePage.findMany({ where: { storeId }, select: { id: true } }),
        tx.blog.findMany({ where: { storeId }, select: { id: true } }),
        tx.article.findMany({ where: { storeId }, select: { id: true } }),
      ]);

      return {
        storeId,
        generation: workspace.generation,
        theme: {
          presetId: theme?.themeId ?? "minimal",
          settings: theme ? object(theme.settings, "Theme settings") : {},
          artifactId: theme?.draftArtifactId ?? null,
        },
        templates: templates.map((template) => ({
          id: template.id,
          type: templateType(template.type),
          handle: template.handle,
          name: template.name,
          layout: parseTemplateLayout(template.layout),
        })),
        globalSections: globals.map((global) => ({ id: global.id, name: global.name, section: parseGlobalSection(global.section) })),
        menus: menus.map((menu) => ({ id: menu.id, handle: menu.handle, name: menu.name, items: Array.isArray(menu.items) ? structuredClone(menu.items) : [] })),
        assignments: assignments.flatMap((assignment) => {
          const resourceType = assignmentType(assignment.resourceType);
          return resourceType ? [{ resourceType, resourceId: assignment.resourceId, templateId: assignment.templateId }] : [];
        }),
        metafieldDefinitions: metafields.flatMap((definition) => {
          const parsedType = dynamicValueTypeSchema.safeParse(definition.type);
          if (!parsedType.success) return [];
          const metaobjectId = parsedType.data === "metaobject_reference" ? metaobjectDefinitionId(definition.validations) : undefined;
          return [{
            id: definition.id,
            ownerType: definition.ownerType,
            namespace: definition.namespace,
            key: definition.key,
            type: parsedType.data,
            storefrontVisible: definition.storefrontVisible,
            archived: definition.archivedAt !== null,
            ...(metaobjectId ? { metaobjectDefinitionId: metaobjectId } : {}),
          }];
        }),
        metaobjectDefinitions: metaobjects.map((definition) => ({
          id: definition.id,
          handle: definition.handle,
          storefrontVisible: definition.storefrontVisible,
          archived: definition.archivedAt !== null,
          fields: parseMetaobjectFields(definition.fields),
        })),
        resourceIds: {
          products: new Set(products.map(({ id }) => id)),
          collections: new Set(collections.map(({ id }) => id)),
          pages: new Set(pages.map(({ id }) => id)),
          blogs: new Set(blogs.map(({ id }) => id)),
          articles: new Set(articles.map(({ id }) => id)),
        },
        registryManifestHash,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
