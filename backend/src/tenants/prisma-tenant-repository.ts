import { randomUUID } from "node:crypto";
import { ApiError } from "../http/errors.js";
import { Prisma, type PrismaClient } from "../generated/prisma/client.js";
import type { TenantRepository } from "./repository.js";
import type {
  CreateStoreInput,
  MerchantAccount,
  StoreRole,
  StoreSummary,
  VerifiedMerchantIdentity,
} from "./types.js";

function isKnownError(error: unknown, code: string): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function isSlugConflict(error: unknown): boolean {
  if (!isKnownError(error, "P2002")) return false;
  const meta = error.meta as
    | {
        modelName?: unknown;
        target?: unknown;
        constraint?: unknown;
        driverAdapterError?: { cause?: { constraint?: { index?: unknown } } };
      }
    | undefined;
  const target = meta?.target;
  const constraint = meta?.driverAdapterError?.cause?.constraint?.index ?? meta?.constraint;
  const identifiesSlug = Array.isArray(target)
    ? target.includes("slug")
    : String(target ?? constraint ?? "").toLowerCase().includes("slug");
  return meta?.modelName === "Store" && identifiesSlug;
}

export class PrismaTenantRepository implements TenantRepository {
  constructor(private readonly client: PrismaClient) {}

  async resolveMerchant(identity: VerifiedMerchantIdentity): Promise<MerchantAccount> {
    let user = await this.client.user.findUnique({
      where: { firebaseUid: identity.uid },
      select: { id: true },
    });

    if (!user) {
      try {
        user = await this.client.user.create({
          data: {
            firebaseUid: identity.uid,
            email: identity.email,
            name: identity.name,
          },
          select: { id: true },
        });
      } catch (error) {
        if (!isKnownError(error, "P2002")) throw error;
        user = await this.client.user.findUnique({
          where: { firebaseUid: identity.uid },
          select: { id: true },
        });
        if (!user) {
          throw new ApiError(
            409,
            "ACCOUNT_LINK_REQUIRED",
            "This verified email must be linked to its existing merchant account",
          );
        }
      }
    }

    return { id: user.id, stores: await this.listStores(user.id) };
  }

  async listStores(userId: number): Promise<StoreSummary[]> {
    const memberships = await this.client.storeMembership.findMany({
      where: {
        userId,
        store: { archivedAt: null },
      },
      include: { store: true },
      orderBy: { store: { createdAt: "asc" } },
    });

    return memberships.map(({ role, store }) => ({
      id: store.id,
      name: store.name,
      slug: store.slug,
      currency: store.currency,
      country: store.country,
      role: role as StoreRole,
    }));
  }

  async createStore(userId: number, input: CreateStoreInput): Promise<StoreSummary> {
    try {
      const store = await this.client.$transaction(async (transaction) => {
        const owner = await transaction.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!owner) {
          throw new ApiError(404, "MERCHANT_NOT_FOUND", "The merchant account was not found");
        }

        return transaction.store.create({
          data: {
            id: randomUUID(),
            name: input.name,
            slug: input.slug,
            currency: input.currency,
            country: input.country,
            commerceProvider: "NATIVE",
            settings: { create: { timezone: "UTC" } },
            memberships: { create: { userId, role: "OWNER" } },
          },
        });
      });

      return {
        id: store.id,
        name: store.name,
        slug: store.slug,
        currency: store.currency,
        country: store.country,
        role: "OWNER",
      };
    } catch (error) {
      if (isSlugConflict(error)) {
        throw new ApiError(409, "STORE_SLUG_TAKEN", "That store URL is already in use");
      }
      throw error;
    }
  }
}
