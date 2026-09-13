import { Prisma, type PrismaClient } from "../../../generated/prisma/client.js";
import { assertExpectedRevision, nextRevision, type WorkspaceTransaction } from "../concurrency.js";
import type {
  CreateMenuInput,
  MenuItem,
  MenuRepository,
  MenuResourceType,
  NavigationMenuRecord,
  UpdateMenuInput,
} from "./menu-repository.js";

function mapMenu(row: {
  id: string;
  storeId: string;
  revision: number;
  name: string;
  handle: string;
  items: unknown;
  createdAt: Date;
  updatedAt: Date;
}): NavigationMenuRecord {
  if (!Array.isArray(row.items)) throw new Error("Navigation menu items must be an array");
  return {
    id: row.id,
    storeId: row.storeId,
    revision: row.revision,
    name: row.name,
    handle: row.handle,
    items: structuredClone(row.items as MenuItem[]),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaMenuRepository implements MenuRepository {
  constructor(private readonly client: PrismaClient) {}

  async getMenu(storeId: string, id: string): Promise<NavigationMenuRecord | null> {
    const row = await this.client.navigationMenu.findFirst({ where: { storeId, id } });
    return row ? mapMenu(row) : null;
  }

  async listMenus(storeId: string): Promise<NavigationMenuRecord[]> {
    return (await this.client.navigationMenu.findMany({ where: { storeId }, orderBy: { name: "asc" } })).map(mapMenu);
  }

  async resourceExists(
    transaction: WorkspaceTransaction,
    storeId: string,
    type: MenuResourceType,
    resourceId: string,
  ): Promise<boolean> {
    switch (type) {
      case "product": return await transaction.product.count({ where: { storeId, id: resourceId } }) === 1;
      case "collection": return await transaction.collection.count({ where: { storeId, id: resourceId } }) === 1;
      case "page": return await transaction.storePage.count({ where: { storeId, id: resourceId } }) === 1;
      case "blog": return await transaction.blog.count({ where: { storeId, id: resourceId } }) === 1;
      case "article": return await transaction.article.count({ where: { storeId, id: resourceId } }) === 1;
    }
  }

  async createMenu(transaction: WorkspaceTransaction, input: CreateMenuInput): Promise<NavigationMenuRecord> {
    return mapMenu(await transaction.navigationMenu.create({
      data: { ...input, items: input.items as unknown as Prisma.InputJsonValue },
    }));
  }

  async updateMenu(
    transaction: WorkspaceTransaction,
    storeId: string,
    id: string,
    expectedRevision: number,
    patch: UpdateMenuInput,
  ): Promise<NavigationMenuRecord | null> {
    const current = await transaction.navigationMenu.findFirst({ where: { storeId, id } });
    if (!current) return null;
    assertExpectedRevision(current.revision, expectedRevision);
    return mapMenu(await transaction.navigationMenu.update({
      where: { id: current.id },
      data: {
        revision: nextRevision(current.revision),
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.handle !== undefined ? { handle: patch.handle } : {}),
        ...(patch.items !== undefined ? { items: patch.items as unknown as Prisma.InputJsonValue } : {}),
      },
    }));
  }
}
