# Resthaven bright photos: handoff for the next developer

Date: 2026-11-15. Branch `redesign/jelly-shop-ui`. The bright Resthaven look, home page and new sections are built and committed. Five of the bright photos exist; ten more are needed. The first developer's ChatGPT account ran out of image allowance (free plan), so this is passed on.

## The prompt to give your assistant

Copy everything in this block.

````text
You are continuing the "bright Resthaven" photography for the Jelly Shops repo (Windows, Git Bash). Read docs/handoff/resthaven-bright-photos.md first and follow it. Summary:

1. In ChatGPT (image generation), make the 10 remaining photos listed in the handoff file, one at a time, with the exact prompts there. Start the chat by attaching jellyshops/packages/storefront-themes/src/themes/jelly-resthaven/assets/bright-hero.webp and bright-beds.webp as style references and paste the house-style paragraph first, so every new photo matches the five that exist. If ChatGPT says you are out of images, stop, tell me when it resets, and do the rest then.
2. Save each photo as a PNG in a new folder outside the repo (for example C:\Users\<me>\Downloads\resthaven-bright-2\), named after the file in the table.
3. Convert with: node scripts/resthaven-photos-to-webp.mjs <png> <name> [<png> <name> ...]
4. Point jellyshops/packages/storefront-themes/src/themes/jelly-resthaven/starter.json at the new photos, using the "Where it goes" column (change both image.url and image.alt; keep ids). Move the three Shop the look pins to sit on the bed, the bedside table and the rug in the new room photo.
5. Run the commands under "After the photos are wired in", look at the home page at 1280px and 390px, and fix anything that looks wrong.
6. Update ASSETS.md and SOURCES.md next to the theme (prompts made, what is still to make). Commit with a "feat:" message. Do not push unless I ask. Do not change the theme's id or version. Do not touch files outside this task; the working tree holds other people's unfinished work (commit only the files you changed, with explicit git add paths).
````

## House style (paste first in ChatGPT)

> House style for a series of photos for a bright, calm UK bedroom and bedding store called Resthaven: realistic lifestyle photography, soft bright morning daylight, airy and cheerful, palette of warm linen white, soft sky blue, pale blush, sage green and a touch of coral; consistent natural light and gentle colour grading; no text, no logos, no people's faces.

Keep the palette exactly. The earlier photos in this theme are beige and oat; the new ones are the sunny blue-and-blush set.

## Photos still to make (10)

All files are saved as `<name>.webp`, 1536 px wide, by `scripts/resthaven-photos-to-webp.mjs`.

| # | Name | Shape | Prompt (after the house style) | Where it goes in `starter.json` (now uses) |
| --- | --- | --- | --- | --- |
| 1 | `bright-decor` | square 1:1 | A soft textured cream and sky-blue rug on a pale oak floor beside the corner of a bed, a small ceramic lamp on a bedside table, bright morning light. | Home > category tile `resthaven-category-decor` (`rug`) |
| 2 | `bright-sale` | square 1:1 | A coral wool throw folded across the end of a white-bedded bed, a blush cushion beside it, bright morning light, soft background. | Home > category tile `resthaven-category-sale` (`wool-throw`); also gallery photo 6 `resthaven-gallery-6` |
| 3 | `bright-room-look` | landscape 4:3 | A wide view of a sunny main bedroom: a sky-blue upholstered bed with blush bedding in the centre, a light oak bedside table with a lamp on the left, a cream woven rug on the floor in front, a window with sheer curtains, pale oak floor. Everything clearly visible so product pins can sit on the bed, the bedside table and the rug. | Home > `resthaven-shop-look` section image (`room-main`) |
| 4 | `bright-fabrics` | landscape 4:3 | A flat lay of upholstery fabric swatches in sky blue, blush, sage and cream (linen, boucle and velvet) on a light oak table, soft daylight, a sprig of eucalyptus. | Home > `resthaven-fabric-story` image (`fabrics`) |
| 5 | `bright-story` | landscape 4:3 | Close-up of hand-finished stitching and piping on a sky-blue upholstered headboard, a blush pillow in the corner, soft morning light, shallow depth of field. | Home > `resthaven-brand-story` image (`detail`) |
| 6 | `bright-room-main` | landscape 4:3 | A bright main bedroom with an upholstered bed in sky-blue linen, white and blush bedding, morning light, oak floor. | Large menu tile `resthaven-menu-12` (`room-main`) |
| 7 | `bright-room-guest` | landscape 4:3 | A bright guest room with a sage-green ottoman storage bed, its base lifted to show the storage, white bedding, oak floor, morning light. | Large menu tile `resthaven-menu-13` (`room-guest`); gallery photo 3 `resthaven-gallery-3` |
| 8 | `bright-room-kids` | landscape 4:3 | A bright children's bedroom with a white single bed, pale-blue and blush bedding, a small oak shelf with books, morning light. | Large menu tile `resthaven-menu-14` (`room-kids`); gallery photo 1 `resthaven-gallery-1` |
| 9 | `bright-bed-sage` | square 1:1 | A sage-green upholstered bed with a winged headboard, white and blush bedding, bright morning light. | Gallery photo 2 `resthaven-gallery-2` (`harbour-sage`) |
| 10 | `bright-daybed` | square 1:1 | A pale-blue upholstered daybed with cushions in blush and coral against a bright wall, morning light. | Gallery photo 4 `resthaven-gallery-4` (`ivy-daybed`) |

