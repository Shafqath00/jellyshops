// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

/**
 * Store pages must not import the main entries of @jelly/storefront-themes or @jelly/storefront-registry: those load
 * zod and every section definition (about 120 KB compressed). Use the `/runtime` entries instead; the editor, admin,
 * theme previews and tests may use the main entries.
 */
const app = path.join(__dirname, "..", "..");
const folders = ["packages/storefront-renderer/src", "packages/storefront-ui/src", "src/features/storefront", "src/features/commerce", "src/features/customers", "src/components", "src/contexts", "src/lib", "src/app/sites/[storeSlug]"];
const skip = /\.test\.|[\\/]settings-fuzz[\\/]|[\\/]design-lint[\\/]/;
const files = (folder: string): string[] => readdirSync(folder).flatMap((name) => {
  const full = path.join(folder, name);
  return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) && !skip.test(full) ? [full] : [];
});

it("keeps store pages on the runtime entries", () => {
  const offenders = folders.flatMap((folder) => files(path.join(app, folder)))
    .filter((file) => /from "@jelly\/storefront-(themes|registry)"/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(app, file));
  expect(offenders).toEqual([]);
});
