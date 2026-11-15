# Resthaven bright photography: prompt log

Generated with ChatGPT image generation (the user's own account, free plan) on 15 November 2026, in one conversation, so every photo shares one house style. The first five were made on a free plan; the other ten followed (see "Made on 15 November 2026, second batch").

PNG originals were encoded as WebP (quality 80, 1536 px wide) with Sharp and saved in `assets/` as `bright-*.webp`. The PNGs are in the user's Downloads folder as `resthaven-bright-*.png`. All are illustrative images, not photographs of merchant inventory. Replace them with real product photography before selling.

## House style (sent first, with photo 1)

> House style for a series of 20+ photos for a bright, calm UK bedroom and bedding store called Resthaven: realistic lifestyle photography, soft bright morning daylight, airy and cheerful, palette of warm linen white, soft sky blue, pale blush, sage green and a touch of coral; consistent natural light and gentle colour grading; no text, no logos, no people's faces.

## Made

| File | Used for | Prompt after the house style |
| --- | --- | --- |
| `bright-hero.webp` (16:9) | Home hero | Photo 1 (hero, wide 16:9): a bright bedroom in the morning, an upholstered sky-blue linen bed with a tall headboard, white and blush bedding, a window with sheer curtains letting in sunshine, a light oak bedside table with a small plant, pale oak floor, lots of light space on the left side of the frame for text. |
| `bright-beds.webp` (1:1) | Beds category tile | Photo 2 (square 1:1): close crop of a sky-blue upholstered bed with a winged headboard, white and blush bedding, bright morning light, soft background. |
| `bright-mattresses.webp` (1:1) | Mattresses tile, mattress story | Photo 3 (square 1:1): cut-away corner of a pocket-sprung mattress showing white quilted cover, soft sky-blue comfort layer and springs, resting on a light oak bed base, bright airy morning light. |
| `bright-bedding.webp` (1:1) | Bedding tile, offer banner | Photo 4 (square 1:1): folded washed-linen bedding set in pale blush and soft sky blue stacked on a light oak bench, sage plant beside it, bright morning light. |
| `bright-pillows.webp` (1:1) | Pillows tile | Photo 5 (square 1:1): two plump white and pale-blue pillows stacked against a light oak headboard, crisp white sheet, soft morning window light. |

## Made on 15 November 2026, second batch

Made in ChatGPT (Plus plan), one fresh chat per photo with `bright-hero.webp` and `bright-beds.webp` attached as style references, the house style above and "Create one single image (not a collage)". A first attempt that reused one chat drifted into a three-panel collage for photo 3, which is why each photo has its own chat. Converted with `node scripts/resthaven-photos-to-webp.mjs <png> <name>`; the PNGs are in `Downloads/resthaven-bright-2/`.

| File | Shape | Used for | Prompt after the house style |
| --- | --- | --- | --- |
| `bright-decor.webp` | 1:1 | Decor category tile | A soft textured cream and sky-blue rug on a pale oak floor beside the corner of a bed, a small ceramic lamp on a bedside table, bright morning light. |
| `bright-sale.webp` | 1:1 | Sale category tile, gallery photo 6 | A coral wool throw folded across the end of a white-bedded bed, a blush cushion beside it, bright morning light, soft background. |
| `bright-room-look.webp` | 4:3 | Shop the look room (pins on bed, bedside table, rug) | A wide view of a sunny main bedroom: a sky-blue upholstered bed with blush bedding in the centre, a light oak bedside table with a lamp on the left, a cream woven rug on the floor in front, a window with sheer curtains, pale oak floor. Everything clearly visible so product pins can sit on the bed, the bedside table and the rug. |
| `bright-fabrics.webp` | 4:3 | Fabrics story | A flat lay of upholstery fabric swatches in sky blue, blush, sage and cream (linen, boucle and velvet) on a light oak table, soft daylight, a sprig of eucalyptus. |
| `bright-story.webp` | 4:3 | Brand story | Close-up of hand-finished stitching and piping on a sky-blue upholstered headboard, a blush pillow in the corner, soft morning light, shallow depth of field. |
| `bright-room-main.webp` | 4:3 | Large menu tile "Main bedroom" | A bright main bedroom with an upholstered bed in sky-blue linen, white and blush bedding, morning light, oak floor (three-quarter view from the foot of the bed). |
| `bright-room-guest.webp` | 4:3 | Large menu tile "Guest room", gallery photo 3 | A bright guest room with a sage-green ottoman storage bed, its base lifted to show the storage, white bedding, oak floor, morning light. |
| `bright-room-kids.webp` | 4:3 | Large menu tile "Kids room", gallery photo 1 | A bright children's bedroom with a white single bed, pale-blue and blush bedding, a small oak shelf with books, morning light. |
| `bright-bed-sage.webp` | 1:1 | Gallery photo 2 | A sage-green upholstered bed with a winged headboard, white and blush bedding, bright morning light. |
| `bright-daybed.webp` | 1:1 | Gallery photo 4 | A pale-blue upholstered daybed with cushions in blush and coral against a bright wall, morning light. |

The Shop the look pins in `starter.json` sit at 50/50 (bed), 14/58 (bedside table) and 62/88 (rug) of `bright-room-look.webp`.

## Still to make (optional)

- Bright photos for the 24 demo-store products in `demo-content.json` (two each, for the hover photo) and for the theme preview's sample beds. They keep the earlier oat-toned photos until then.
- Reviewer photos.
