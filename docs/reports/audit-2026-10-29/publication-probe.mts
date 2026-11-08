// Audit reproduction only. All persistence is mocked; no shared data is changed.
import assert from 'node:assert/strict';
import { CompiledStorefrontPublicationService } from '../../../backend/src/storefront/publication/service.ts';
let current = 'publication-B';
const old = { id: 'publication-A' };
const service = new CompiledStorefrontPublicationService({ compile: async () => { throw new Error('Replay must not compile'); } } as any, {
  findByIdempotencyKey: async () => old,
  getCurrentPublicationId: async () => current,
  activate: async (_store: string, id: string) => { current = id; },
} as any);
await service.publish('audit-store', 1, 'old-key-A', 'audit-user');
assert.equal(current, 'publication-A');
console.log('CONFIRMED: replaying an old successful publication key replaces newer live publication B with A.');
