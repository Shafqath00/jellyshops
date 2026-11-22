// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";

/**
 * Admin links are written the old way ("/admin/orders") and turned into the current shop's address by the `Link`
 * and `useAdminRouter` from features/admin/admin-routing.tsx. A file that links to "/admin/…" with next/link's Link
 * or next/navigation's useRouter would send the merchant to a page without a shop.
 */
const app = path.join(__dirname, "..", "..", "..");
// Pages that never sit inside one shop's admin (sign-in, onboarding, "Add another store") link to "/admin", which opens
// the merchant's last shop, so they may use next/link and next/navigation as they are.
const allowed = new Set([
  "src/features/admin/admin-routing.tsx",
  "src/app/onboarding/page.tsx",
  "src/features/auth/components/auth-form.tsx",
  "src/features/auth/components/reset-password-form.tsx",
  "src/features/admin/new-store/new-store-form.tsx",
]);
const files = (folder: string): string[] => readdirSync(folder).flatMap((name) => {
  const full = path.join(folder, name);
  return statSync(full).isDirectory() ? files(full) : /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
});
const rel = (file: string) => path.relative(app, file).split(path.sep).join("/");
const adminArea = (file: string) => /^src\/(app\/admin|components\/admin|components\/layout)\//.test(file);
const linksToAdmin = (source: string) => /["'`]\/admin(?=["'`/?#])/.test(source);

it("keeps admin links on the shop-aware Link and router", () => {
  const offenders = files(path.join(app, "src"))
    .map((file) => ({ file: rel(file), source: readFileSync(file, "utf8") }))
    .filter(({ file, source }) => !allowed.has(file) && (adminArea(file) || linksToAdmin(source)))
    .filter(({ source }) => /from "next\/link"/.test(source) || /import \{[^}]*\buseRouter\b[^}]*\} from "next\/navigation"/.test(source))
    .map(({ file }) => file);
  expect(offenders).toEqual([]);
});
