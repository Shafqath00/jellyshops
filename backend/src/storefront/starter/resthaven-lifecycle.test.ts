import { expect, it } from 'vitest';
import { createPGliteDatabase, seedStore } from '../../../test/integration/pglite.js';
import type { CommerceDatabase, SqlExecutor } from '../../commerce/repository.js';
import { StorefrontStarterInstallationService } from './installation-service.js';
import { createSqlWorkspaceApi } from '../workspace/sql-repositories.js';
import { createLocalV4CompilationService } from '../local-v4-compilation.js';
import { CompiledStorefrontPublicationService } from '../publication/service.js';
import { SqlCompiledPublicationRepository } from '../publication/sql-repository.js';

it('installs Resthaven, saves merchant edits, publishes and keeps the publication immutable', async () => {
  const database = await createPGliteDatabase();
  try {
    await seedStore(database, 'resthaven-store', 'resthaven');
    const commerce = { transaction: (work: never) => database.transaction(work) } as unknown as CommerceDatabase;
    const installer = new StorefrontStarterInstallationService(commerce);
    await installer.install('resthaven-store', 'jelly-resthaven');
    const api = createSqlWorkspaceApi(commerce);
    const current = await api.getThemeConfiguration('resthaven-store');
    expect(current?.themeId).toBe('jelly-resthaven');
    const edited = await api.saveThemeConfiguration('resthaven-store', current!.revision, {
      themeId: 'jelly-resthaven', themeVersion: '1.0.0', settings: { colors: { accent: '#48385c' } }, draftArtifactId: null,
    });
    const sql = database as unknown as SqlExecutor;
    const repository = new SqlCompiledPublicationRepository(sql);
    const publisher = new CompiledStorefrontPublicationService(createLocalV4CompilationService(sql), repository);
    const published = await publisher.publish('resthaven-store', edited.generation, 'resthaven-first', 'merchant');
    expect(published.ok).toBe(true);
    if (!published.ok) throw new Error(JSON.stringify(published.diagnostics));
    expect(published.publication.snapshot.theme).toMatchObject({ id: 'jelly-resthaven', version: '1.0.0', settings: { colors: { accent: '#48385c' } } });
    expect(await repository.getCurrentPublicationId('resthaven-store')).toBe(published.publication.id);
    await api.saveThemeConfiguration('resthaven-store', edited.theme.revision, {
      themeId: 'jelly-resthaven', themeVersion: '1.0.0', settings: { colors: { accent: '#352d32' } }, draftArtifactId: null,
    });
    expect((await repository.getCurrent('resthaven-store'))?.snapshot.theme.settings.colors).toMatchObject({ accent: '#48385c' });
  } finally { await database.close(); }
}, 30000);
