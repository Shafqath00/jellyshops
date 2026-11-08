// Audit reproduction only. Uses an in-memory repository, no browser or shared data.
import assert from 'node:assert/strict';
import { createRepository, memoryStorage } from '../../../jellyshops/src/lib/repository.ts';
const repo = createRepository(memoryStorage());
const store = repo.getState().stores[0];
const product = repo.getState().products.find(p => p.storeId === store.id)!;
const variant = product.variants[0];
const cart = repo.createCart(store.slug);
repo.updateCartItem(cart.id, variant.id, 1);
repo.replaceCatalog(store.id, []);
assert.throws(() => repo.updateCartItem(cart.id, variant.id, 0), /VARIANT_NOT_FOUND/);
assert.equal(repo.getCartForStore(store.slug)!.items.length, 1);
console.log('CONFIRMED: removing a stale cart line throws VARIANT_NOT_FOUND and retains the line.');
