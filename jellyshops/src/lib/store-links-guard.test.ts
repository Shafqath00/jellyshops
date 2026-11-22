// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

/**
 * Every link to a shop page must go through `storePath()` / `storeBase()` from @jelly/storefront-schema, so shops can
 * move to their own subdomains in one place (docs/plans/2026-11-22-subdomain-tenancy-plan.md, step 3). A hand-built
 * `/${storeSlug}/...` link would break there as `myshop.jellyshop.io/myshop/...`.
 */
const app = path.join(__dirname, "..", "..");
const folders = ["src", "packages/storefront-renderer/src", "packages/storefront-ui/src", "packages/storefront-themes/src", "packages/storefront-registry/src"];
const allowed = new Set([path.join("packages", "storefront-schema", "src", "store-links.ts")]);
const files = (folder: string): string[] => readdirSync(folder).flatMap((name) => {
  const full = path.join(folder, name);
  if (name === "node_modules" || name === "dist") return [];
  return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
});

// `/${storeSlug}`, `/${store.slug}`, `/${encodeURIComponent(context.storeSlug)}`, `/${activeStore?.slug}` and the like.
const STORE_EXPR = String.raw`(?:encodeURIComponent\()?[\w.?]*(?:storeSlug|[sS]tore\??\.slug)\b`;
const handBuilt = [new RegExp("`/\\$\\{" + STORE_EXPR), new RegExp(String.raw`["']/["']\s*\+\s*` + STORE_EXPR)];

it("builds every shop link with storePath()", () => {
  const offenders = folders
    .flatMap((folder) => files(path.join(app, folder)))
    .filter((file) => !allowed.has(path.relative(app, file)))
    .flatMap((file) => readFileSync(file, "utf8").split(/\r?\n/).flatMap((line, index) =>
      handBuilt.some((pattern) => pattern.test(line)) ? [`${path.relative(app, file)}:${index + 1}`] : []));
  expect(offenders).toEqual([]);
});

it("would catch the old pattern", () => {
  const samples = ["href={`/${store.slug}/cart`}", "`/${storeSlug}`", "`/${encodeURIComponent(context.storeSlug)}/shop`", "\"/\" + storeSlug"];
  for (const sample of samples) expect(handBuilt.some((pattern) => pattern.test(sample))).toBe(true);
  expect(handBuilt.some((pattern) => pattern.test("`/${product.slug}`"))).toBe(false);
});
