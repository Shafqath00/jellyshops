import type { PrismaClient } from "../generated/prisma/client.js";
import type { CatalogRepository } from "./repository.js";
import type {
  CatalogCollection,
  CatalogMedia,
  CatalogProduct,
  CatalogVariant,
  Connection,
  ListCollectionsInput,
  ListProductsInput,
  ProductStatus,
} from "./types.js";

type VariantRow = {
  id: string;
  externalId: string | null;
  title: string;
  sku: string | null;
  priceMinor: number;
  compareAtPriceMinor: number | null;
  options: unknown;
  trackInventory: boolean;
  archivedAt: Date | null;
  inventory: { quantity: number; reserved: number } | null;
};

function mapVariant(row: VariantRow): CatalogVariant {
  const trackedAvailable = row.inventory !== null && row.inventory.quantity - row.inventory.reserved > 0;
  return {
    id: row.id,
    externalId: row.externalId,
    title: row.title,
    sku: row.sku,
    priceMinor: row.priceMinor,
    compareAtPriceMinor: row.compareAtPriceMinor,
    options: (row.options ?? {}) as Record<string, unknown>,
    trackInventory: row.trackInventory,
    quantity: row.trackInventory ? row.inventory?.quantity ?? 0 : null,
    reserved: row.trackInventory ? row.inventory?.reserved ?? 0 : null,
    available: row.archivedAt === null && (!row.trackInventory || trackedAvailable),
  };
}

function mapMedia(row: {
  position: number;
  altText: string | null;
  media: {
    id: string;
    url: string;
    mimeType: string;
    width: number | null;
    height: number | null;
  };
}): CatalogMedia {
  return {
    id: row.media.id,
    url: row.media.url,
    mimeType: row.media.mimeType,
    width: row.media.width,
    height: row.media.height,
    altText: row.altText,
    position: row.position,
  };
}

function mapProduct(row: {
  id: string;
  storeId: string;
  externalId: string | null;
  slug: string;
  title: string;
  description: string;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: string;
  store: { currency: string };
  variants: VariantRow[];
  media: Array<{
    position: number;
    altText: string | null;
    media: { id: string; url: string; mimeType: string; width: number | null; height: number | null };
  }>;
}): CatalogProduct {
  const variants = row.variants.map(mapVariant);
  const prices = variants.map(({ priceMinor }) => priceMinor);
  return {
    id: row.id,
    storeId: row.storeId,
    externalId: row.externalId,
    handle: row.slug,
    title: row.title,
    description: row.description,
    vendor: row.vendor,
    productType: row.productType,
    tags: row.tags,
    status: row.status as ProductStatus,
    media: row.media.map(mapMedia),
    variants,
    priceRange: prices.length === 0 ? null : {
      minMinor: Math.min(...prices),
      maxMinor: Math.max(...prices),
      currency: row.store.currency,
    },
    available: variants.some(({ available }) => available),
  };
}

const productInclude = {
  store: { select: { currency: true } },
  variants: {
    where: { archivedAt: null },
    orderBy: { createdAt: "asc" as const },
    include: { inventory: true },
  },
  media: {
    orderBy: { position: "asc" as const },
    include: { media: true },
  },
};

export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly client: PrismaClient) {}

  async getProduct(storeId: string, id: string): Promise<CatalogProduct | null> {
    const row = await this.client.product.findFirst({
      where: { storeId, id },
      include: productInclude,
    });
    return row ? mapProduct(row) : null;
  }

  async listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>> {
    const rows = await this.client.product.findMany({
      where: {
        storeId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.collectionId ? { collections: { some: { collectionId: input.collectionId } } } : {}),
        ...(input.query ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { slug: { contains: input.query, mode: "insensitive" } },
          ],
        } : {}),
        ...(input.cursor ? { id: { gt: input.cursor } } : {}),
      },
      include: productInclude,
      orderBy: { id: "asc" },
      take: input.limit + 1,
    });
    const hasNext = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    return {
      nodes: page.map(mapProduct),
      nextCursor: hasNext ? page.at(-1)?.id ?? null : null,
    };
  }

  async getVariant(storeId: string, id: string): Promise<CatalogVariant | null> {
    const row = await this.client.productVariant.findFirst({
      where: { storeId, id, archivedAt: null },
      include: { inventory: true },
    });
    return row ? mapVariant(row) : null;
  }

  async getCollection(storeId: string, id: string): Promise<CatalogCollection | null> {
    const row = await this.client.collection.findFirst({
      where: { storeId, id },
      include: { products: { orderBy: { position: "asc" } } },
    });
    return row ? {
      id: row.id,
      storeId: row.storeId,
      externalId: row.externalId,
      handle: row.slug,
      title: row.title,
      description: row.description,
      productIds: row.products.map(({ productId }) => productId),
    } : null;
  }

  async listCollections(storeId: string, input: ListCollectionsInput): Promise<Connection<CatalogCollection>> {
    const rows = await this.client.collection.findMany({
      where: {
        storeId,
        ...(input.query ? {
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { slug: { contains: input.query, mode: "insensitive" } },
          ],
        } : {}),
        ...(input.cursor ? { id: { gt: input.cursor } } : {}),
      },
      include: { products: { orderBy: { position: "asc" } } },
      orderBy: { id: "asc" },
      take: input.limit + 1,
    });
    const hasNext = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    return {
      nodes: page.map((row) => ({
        id: row.id,
        storeId: row.storeId,
        externalId: row.externalId,
        handle: row.slug,
        title: row.title,
        description: row.description,
        productIds: row.products.map(({ productId }) => productId),
      })),
      nextCursor: hasNext ? page.at(-1)?.id ?? null : null,
    };
  }
}