The menu tiles are the three "Main bedroom / Guest room / Kids room" photos in the Beds menu (`menus[0].items[0]` in `starter.json`).

Already done (do not redo): `bright-hero`, `bright-beds`, `bright-mattresses`, `bright-bedding`, `bright-pillows` (their prompts are in `ASSETS.md`).

Later, optional: bright photos for the 24 demo-store products (`demo-content.json`, two photos each for the hover effect) and for the theme preview's sample beds. Not part of this task.

### Tips for ChatGPT

- The free plan allows about five images a day; Plus has no such limit. If it says "You're out of images", it also says when it resets.
- Generate one photo per message. If one drifts from the palette (beige instead of blue and blush), say "same style, more sky blue and blush" and regenerate.
- Download each image (the download arrow on the image), keep the PNG, and check it has no text or faces.

## After the photos are wired in

From the repo root, in Git Bash:

```bash
node scripts/resthaven-photos-to-webp.mjs <png> <name> [<png> <name> ...]
node scripts/generate-theme-assets.mjs jelly-resthaven     # copies photos to public/ and makes the -640 and -1024 copies
node scripts/generate-theme-index.mjs                       # refreshes starters.generated.ts
cd jellyshops
npm run build:storefront-packages
node ../scripts/validate-theme.mjs packages/storefront-themes/src/themes/jelly-resthaven
npx vitest run src/app/themes packages/storefront-themes src/features/store-editor/template-gallery.test.ts
```

Look at the result:

```bash
node jellyshops/packages/theme-cli/bin/jelly-theme.mjs dev jellyshops/packages/storefront-themes/src/themes/jelly-resthaven
# open http://localhost:5273/frame.html?template=home at 1280px and 390px wide
```

Check: the category tiles all match (no beige tile among the blue-and-blush ones), the Shop the look pins sit on the right objects, the hero and menu tiles load, nothing scrolls sideways.

Then the browser tests (if a dev server is already running on port 3000, a temporary Playwright config with only `baseURL` avoids starting a second one; this machine runs out of memory with two):

```bash
cd jellyshops
npx playwright test e2e/jelly-resthaven-theme.spec.ts      # expect 18 passed
npx playwright test e2e/design-lint.spec.ts                # expect all passed (about 5 minutes)
```

Finally repack the shared packages for the backend (the photos are not in the packages, but the starter is):

```bash
node scripts/prepare-shared-packages.mjs
cd backend && rm -rf node_modules/@jelly && npm install
```

If `backend/package-lock.json` gets many unrelated changes (`libc` entries), commit only the changed `integrity` lines of `@jelly/storefront-registry` and `@jelly/storefront-themes`. Rules that always apply:

- Never change the theme's `id` (`jelly-resthaven`) or `version`.
- Do not edit `layout-history.json` for photo changes (stores on the current layout simply get the new photos).
- Stores that already installed Resthaven keep their own copy of the photos they chose; only new installs get these.
- Commit style: `feat:` with a short body. Add the Co-Authored-By trailer your tool gives you.

## What exists today (so you know the state)

- Look "Morning sky": linen `#FBF7F1`, navy `#1F2A44`, sky `#3D6E96`, coral `#F2A488`, clay `#B5452B`; Fraunces and Figtree. Research and plan: `RESEARCH.md` at the repo root.
- Home page: 15 sections (layout revision 6). New sections: Shop the look, Featured product, rotating announcement bar, reviews carousel, footer payment methods.
- Animations: scroll reveal and smooth scrolling (theme settings, on for Resthaven).
- Checks: Resthaven spec 18/18 and the full design lint pass.
- Not yet pushed to GitHub.
