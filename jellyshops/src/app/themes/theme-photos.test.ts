// @vitest-environment node
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cardPhotoSrcSet, THEME_PHOTO_ORIGINAL_WIDTH, THEME_PHOTOS_WITH_COPIES } from "@jelly/storefront-ui";

const publicThemes = path.join(__dirname, "..", "..", "..", "public", "themes");
const originals = (theme: string) => readdirSync(path.join(publicThemes, theme)).filter((name) => /^[a-z0-9-]+\.webp$/.test(name) && !/-(640|1024)\.webp$/.test(name));

describe("theme photos with smaller copies", () => {
  it("lists the copies phones download, in order, with the original last", () => {
    expect(cardPhotoSrcSet("/themes/jelly-resthaven/hero.webp")).toBe(`/themes/jelly-resthaven/hero-640.webp 640w, /themes/jelly-resthaven/hero-1024.webp 1024w, /themes/jelly-resthaven/hero.webp ${THEME_PHOTO_ORIGINAL_WIDTH}w`);
  });

  it("leaves other photos alone: copies themselves, other themes, uploaded themes, other file types", () => {
    for (const url of ["/themes/jelly-resthaven/hero-640.webp", "/themes/jelly-halo/hero.webp", "/themes/jelly-studio/hero.webp", "/themes/jelly-resthaven/bedroom.png", "https://example.com/themes/jelly-resthaven/hero.webp"]) expect(cardPhotoSrcSet(url), url).toBeUndefined();
  });

  it.each([...THEME_PHOTOS_WITH_COPIES])("%s: every photo is the assumed width and has both copies in public/", async (theme) => {
    const files = originals(theme);
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      const base = file.replace(/\.webp$/, "");
      expect((await sharp(path.join(publicThemes, theme, file)).metadata()).width, file).toBe(THEME_PHOTO_ORIGINAL_WIDTH);
      for (const size of [640, 1024]) {
        const copy = path.join(publicThemes, theme, `${base}-${size}.webp`);
        expect(existsSync(copy), `${base}-${size}.webp (run node scripts/generate-theme-assets.mjs ${theme})`).toBe(true);
        expect((await sharp(copy).metadata()).width).toBe(size);
        expect(statSync(copy).size).toBeLessThan(statSync(path.join(publicThemes, theme, file)).size);
      }
    }
  });
});
