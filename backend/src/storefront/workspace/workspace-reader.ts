import type { PrismaClient } from "../../generated/prisma/client.js";

export interface StorefrontWorkspaceState {
  generation: number;
  updatedAt: Date;
}

export interface StorefrontWorkspaceReader {
  getWorkspace(storeId: string): Promise<StorefrontWorkspaceState | null>;
}

export class PrismaStorefrontWorkspaceReader implements StorefrontWorkspaceReader {
  constructor(private readonly client: PrismaClient) {}

  async getWorkspace(storeId: string): Promise<StorefrontWorkspaceState | null> {
    const workspace = await this.client.storefrontWorkspace.findUnique({
      where: { storeId },
      select: { generation: true, updatedAt: true },
    });
    return workspace ?? null;
  }
}
