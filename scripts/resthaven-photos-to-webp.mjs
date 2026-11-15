// Turns photos generated for Resthaven into the theme's WebP assets.
//
//   node scripts/resthaven-photos-to-webp.mjs <photo.png> <name> [<photo.png> <name> ...]
//
// Each pair writes jellyshops/packages/storefront-themes/src/themes/jelly-resthaven/assets/<name>.webp, 1536 px wide,
// WebP quality 80. Names are lowercase letters, digits and dashes (for example bright-decor).
// Every Resthaven photo is 1536 px wide because the storefront builds its smaller copies (-640, -1024) from that width
// (THEME_PHOTO_ORIGINAL_WIDTH in storefront-ui). After this, run: node scripts/generate-theme-assets.mjs jelly-resthaven
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(path.join(root, "jellyshops", "package.json"))("sharp");
const assets = path.join(root, "jellyshops", "packages", "storefront-themes", "src", "themes", "jelly-resthaven", "assets");

const args = process.argv.slice(2);
if (args.length === 0 || args.length % 2 !== 0) {
  console.error("Usage: node scripts/resthaven-photos-to-webp.mjs <photo.png> <name> [<photo.png> <name> ...]");
  process.exit(1);
}
for (let index = 0; index < args.length; index += 2) {
  const [source, name] = [args[index], args[index + 1]];
  if (!existsSync(source)) { console.error(`Not found: ${source}`); process.exit(1); }
  if (!/^[a-z0-9-]+$/.test(name)) { console.error(`Bad name "${name}": use lowercase letters, digits and dashes`); process.exit(1); }
  const info = await sharp(source).resize({ width: 1536 }).webp({ quality: 80 }).toFile(path.join(assets, `${name}.webp`));
  console.log(`${name}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
}
