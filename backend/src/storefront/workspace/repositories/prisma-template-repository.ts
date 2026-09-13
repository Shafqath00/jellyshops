import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import {
  assertExpectedRevision,
  nextRevision,
  type WorkspaceTransaction,
} from "../concurrency.js";
import type {
  CloneTemplateRecordInput,
  CreateTemplateRecordInput,
  StorefrontTemplateRecord,
  TemplateLayout,
  TemplateRepository,
  TemplateType,
  UpdateTemplateRecordInput,
} from "./template-repository.js";

type TemplateRow = {
  id: string;
  storeId: string;
  revision: number;
  type: string;
  handle: string;
  name: string;
  layout: unknown;
  createdAt: Date;
  updatedAt: Date;
};

const prismaTypes: Record<TemplateType, string> = {
  home: "HOME",
  product: "PRODUCT",
  collection: "COLLECTION",
  page: "PAGE",
  blog: "BLOG",
  article: "ARTICLE",
  search: "SEARCH",
  cart: "CART",
};

const domainTypes = Object.fromEntries(
  Object.entries(prismaTypes).map(([domain, prisma]) => [prisma, domain]),
) as Record<string, TemplateType>;

function toPrismaType(type: TemplateType): "HOME" | "PRODUCT" | "COLLECTION" | "PAGE" | "BLOG" | "ARTICLE" | "SEARCH" | "CART" {
  return prismaTypes[type] as "HOME" | "PRODUCT" | "COLLECTION" | "PAGE" | "BLOG" | "ARTICLE" | "SEARCH" | "CART";
}

function mapTemplate(row: TemplateRow): StorefrontTemplateRecord {
  const type = domainTypes[row.type];
  if (!type) throw new Error(`Unsupported storefront template type: ${row.type}`);
  if (!row.layout || typeof row.layout !== "object" || Array.isArray(row.layout)) {
    throw new Error("Storefront template layout must be an object");
  }
  return {
    id: row.id,
    storeId: row.storeId,
    revision: row.revision,
    type,
    handle: row.handle,
    name: row.name,
    layout: structuredClone(row.layout as TemplateLayout),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function json(layout: TemplateLayout): Prisma.InputJsonValue {
  return layout as Prisma.InputJsonValue;
}

export class PrismaTemplateRepository implements TemplateRepository {
  constructor(private readonly client: PrismaClient) {}

  async getTemplate(storeId: string, templateId: string): Promise<StorefrontTemplateRecord | null> {
    const row = await this.client.storefrontTemplate.findFirst({ where: { storeId, id: templateId } });
    return row ? mapTemplate(row) : null;
  }

  async listTemplates(storeId: string, type?: TemplateType): Promise<StorefrontTemplateRecord[]> {
    const rows = await this.client.storefrontTemplate.findMany({
      where: { storeId, ...(type ? { type: toPrismaType(type) } : {}) },
      orderBy: [{ type: "asc" }, { handle: "asc" }],
    });
    return rows.map(mapTemplate);
  }

  async createTemplate(
    transaction: WorkspaceTransaction,
    input: CreateTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord> {
    return mapTemplate(await transaction.storefrontTemplate.create({
      data: {
        storeId: input.storeId,
        type: toPrismaType(input.type),
        handle: input.handle,
        name: input.name,
        layout: json(input.layout),
      },
    }));
  }

  async updateTemplate(
    transaction: WorkspaceTransaction,
    storeId: string,
    templateId: string,
    expectedRevision: number,
    patch: UpdateTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord | null> {
    const current = await transaction.storefrontTemplate.findFirst({
      where: { storeId, id: templateId },
    });
    if (!current) return null;

    assertExpectedRevision(current.revision, expectedRevision);
    const revision = nextRevision(current.revision);
    return mapTemplate(await transaction.storefrontTemplate.update({
      where: { id: current.id },
      data: {
        revision,
        ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.layout !== undefined ? { layout: json(patch.layout) } : {}),
      },
    }));
  }

  async cloneTemplate(
    transaction: WorkspaceTransaction,
    storeId: string,
    sourceTemplateId: string,
    input: CloneTemplateRecordInput,
  ): Promise<StorefrontTemplateRecord | null> {
    const source = await transaction.storefrontTemplate.findFirst({
      where: { storeId, id: sourceTemplateId },
    });
    if (!source) return null;
    if (!source.layout || typeof source.layout !== "object" || Array.isArray(source.layout)) {
      throw new Error("Storefront template layout must be an object");
    }

    return mapTemplate(await transaction.storefrontTemplate.create({
      data: {
        storeId,
        type: source.type,
        handle: input.handle,
        name: input.name,
        layout: structuredClone(source.layout) as Prisma.InputJsonValue,
      },
    }));
  }
}
