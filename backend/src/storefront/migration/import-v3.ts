import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  storefrontDocumentSchema,
  type SectionNode,
  type StorefrontDocument,
  type StorefrontPage,
} from "@jelly/storefront-schema";

export interface V3ImportTemplate {
  id: string;
  type: "home" | "product" | "collection" | "page";
  handle: string;
  name: string;
  layout: {
    sections: Array<
      | { kind: "inline"; section: SectionNode }
      | { kind: "global"; globalSectionId: string }
    >;
  };
}

export interface V3ImportPlan {
  storeId: string;
  workspaceGeneration: number;
  theme: { themeId: string; settings: Record<string, unknown> };
  globalSections: Array<{ id: string; name: string; section: SectionNode }>;
  templates: V3ImportTemplate[];
  pages: Array<{
    id: string;
    title: string;
    handle: string;
    content: Record<string, unknown>;
    status: "PUBLISHED";
    publishedAt: Date;
  }>;
  assignments: Array<{
    resourceType: "page";
    resourceId: string;
    templateId: string;
  }>;
}

function globalId(region: "header" | "footer", sectionId: string): string {
  return `v3-${region}-${sectionId}`;
}

function templateId(page: StorefrontPage): string {
  return `v3-template-${page.id}`;
}

function templateType(page: StorefrontPage): V3ImportTemplate["type"] {
  return page.type === "custom" ? "page" : page.type;
}

function templateHandle(page: StorefrontPage): string {
  return page.type === "custom" ? page.slug : "default";
}

function templateLayout(
  document: StorefrontDocument,
  page: StorefrontPage,
): V3ImportTemplate["layout"] {
  return {
    sections: [
      ...document.regions.header.map((section) => ({
        kind: "global" as const,
        globalSectionId: globalId("header", section.id),
      })),
      ...page.sections.map((section) => ({
        kind: "inline" as const,
        section: structuredClone(section),
      })),
      ...document.regions.footer.map((section) => ({
        kind: "global" as const,
        globalSectionId: globalId("footer", section.id),
      })),
    ],
  };
}

export function buildV3ImportPlan(input: unknown): V3ImportPlan {
  const document = storefrontDocumentSchema.parse(input);
  const importedAt = new Date(0);
  const templates: V3ImportTemplate[] = document.pages.map((page) => ({
    id: templateId(page),
    type: templateType(page),
    handle: templateHandle(page),
    name: page.type === "custom" ? page.title : `${page.title} default`,
    layout: templateLayout(document, page),
  }));
  const customPages = document.pages.filter((page): page is StorefrontPage & { type: "custom" } => page.type === "custom");

  return {
    storeId: document.storeId,
    workspaceGeneration: 1,
    theme: {
      themeId: document.theme.presetId,
      settings: structuredClone(document.theme.settings) as Record<string, unknown>,
    },
    globalSections: [
      ...document.regions.header.map((section, index) => ({
        id: globalId("header", section.id),
        name: `Legacy header ${index + 1}`,
        section: structuredClone(section),
      })),
      ...document.regions.footer.map((section, index) => ({
        id: globalId("footer", section.id),
        name: `Legacy footer ${index + 1}`,
        section: structuredClone(section),
      })),
    ],
    templates,
    pages: customPages.map((page) => ({
      id: page.id,
      title: page.title,
      handle: page.slug,
      content: {},
      status: "PUBLISHED" as const,
      publishedAt: importedAt,
    })),
    assignments: customPages.map((page) => ({
      resourceType: "page" as const,
      resourceId: page.id,
      templateId: templateId(page),
    })),
  };
}

function prismaTemplateType(type: V3ImportTemplate["type"]): "HOME" | "PRODUCT" | "COLLECTION" | "PAGE" {
  switch (type) {
    case "home": return "HOME";
    case "product": return "PRODUCT";
    case "collection": return "COLLECTION";
    case "page": return "PAGE";
  }
}

export interface V3ImportResult {
  storeId: string;
  generation: number;
  templateCount: number;
  globalSectionCount: number;
  pageCount: number;
  assignmentCount: number;
  currentPublicationId: string | null;
}

export class PrismaV3StorefrontImporter {
  constructor(private readonly client: PrismaClient) {}

  async import(input: unknown): Promise<V3ImportResult> {
    const plan = buildV3ImportPlan(input);
    return this.client.$transaction(async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: plan.storeId, archivedAt: null },
        select: { id: true, currentPublicationId: true, workspace: { select: { storeId: true } } },
      });
      if (!store) throw new Error("Store was not found");
      if (store.workspace) throw new Error("Storefront workspace is already initialized");

      await tx.storefrontWorkspace.create({
        data: { storeId: plan.storeId, generation: plan.workspaceGeneration },
      });
      await tx.themeConfiguration.create({
        data: {
          storeId: plan.storeId,
          themeId: plan.theme.themeId,
          settings: plan.theme.settings as Prisma.InputJsonValue,
        },
      });

      for (const global of plan.globalSections) {
        await tx.globalSection.create({
          data: {
            id: global.id,
            storeId: plan.storeId,
            name: global.name,
            section: global.section as unknown as Prisma.InputJsonValue,
          },
        });
      }
      for (const template of plan.templates) {
        await tx.storefrontTemplate.create({
          data: {
            id: template.id,
            storeId: plan.storeId,
            type: prismaTemplateType(template.type),
            handle: template.handle,
            name: template.name,
            layout: template.layout as unknown as Prisma.InputJsonValue,
          },
        });
      }
      for (const page of plan.pages) {
        await tx.storePage.create({
          data: {
            id: page.id,
            storeId: plan.storeId,
            title: page.title,
            handle: page.handle,
            content: page.content as Prisma.InputJsonValue,
            status: page.status,
            publishedAt: page.publishedAt,
          },
        });
      }
      for (const assignment of plan.assignments) {
        await tx.storefrontTemplateAssignment.create({
          data: {
            storeId: plan.storeId,
            resourceType: assignment.resourceType,
            resourceId: assignment.resourceId,
            templateId: assignment.templateId,
          },
        });
      }

      const after = await tx.store.findUniqueOrThrow({
        where: { id: plan.storeId },
        select: { currentPublicationId: true },
      });
      if (after.currentPublicationId !== store.currentPublicationId) {
        throw new Error("V3 import must not change the live publication");
      }

      return {
        storeId: plan.storeId,
        generation: plan.workspaceGeneration,
        templateCount: plan.templates.length,
        globalSectionCount: plan.globalSections.length,
        pageCount: plan.pages.length,
        assignmentCount: plan.assignments.length,
        currentPublicationId: after.currentPublicationId,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
