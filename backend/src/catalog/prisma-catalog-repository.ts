import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type { CatalogSyncWriter, ProviderProductInput, ProviderSyncResult } from "./provider-sync.js";
import type { CatalogAdminRepository } from "./repository.js";
import type {
  CatalogCollection,
  CatalogMedia,
  CatalogProduct,
  CatalogVariant,
  CatalogVariantInput,
  Connection,
  CreateCollectionInput,
  CreateProductInput,
  ListCollectionsInput,
  ListProductsInput,
  ProductStatus,
  UpdateCollectionInput,
  UpdateProductInput,
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
  media: { id: string; url: string; mimeType: string; width: number | null; height: number | null };
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

async function replaceVariants(
  transaction: Prisma.TransactionClient,
  storeId: string,
  productId: string,
  variants: CatalogVariantInput[],
): Promise<void> {
  const existing = await transaction.productVariant.findMany({
    where: { storeId, productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map(({ id }) => id));
  const retainedIds = new Set<string>();

  for (const input of variants) {
    let variantId: string;
    if (input.id) {
      if (!existingIds.has(input.id)) throw new Error("Variant does not belong to this product");
      const updated = await transaction.productVariant.update({
        where: { id: input.id },
        data: {
          title: input.title,
          sku: input.sku ?? null,
          priceMinor: input.priceMinor,
          compareAtPriceMinor: input.compareAtPriceMinor ?? null,
          options: (input.options ?? {}) as Prisma.InputJsonValue,
          trackInventory: input.trackInventory ?? true,
          archivedAt: null,
        },
        select: { id: true },
      });
      variantId = updated.id;
    } else {
      const created = await transaction.productVariant.create({
        data: {
          storeId,
          productId,
          title: input.title,
          sku: input.sku ?? null,
          priceMinor: input.priceMinor,
          compareAtPriceMinor: input.compareAtPriceMinor ?? null,
          options: (input.options ?? {}) as Prisma.InputJsonValue,
          trackInventory: input.trackInventory ?? true,
        },
        select: { id: true },
      });
      variantId = created.id;
    }
    retainedIds.add(variantId);

    if (input.trackInventory ?? true) {
      await transaction.inventoryLevel.upsert({
        where: { storeId_variantId: { storeId, variantId } },
        create: {
          storeId,
          variantId,
          quantity: input.quantity ?? 0,
          reserved: input.reserved ?? 0,
        },
        update: {
          quantity: input.quantity ?? 0,
          reserved: input.reserved ?? 0,
        },
      });
    } else {
      await transaction.inventoryLevel.deleteMany({ where: { storeId, variantId } });
    }
  }

  const removedIds = existing.filter(({ id }) => !retainedIds.has(id)).map(({ id }) => id);
  if (removedIds.length > 0) {
    await transaction.inventoryLevel.deleteMany({ where: { storeId, variantId: { in: removedIds } } });
    await transaction.productVariant.deleteMany({ where: { storeId, productId, id: { in: removedIds } } });
  }
}

async function assertStoreProducts(
  transaction: Prisma.TransactionClient,
  storeId: string,
  productIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) return;
  const count = await transaction.product.count({ where: { storeId, id: { in: uniqueIds } } });
  if (count !== uniqueIds.length) throw new Error("Collection contains a product outside this store");
}

export class PrismaCatalogRepository implements CatalogAdminRepository, CatalogSyncWriter {
  constructor(private readonly client: PrismaClient) {}

  async getProduct(storeId: string, id: string): Promise<CatalogProduct | null> {
    const row = await this.client.product.findFirst({ where: { storeId, id }, include: productInclude });
    return row ? mapProduct(row) : null;
  }

  async listProducts(storeId: string, input: ListProductsInput): Promise<Connection<CatalogProduct>> {
    const rows = await this.client.product.findMany({
      where: {
        storeId,
        ...(input.status ? { status: input.status } : {}),
        ...(input.collectionId ? { collections: { some: { collectionId: input.collectionId } } } : {}),
        ...(input.query ? { OR: [
          { title: { contains: input.query, mode: "insensitive" } },
          { slug: { contains: input.query, mode: "insensitive" } },
        ] } : {}),
        ...(input.cursor ? { id: { gt: input.cursor } } : {}),
      },
      include: productInclude,
      orderBy: { id: "asc" },
      take: input.limit + 1,
    });
    const hasNext = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    return { nodes: page.map(mapProduct), nextCursor: hasNext ? page.at(-1)?.id ?? null : null };
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
        ...(input.query ? { OR: [
          { title: { contains: input.query, mode: "insensitive" } },
          { slug: { contains: input.query, mode: "insensitive" } },
        ] } : {}),
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

  async createProduct(storeId: string, input: CreateProductInput): Promise<CatalogProduct> {
    const productId = await this.client.$transaction(async (transaction) => {
      const product = await transaction.product.create({
        data: {
          storeId,
          slug: input.handle,
          title: input.title,
          description: input.description ?? "",
          vendor: input.vendor ?? null,
          productType: input.productType ?? null,
          tags: input.tags ?? [],
          status: input.status ?? "DRAFT",
        },
        select: { id: true },
      });
      await replaceVariants(transaction, storeId, product.id, input.variants ?? []);
      return product.id;
    });
    const product = await this.getProduct(storeId, productId);
    if (!product) throw new Error("Created product could not be loaded");
    return product;
  }

  async updateProduct(storeId: string, productId: string, input: UpdateProductInput): Promise<CatalogProduct> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.product.findFirst({ where: { storeId, id: productId }, select: { id: true } });
      if (!current) throw new Error("Product was not found");
      await transaction.product.update({
        where: { id: productId },
        data: {
          ...(input.handle !== undefined ? { slug: input.handle } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.vendor !== undefined ? { vendor: input.vendor } : {}),
          ...(input.productType !== undefined ? { productType: input.productType } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
        },
      });
      if (input.variants !== undefined) await replaceVariants(transaction, storeId, productId, input.variants);
    });
    const product = await this.getProduct(storeId, productId);
    if (!product) throw new Error("Updated product could not be loaded");
    return product;
  }

  async createCollection(storeId: string, input: CreateCollectionInput): Promise<CatalogCollection> {
    const collectionId = await this.client.$transaction(async (transaction) => {
      const productIds = input.productIds ?? [];
      await assertStoreProducts(transaction, storeId, productIds);
      const collection = await transaction.collection.create({
        data: {
          storeId,
          slug: input.handle,
          title: input.title,
          description: input.description ?? "",
        },
        select: { id: true },
      });
      if (productIds.length > 0) {
        await transaction.collectionProduct.createMany({
          data: [...new Set(productIds)].map((productId, position) => ({ storeId, collectionId: collection.id, productId, position })),
        });
      }
      return collection.id;
    });
    const collection = await this.getCollection(storeId, collectionId);
    if (!collection) throw new Error("Created collection could not be loaded");
    return collection;
  }

  async updateCollection(storeId: string, collectionId: string, input: UpdateCollectionInput): Promise<CatalogCollection> {
    await this.client.$transaction(async (transaction) => {
      const current = await transaction.collection.findFirst({ where: { storeId, id: collectionId }, select: { id: true } });
      if (!current) throw new Error("Collection was not found");
      await transaction.collection.update({
        where: { id: collectionId },
        data: {
          ...(input.handle !== undefined ? { slug: input.handle } : {}),
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
        },
      });
      if (input.productIds !== undefined) {
        await assertStoreProducts(transaction, storeId, input.productIds);
        await transaction.collectionProduct.deleteMany({ where: { storeId, collectionId } });
        const uniqueIds = [...new Set(input.productIds)];
        if (uniqueIds.length > 0) {
          await transaction.collectionProduct.createMany({
            data: uniqueIds.map((productId, position) => ({ storeId, collectionId, productId, position })),
          });
        }
      }
    });
    const collection = await this.getCollection(storeId, collectionId);
    if (!collection) throw new Error("Updated collection could not be loaded");
    return collection;
  }

  async upsertProviderProduct(storeId: string, input: ProviderProductInput): Promise<ProviderSyncResult> {
    return this.client.$transaction(async (transaction) => {
      const product = await transaction.product.upsert({
        where: { storeId_externalId: { storeId, externalId: input.externalId } },
        create: {
          storeId,
          externalId: input.externalId,
          slug: input.handle,
          title: input.title,
          description: input.description,
          vendor: input.vendor,
          productType: input.productType,
          tags: input.tags,
          status: input.status,
        },
        update: {
          slug: input.handle,
          title: input.title,
          description: input.description,
          vendor: input.vendor,
          productType: input.productType,
          tags: input.tags,
          status: input.status,
        },
        select: { id: true, externalId: true },
      });

      for (const variant of input.variants) {
        const storedVariant = await transaction.productVariant.upsert({
          where: { storeId_externalId: { storeId, externalId: variant.externalId } },
          create: {
            storeId,
            productId: product.id,
            externalId: variant.externalId,
            title: variant.title,
            sku: variant.sku,
            priceMinor: variant.priceMinor,
            compareAtPriceMinor: variant.compareAtPriceMinor,
            options: variant.options as Prisma.InputJsonValue,
            trackInventory: variant.trackInventory,
          },
          update: {
            productId: product.id,
            title: variant.title,
            sku: variant.sku,
            priceMinor: variant.priceMinor,
            compareAtPriceMinor: variant.compareAtPriceMinor,
            options: variant.options as Prisma.InputJsonValue,
            trackInventory: variant.trackInventory,
            archivedAt: null,
          },
          select: { id: true },
        });

        if (variant.trackInventory) {
          await transaction.inventoryLevel.upsert({
            where: { storeId_variantId: { storeId, variantId: storedVariant.id } },
            create: { storeId, variantId: storedVariant.id, quantity: variant.quantity ?? 0, reserved: variant.reserved ?? 0 },
            update: { quantity: variant.quantity ?? 0, reserved: variant.reserved ?? 0 },
          });
        } else {
          await transaction.inventoryLevel.deleteMany({ where: { storeId, variantId: storedVariant.id } });
        }
      }

      return { id: product.id, externalId: product.externalId! };
    });
  }
}
