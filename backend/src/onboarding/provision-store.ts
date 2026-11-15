import { CatalogPostgresRepository } from "../catalog/postgres-repository.js";
import { CatalogService } from "../catalog/service.js";
import type { CommerceDatabase, SqlExecutor } from "../commerce/repository.js";
import { MediaService } from "../media/service.js";
import { SqlMediaRepository } from "../media/sql-media-repository.js";
import type { MediaStorage } from "../media/storage.js";
import { StorefrontStarterInstallationService } from "../storefront/starter/installation-service.js";
import { SqlTaxonomyRepository } from "../taxonomy/sql-repository.js";
import { TaxonomyService } from "../taxonomy/service.js";
import { createOwnedStore } from "../tenants/postgres-repository.js";
import { MARKET_CURRENCIES } from "../tenants/settings.js";
import type { CompleteOnboardingAnswers } from "./schema.js";

function productHandle(title: string): string {
  return title.normalize("NFKD").toLowerCase().replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").slice(0, 80).replace(/^-+|-+$/g, "") || "first-product";
}

export function createOnboardingProvisioner(storage: MediaStorage) {
  return async (
    sql: SqlExecutor,
    userId: string,
    answers: CompleteOnboardingAnswers,
    logo: Buffer | null,
    registerRollback: (cleanup: () => Promise<void>) => void,
  ) => {
    // Repositories that normally start a transaction share this one during provisioning.
    const transaction: CommerceDatabase = { transaction: (work) => work(sql) };
    const store = await createOwnedStore(sql, userId, {
      name: answers.name,
      slug: answers.slug,
      country: answers.country,
      currency: MARKET_CURRENCIES[answers.country]!,
    });

    await sql.query(
      `UPDATE "StoreSettings" SET "description"=$2, "category"=$3, "businessType"=$4,
        "contactEmail"=$5, "timezone"=COALESCE($6, "timezone") WHERE "storeId"=$1`,
      [store.id, answers.description ?? "", answers.category ?? "", answers.businessType ?? "",
        answers.contactEmail ?? null, answers.timezone ?? null],
    );

    await new StorefrontStarterInstallationService(transaction).install(store.id, answers.theme);
    if (answers.description) {
      const about = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: answers.description }] }] };
      await sql.query(`UPDATE "StorePage" SET "content"=$2::jsonb WHERE "storeId"=$1 AND "handle"='about' AND "status"='DRAFT'`,
        [store.id, JSON.stringify(about)]);
    }

    const taxonomy = new TaxonomyService(new SqlTaxonomyRepository(transaction));
    const categoryIds: string[] = [];
    if (answers.productCategories?.length) {
      const { categories } = await taxonomy.tree(store.id);
      const byName = new Map(categories.filter(category => !category.parentId).map(category => [category.name.toLowerCase(), category.id]));
      for (const name of answers.productCategories) {
        const key = name.toLowerCase();
        const id = byName.get(key) ?? (await taxonomy.createCategory(store.id, { name })).id;
        if (!categoryIds.includes(id)) categoryIds.push(id);
        byName.set(key, id);
      }
    }

    if (answers.product) {
      const { title, priceMinor, stock } = answers.product;
      const repository = new CatalogPostgresRepository(sql);
      await new CatalogService(repository, repository).createProduct(store.id, {
        title, handle: productHandle(title), status: "DRAFT",
        primaryCategoryId: categoryIds[0] ?? null, additionalCategoryIds: categoryIds.slice(1),
        variants: [{ title: "Default", priceMinor, trackInventory: stock != null, quantity: stock ?? null }],
      });
    }

    // Upload last. MediaService cleans up its own partial writes; the outer transaction
    // removes completed objects if any subsequent database operation rolls back.
    if (logo) {
      const media = new MediaService(new SqlMediaRepository(sql), {
        open: (key) => storage.open(key),
        remove: (key) => storage.remove(key),
        async put(input) {
          const key = await storage.put(input);
          registerRollback(() => storage.remove(key));
          return key;
        },
      });
      const image = await media.upload(store.id, { buffer: logo, originalname: "store-logo.webp" } as Express.Multer.File);
      await sql.query(
        `UPDATE "ThemeConfiguration"
         SET "settings"=jsonb_set("settings", '{branding}',
           COALESCE("settings"->'branding', '{}'::jsonb) || jsonb_build_object('logoUrl', $2::text), true)
         WHERE "storeId"=$1`,
        [store.id, image.url],
      );
    }

    return store;
  };
}
