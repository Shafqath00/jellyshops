#!/usr/bin/env node
/**
 * Express Bed photos (docs/express-bed/image-prompts.md, list in images.json).
 *
 *   node scripts/express-bed/images.mjs placeholders   labelled stand-ins for every photo not yet delivered
 *   node scripts/express-bed/images.mjs import         converts the PNGs in jellyshops/public/images/express-bed/incoming/
 *
 * Both write jellyshops/public/images/express-bed/<name>.webp at the photo's shape and width (WebP quality 80).
 * A placeholder is the closest Resthaven photo, cropped to the right shape, with "Placeholder · <name>" written on it;
 * import replaces it with the real photo (centre-cropped to the same shape) and never overwrites a real photo with a
 * placeholder again (real photos are listed in public/images/express-bed/delivered.json).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sharp = createRequire(path.join(root, "jellyshops", "package.json"))("sharp");
const out = path.join(root, "jellyshops", "public", "images", "express-bed");
const incoming = path.join(out, "incoming");
const assets = path.join(root, "jellyshops", "packages", "storefront-themes", "src", "themes", "jelly-resthaven", "assets");
const { images } = JSON.parse(readFileSync(new URL("./images.json", import.meta.url), "utf8"));
const deliveredFile = path.join(out, "delivered.json");
const delivered = new Set(existsSync(deliveredFile) ? JSON.parse(readFileSync(deliveredFile, "utf8")) : []);

const size = ({ ratio, width }) => {
  const [w, h] = ratio.split(":").map(Number);
  return { width, height: Math.round((width * h) / w) };
};

function label(name, ratio, width, height) {
  const scale = Math.max(1, width / 1200);
  const fontSize = Math.round(20 * scale);
  const text = `Placeholder · ${name}.png · ${ratio}`;
  const boxWidth = Math.round(text.length * fontSize * 0.58 + 40 * scale);
  const boxHeight = Math.round(fontSize * 2.1);
  const x = Math.round(24 * scale);
  const y = height - boxHeight - Math.round(24 * scale);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="${boxHeight / 2}" fill="#101A3A" fill-opacity="0.82"/>
    <text x="${x + 20 * scale}" y="${y + boxHeight * 0.66}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700" fill="#FFD84D">${text}</text>
  </svg>`);
}

async function placeholders() {
  mkdirSync(out, { recursive: true });
  for (const image of images) {
    if (delivered.has(image.name)) { console.log(`${image.name}: real photo kept`); continue; }
    const { width, height } = size(image);
    const source = path.join(assets, `${image.standIn}.webp`);
    const info = await sharp(source).resize({ width, height, fit: "cover", position: "attention" })
      .composite([{ input: label(image.name, image.ratio, width, height) }])
      .webp({ quality: 78 }).toFile(path.join(out, `${image.name}.webp`));
    console.log(`${image.name}.webp  ${info.width}x${info.height}  placeholder from ${image.standIn}`);
  }
}

async function importPhotos() {
  if (!existsSync(incoming)) { console.error(`Put the PNGs in ${incoming}`); process.exit(1); }
  const files = readdirSync(incoming).filter((file) => /\.(png|jpe?g|webp)$/i.test(file));
  for (const file of files) {
    const name = file.replace(/\.(png|jpe?g|webp)$/i, "");
    const image = images.find((entry) => entry.name === name);
    if (!image) { console.warn(`Skipped ${file}: not in images.json (check the file name)`); continue; }
    const { width, height } = size(image);
    const info = await sharp(path.join(incoming, file)).resize({ width, height, fit: "cover", position: "attention" }).webp({ quality: 80 }).toFile(path.join(out, `${name}.webp`));
    delivered.add(name);
    console.log(`${name}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} KB`);
  }
  writeFileSync(deliveredFile, `${JSON.stringify([...delivered].sort(), null, 2)}\n`);
  const missing = images.filter((image) => !delivered.has(image.name)).map((image) => image.name);
  console.log(missing.length ? `Still placeholders: ${missing.join(", ")}` : "Every photo is delivered.");
}

const mode = process.argv[2];
if (mode === "placeholders") await placeholders();
else if (mode === "import") await importPhotos();
else { console.error("Usage: node scripts/express-bed/images.mjs placeholders | import"); process.exit(1); }
