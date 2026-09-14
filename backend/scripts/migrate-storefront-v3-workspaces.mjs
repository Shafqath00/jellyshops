import 'dotenv/config';
import { createDatabase } from '../dist/database/client.js';
import {
  buildV3ImportPlan,
  PrismaV3StorefrontImporter,
} from '../dist/storefront/migration/import-v3.js';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const storeId = argument('--store');
const apply = process.argv.includes('--apply');

if (!storeId) {
  console.error('Usage: node scripts/migrate-storefront-v3-workspaces.mjs --store <store-id> [--apply]');
  process.exitCode = 2;
} else if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. The script defaults to dry-run unless --apply is supplied.');
  process.exitCode = 2;
} else {
  const database = createDatabase(process.env.DATABASE_URL);
  try {
    const store = await database.client.store.findFirst({
      where: { id: storeId, archivedAt: null },
      select: {
        id: true,
        currentPublicationId: true,
        draft: { select: { document: true } },
        currentPublication: { select: { schemaVersion: true, document: true } },
        workspace: { select: { generation: true } },
      },
    });
    if (!store) throw new Error(`Store ${storeId} was not found`);
    if (store.workspace) {
      throw new Error(`Store ${storeId} already has a normalized workspace at generation ${store.workspace.generation}`);
    }

    const source = store.draft?.document ?? store.currentPublication?.document;
    if (!source) throw new Error(`Store ${storeId} has no V3 draft or publication to import`);
    const plan = buildV3ImportPlan(source);

    if (!apply) {
      console.log(JSON.stringify({
        mode: 'dry-run',
        storeId,
        currentPublicationId: store.currentPublicationId,
        sourcePublicationSchemaVersion: store.currentPublication?.schemaVersion ?? null,
        generation: plan.workspaceGeneration,
        templates: plan.templates.length,
        globalSections: plan.globalSections.length,
        pages: plan.pages.length,
        assignments: plan.assignments.length,
      }, null, 2));
      console.log('No data was written. Re-run with --apply after reviewing this plan.');
    } else {
      const importer = new PrismaV3StorefrontImporter(database.client);
      const result = await importer.import(source);
      console.log(JSON.stringify({ mode: 'applied', ...result }, null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}
