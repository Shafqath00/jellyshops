export interface StorefrontWorkspaceReader {
  getWorkspace(storeId: string): Promise<{ generation: number; updatedAt: Date } | null>;
}
