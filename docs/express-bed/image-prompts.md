# Express Bed: image prompts for ChatGPT

For the "Express Sunrise" palette in `docs/reports/2026-11-20-express-bed-showroom-design-brief.md`.
If you choose a different palette, tell me first and I will rewrite the colour lines.

## How to use

1. Start **one** ChatGPT conversation and paste the house style below once. Then paste each prompt in turn in the
   same conversation, so every picture keeps the same look.
2. Download each image as PNG and name it exactly as listed (for example `eb-hero-1.png`).
3. Put them in `jellyshops/public/images/express-bed/incoming/` and run
   `node scripts/express-bed/images.mjs import`. It crops each one to its shape, writes
   `jellyshops/public/images/express-bed/<name>.webp` (replacing the labelled placeholder) and lists what is still
   missing. Until then the store shows placeholders: the nearest existing photo with "Placeholder · <name>.png" on it.
4. If a picture comes out with text, a logo or a watermark on it, ask ChatGPT to remove it or regenerate.

## House style (paste first)

> I'm making a set of photos for a UK bed and mattress shop called Express Bed. Every image in this conversation
> must share one house style:
> - Bright, fresh, editorial interior photography, like a premium UK homeware magazine shoot. Real-looking,
>   natural daylight from a window, soft shadows, high detail, no CGI look.
> - Palette: warm white walls (#FFFBF5) and pale wood floors, with confident accents of cobalt blue (#2348E0),
>   tangerine orange (#FF7A45), butter yellow (#FFD84D), mint green (#CFEFDF) and blush pink (#FFDCD2). Accents come
>   from bedding, cushions, throws, lamps, art and flowers, not from painted rooms. No beige-on-beige, no grey gloom.
> - Modern British homes: Victorian terraces and new-build flats, sash windows, simple skirting, a plant or two.
> - Beds look made by a stylist: crisp sheets, layered cushions, a folded throw, nothing messy.
> - No people unless I ask. No text, no logos, no brand names, no watermarks, no frames or borders.
> - Leave calm space where the prompt says text will sit.
> Reply "Ready" and wait for my first prompt.

## Prompts

Sizes: 16:9 = 2400x1350, 3:2 = 2400x1600, 4:5 = 1600x2000, 1:1 = 2000x2000, 3:4 = 1500x2000, 21:9 = 2520x1080.

### Home hero (slideshow)

| File | Ratio | Used for |
| --- | --- | --- |
| `eb-hero-1.png` | 16:9 | Hero slide 1 |
| `eb-hero-2.png` | 16:9 | Hero slide 2 |
| `eb-hero-3.png` | 16:9 | Hero slide 3 |

**eb-hero-1** (16:9):
> A wide, sunlit main bedroom in a London Victorian terrace. A tall upholstered bed with a vertically channelled
> headboard in deep cobalt blue velvet, white crisp bedding, one tangerine and one butter-yellow cushion, a mint
> throw folded at the foot. Large sash window on the right with morning light. Oak bedside table with a ceramic lamp
> and a small vase of yellow tulips. Camera at bed height, slightly from the left. Keep the left 40% of the frame
> calm (plain warm white wall) for a headline.

**eb-hero-2** (16:9):
> An ottoman storage bed with the base lifted open on gas struts, showing neatly folded spare bedding and a
> tangerine suitcase stored inside. Bed in soft butter-yellow boucle. Bright modern flat, pale oak floor, white
> walls, a cobalt rug. Camera low and at a three-quarter angle so the open storage is the hero. Keep the left 40%
> calm for a headline.

**eb-hero-3** (16:9):
> A cosy guest bedroom at golden hour. A blush-pink upholstered bed with a scalloped headboard, white linen bedding,
> a cobalt throw, a small tangerine table lamp glowing. A framed abstract print in cobalt and orange above the bed
> (no text). Warm low sunlight across the wall. Keep the left 40% calm for a headline.

### Shop by type (bento tiles)

| File | Ratio | Used for |
| --- | --- | --- |
| `eb-cat-upholstered.png` | 4:5 | Large tile |
| `eb-cat-ottoman.png` | 4:5 | Large tile |
| `eb-cat-divan.png` | 1:1 | Small tile |
| `eb-cat-mattresses.png` | 1:1 | Small tile |
| `eb-cat-headboards.png` | 1:1 | Small tile |

**eb-cat-upholstered** (4:5):
> A tall wingback upholstered bed in emerald-to-cobalt deep blue velvet, white bedding, one butter cushion, in a
> bright room with a sash window. Portrait framing, bed centred, a little headroom above the headboard. Keep the
> bottom quarter simple (floor and duvet) for a label.

**eb-cat-ottoman** (4:5):
> An ottoman bed in tangerine-orange linen with the storage base half open, folded white towels and a mint blanket
> inside. Bright white room, pale oak floor. Portrait framing, three-quarter angle. Keep the bottom quarter simple.

**eb-cat-divan** (1:1):
> A classic divan bed with a deep buttoned headboard in cobalt blue fabric, two drawers in the base slightly open,
> white bedding with a butter throw. Bright room, square framing, bed centred.

**eb-cat-mattresses** (1:1):
> A thick pocket-sprung mattress with a quilted white pillow top, on a pale oak bed frame with no bedding, corner
> view so the depth and the side handles show. Soft mint wall behind. Square framing. No labels on the mattress.

**eb-cat-headboards** (1:1):
> Close view of a scalloped headboard in blush velvet against a warm white wall, the top of white pillows and a
> tangerine cushion in the lower part of the frame. Square framing, headboard fills most of the picture.

### Shop by sleeper (rooms)

| File | Ratio | Used for |
| --- | --- | --- |
| `eb-room-main.png` | 3:4 | Main bedroom |
| `eb-room-guest.png` | 3:4 | Guest room |
| `eb-room-kids.png` | 3:4 | Kids room |
| `eb-room-small.png` | 3:4 | Small room / box room |

**eb-room-main** (3:4):
> A calm, grown-up main bedroom: king-size cobalt upholstered bed, white bedding, a butter throw, two oak bedside
> tables with matching lamps, a large window. Portrait framing from the doorway.

**eb-room-guest** (3:4):
> A small, welcoming guest room: a double bed in blush fabric, a folded mint towel and a little tray with a carafe on
> the bed, fresh flowers on a stool. Portrait framing.

**eb-room-kids** (3:4):
> A cheerful child's bedroom: a single wooden bed with a low guard rail, mint bedding with tangerine star cushions,
> a cobalt rug, a small bookshelf with picture books (no readable titles), bunting with no letters. Portrait
> framing. No children in the picture.

**eb-room-small** (3:4):
> A narrow box room made to feel bigger: a small double ottoman bed in butter boucle against the wall, a slim
> shelf, a round mirror, white walls and light floor. Portrait framing.

### Stories

| File | Ratio | Used for |
| --- | --- | --- |
| `eb-offer.png` | 4:5 | Offer panel photo |
| `eb-mattress-layers.png` | 3:2 | Comfort story (layers) |
| `eb-fabrics.png` | 3:2 | Material story |
| `eb-swatch-velvet.png` | 1:1 | Swatch tile |
| `eb-swatch-boucle.png` | 1:1 | Swatch tile |
| `eb-swatch-linen.png` | 1:1 | Swatch tile |
| `eb-swatch-weave.png` | 1:1 | Swatch tile |
| `eb-showroom.png` | 16:9 | Showroom page and story |
| `eb-delivery.png` | 3:2 | Delivery steps story |

**eb-offer** (4:5):
> A cobalt velvet bed corner shot from low down, styled with a tangerine cushion and a butter throw, set against a
> plain butter-yellow wall so the picture blends into a yellow panel. Bold, graphic, magazine-cover feel. Keep the
> top-left corner plain.

**eb-mattress-layers** (3:2):
> A studio cut-away of a mattress showing its layers stacked like a cake slice: quilted white top, cream comfort
> foam, a layer of individual pocket springs, a firm base layer. Placed on a plain ink-navy (#101A3A) background
> with soft studio light. Clean product photography. No text or labels.

**eb-fabrics** (3:2):
> Neat flat lay of large fabric swatches arranged in a fan on a pale oak table: cobalt velvet, tangerine linen,
> butter boucle, mint weave, blush velvet. Soft daylight from the top left. No labels.

**eb-swatch-velvet**, **eb-swatch-boucle**, **eb-swatch-linen**, **eb-swatch-weave** (1:1 each):
> Macro close-up filling the whole frame of [cobalt velvet with a soft sheen / butter-yellow boucle with its
> looped texture / tangerine washed linen / mint basket-weave upholstery fabric]. Even soft light, sharp texture,
> no edges or background visible.

**eb-showroom** (16:9):
> A bright bed showroom with tall windows: a few styled beds in cobalt, blush, butter and mint arranged with space
> between them, pale oak floor, white walls, plants, a long oak counter at the back. Feels like a gallery, not a
> warehouse. No people, no signs, no prices.

**eb-delivery** (3:2):
> A bedroom doorway where a new bed frame has just been assembled: neatly made, a folded protective blanket and a
> small toolbag tidy on the floor by the door, sunlight in the room. Suggests "delivered and built in your room".
> No people, no van, no logos.

### Collection banners

| File | Ratio | Used for |
| --- | --- | --- |
| `eb-banner-beds.png` | 21:9 | Beds collection header |
| `eb-banner-mattresses.png` | 21:9 | Mattresses collection header |
| `eb-banner-headboards.png` | 21:9 | Headboards collection header |

**eb-banner-beds** (21:9):
> Ultra-wide view of a bright bedroom with a cobalt upholstered bed on the right third, white bedding, tangerine
> cushion, mint throw. The left half is a calm warm-white wall with soft window light, for a title.

**eb-banner-mattresses** (21:9):
> Ultra-wide view of a freshly made bed with the duvet folded back to show a quilted white mattress, on the right
> third. Mint wall, morning light. The left half calm for a title.

**eb-banner-headboards** (21:9):
> Ultra-wide view of three headboards side by side on a long warm-white wall like a gallery: cobalt channelled,
> blush scalloped, butter buttoned. Even daylight. Calm space on the left for a title.

## Product photos (optional, later)

The 18 test products reuse the current photos. If you want product photos in the new style, make each one as:
> [Bed name and type] in [colour] fabric, [size], made with white bedding and one accent cushion, three-quarter
> view at bed height, in a bright warm-white room with a pale oak floor. Square 1:1, bed fills 80% of the frame.

and a second, plain one for hover:
> The same bed photographed straight on, against a plain warm-white studio background, no props. Square 1:1.
