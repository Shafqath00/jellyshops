// Builds the "messy merchant" sample photos used by the theme previews' Messy sample data
// (jellyshops/src/features/theme-preview/messy-data.ts): the same kinds of photos real merchants
// upload — tall phone shots, wide banners, tiny low-resolution images, cut-outs on white and
// photos with their subject off-centre — cut from the themes' own illustrative images.
//   node scripts/build-messy-fixtures.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(new URL("../jellyshops/package.json", import.meta.url));
const sharp = require("sharp");
const source = (path) => new URL(`../jellyshops/public/themes/${path}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const out = new URL("../jellyshops/public/theme-preview/messy/", import.meta.url);
mkdirSync(out, { recursive: true });
const target = (name) => new URL(name, out).pathname.replace(/^\/([A-Z]:)/, "$1");

// name, source photo, width, height, fit, extra
const photos = [
  ["tall-phone.webp", "jelly-forma/sofa-v2.webp", 720, 1280, "cover"],          // 9:16 phone photo
  ["wide-banner.webp", "jelly-diode/desk.webp", 1500, 500, "cover"],             // 3:1 banner
  ["tiny.webp", "jelly-diode/headphones.webp", 220, 220, "cover"],               // low resolution
  ["portrait.webp", "jelly-forma/chair-v2.webp", 800, 1200, "cover"],            // 2:3
  ["landscape.webp", "jelly-forma/table-v2.webp", 1600, 900, "cover"],           // 16:9
  ["square.webp", "jelly-diode/keyboard.webp", 1000, 1000, "cover"],             // 1:1
  ["cutout-white.webp", "jelly-diode/speaker.webp", 900, 1100, "contain"],       // cut-out with white bars
  ["off-centre.webp", "jelly-forma/lamp-v2.webp", 1200, 800, "cover", "left"],   // subject at the edge
  ["bedroom-wide.webp", "jelly-resthaven/bedroom.png", 1800, 760, "cover"],      // very wide room shot
  ["detail-tall.webp", "jelly-forma/stool_detail-v2.webp", 600, 1400, "cover"],  // very tall detail
  ["charger-small.webp", "jelly-diode/charger.webp", 360, 300, "cover"],         // small and odd ratio
  ["vase-square.webp", "jelly-forma/vase-v2.webp", 1200, 1200, "cover"],
];

for (const [name, from, width, height, fit, position = "centre"] of photos) {
  const image = sharp(source(from)).resize({ width, height, fit, position, background: "#ffffff" });
  const info = await image.webp({ quality: 78 }).toFile(target(name));
  console.log(name, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)}KB`);
}
