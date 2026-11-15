# Third-party logos on the Jelly Shop home page

Rule: a real brand's logo appears only where Jelly Shop **actually integrates** with it today. We have **no named real customers**, so the customer marquee uses clearly invented shop names as plain text, never a real company's logo.

Logos are the official single-colour marks published through Simple Icons (CC0 for the SVG file; the marks stay their owners' trademarks), version 16.37.0, downloaded 2026-11-15 from `https://cdn.jsdelivr.net/npm/simple-icons@16.37.0/icons/<slug>.svg`. Simple Icons records each brand's own source page, listed below. Since 2026-11-15 (colour direction) they are shown **in each brand's own colour**, unchanged in shape, from `public/logos/<slug>-color.svg`: the single-colour file with Simple Icons' official brand hex as its fill (from `simple-icons@16.37.0/data/simple-icons.json`). The plain `<slug>.svg` files are kept as the neutral versions. Each colour version was checked against the brand's rule (last column) for use on a dark and a light page.

| Brand | Colour file | Brand hex | Colour on our dark and light pages |
| --- | --- | --- | --- |
| Stripe | `stripe-color.svg` | `#635BFF` | Stripe's own blurple mark; allowed on dark and light backgrounds |
| YouTube | `youtube-color.svg` | `#FF0000` | The official icon is red with a **white** play triangle, so the triangle is filled white (the single-colour file leaves it cut out, which would show the page through it). Red icon on dark and light is the standard full-colour version |
| Vimeo | `vimeo-color.svg` | `#1AB7EA` | Vimeo blue mark; allowed on dark and light |
| Spotify | `spotify-color.svg` | `#1ED760` | Spotify only allows its icon in green, black or white; green is used on both modes, as their guidelines show |
| SoundCloud | `soundcloud-color.svg` | `#FF5500` | SoundCloud orange; allowed on dark and light |

Brands without a confirmed colour rule stay as names with a Lucide icon in an accent-coloured tile (table below).

| Brand | File | Why it's on the page (real support) | Official source / guidelines | Recolouring |
| --- | --- | --- | --- | --- |
| Stripe | `public/logos/stripe.svg` | Checkout and payouts run on Stripe Connect and the Payment Element | https://stripe.com/newsroom/information | Stripe's brand assets include white and black versions |
| YouTube | `public/logos/youtube.svg` | Video blocks embed YouTube (privacy-enhanced `youtube-nocookie.com`) | https://www.youtube.com/howyoutubeworks/resources/brand-resources/#logos-icons-and-colors | Guidelines provide monochrome (white / almost-black) icons |
| Vimeo | `public/logos/vimeo.svg` | Video blocks embed Vimeo players | https://press.vimeo.com/brand-guidelines | Guidelines provide white and black logos |
| Spotify | `public/logos/spotify.svg` | "Apps" block embeds Spotify players | https://developer.spotify.com/documentation/general/design-and-branding/#using-our-logo | Guidelines allow the icon in black or white only (other colours not allowed), which is what we use |
| SoundCloud | `public/logos/soundcloud.svg` | "Apps" block embeds SoundCloud players | https://press.soundcloud.com | Press kit offers white and black logos |

## Shown as text, not as a logo

| Brand | Real support | Why no logo |
| --- | --- | --- |
| Google Maps, Google Forms | "Apps" block embeds | Google's brand rules don't allow recolouring its product icons, and full-colour icons break the black-and-white theme |
| Calendly, Typeform, Airtable | "Apps" block embeds | Could not confirm from their press pages that a monochrome version is allowed; shown as names with a generic Lucide icon until checked |

## Deliberately not shown

| Brand | Reason |
| --- | --- |
| Apple Pay, Google Pay | Stripe's Payment Element can show wallets, but Apple Pay needs each store's domain registered and neither is confirmed working, so we don't claim them |
| Royal Mail, DPD, Evri, DHL, UPS | Tracking is a free-text carrier field plus link; there is no courier integration |
| Instagram, TikTok, Facebook, marketplaces | No channel integration exists yet ("Social" means sharing your store link) |
| Any customer logo | Jelly Shop has no named customers on record; the marquee uses invented shop names |

## Before launch
- Re-check each guideline page above (they change).
- If Apple Pay / Google Pay are switched on and verified, add their official marks from https://developer.apple.com/apple-pay/marketing/ and https://pay.google.com/about/ following those rules (both require the official artwork, unmodified).
