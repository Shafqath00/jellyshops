# Home page image audit (2026-11-15)

Checked on the running app (`/`, port 3210) at 1440x900 and 390x844, dark and light mode, with Playwright: every `<img>` on the page (shown size, file size, `object-fit`, and the border, ring, background and padding on the image and its two nearest frames), section screenshots, and 2x zooms of the hero frame edge. Each file was also read pixel by pixel: alpha, colour saturation and the brightness of its outer 2px ring (to catch white mattes and halos baked into the file).

## What the files themselves show

- **All 24 images are opaque, with no transparency, and fully greyscale** (average saturation 0): they were made for the earlier black-and-white direction.
- **No file has a white matte or halo.** Every outer ring is near-black (average brightness 3 to 19 out of 255; no edge pixel brighter than 200). The white edges seen on the page come from CSS, not from the images.
- Template previews are light store pages inside a near-black frame, so on the page each card is a dark rectangle with a light picture inside.

## Where white edges and hard edges come from

| Where | Cause | Fix |
| --- | --- | --- |
| Hero picture (`.heroFrame`) | `border: 1px` at 18% white **plus** a 6px light ring (`box-shadow: 0 0 0 6px` at 3% white). At 2x zoom this reads as a pale grey rim around the dark picture in dark mode, and a grey ring around a black block in light mode. The laptop in the picture also has a bright white bezel glow drawn into the image. | Remove the border and ring; blend the picture into the page with a mask that fades its bottom and sides; new picture without a bright bezel. |
| "How it works" inline pictures (`.howInlineImage`, phone and tablet) | 1px light border, `object-fit: fill` (stretches when the box ratio differs). | `object-fit: cover`, same radius as the other cards, no light border. |
| "How it works" pinned picture (`.howImage`) | 1px border at 18% white on a `#050505` frame. | Same treatment as the hero. |
| Avatars | 1px light border round a dark circle. | Remove the border; new colour avatars. |
| Every picture in **light mode** | Near-black pictures on a `#FAFAFA` page give hard black rectangles. | New pictures on the colour palette; frames get a soft colour tint and fade instead of a hard edge. |

## Image by image

| File | Used in | Problems | Action |
| --- | --- | --- | --- |
| `bg-hero-grid.webp` (1600x1067) | Hero background (masked) | Grey grid only, flat; shown at 1440x1313 (stretched up); no colour or depth | **Regenerate** as a vibrant 16:9 background, 2400px wide |
| `hero-dashboard-storefront.webp` (1536x1024) | Hero product shot | Greyscale; light ring and border around it; white laptop bezel glow; shown 1198px wide on a 2x screen from a 1536px file (soft); shows the old name "Jelly Shop" | **Regenerate** in colour with "Jellyshop", 2400px wide |
| `feature-storefront/-products/-checkout/-orders/-analytics/-marketing.webp` (1200x800) | Bento grid, "How it works", tour dialog | Greyscale; cropped hard (387x633 cut from a 3:2 image); inline copies stretched (`fill`) | **Regenerate** in colour, one style |
| `template-forma/-halo/-diode/-avenue/-resthaven/-harbour.webp` (1200x800) | Store designs gallery | Greyscale previews of designs that are in colour on the live store, which undersells them; dark frame around a light page | **Regenerate** in colour (each design's own palette) |
| `avatar-1/-2/-3.webp` (192x192) | Merchant stories | Greyscale; light border | **Regenerate** in colour, no border |
| `bg-cta-glow.webp` (1600x1067) | Final call to action background | Grey glow only | **Regenerate** in colour (or replace with a CSS gradient) |
| `og-image.jpg` (1200x630) | Social sharing card | Greyscale; old name | **Regenerate** in colour with "Jellyshop" |
| `auth-visual.webp`, `onboarding-*.webp` | Sign-in and onboarding | Greyscale (made earlier today for the black-and-white direction) | **Regenerate** in colour (after the hero is approved) |

## Other things found

- **Counters stuck at zero with reduced motion** (proof band "0 store designs", stories "+0%"): `Counter` reset the text to 0 on the first render and never restored it once reduced motion turned on. Fixed in `features/brand/motion.tsx`.
