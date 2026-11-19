#!/usr/bin/env node
/**
 * Express Bed: a bed showroom store built on the Resthaven theme ("Midnight oat" style).
 *
 *   node scripts/express-bed/build-plan.mjs          writes scripts/express-bed/plan.json (git-ignored)
 *
 * The plan holds everything the store needs on top of a fresh Resthaven install: the rewritten page layouts and
 * shared sections (header, footer, announcement), the main menu, theme settings, collections, 18 test products,
 * information pages and a few reviews. `install-in-browser.js` applies it from a signed-in admin tab.
 * Run `npm run build:storefront-packages` in jellyshops/ first (the script reads the built packages).
 *
 * Layout ideas follow sonno.co.uk and dusk.com (structure only). Copy and names are our own; photos are the
 * Resthaven theme's own generated photos, used as placeholders.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const themes = await import(new URL("jellyshops/packages/storefront-themes/dist/index.js", `file:///${root.replaceAll("\\", "/")}`).href);
const registry = await import(new URL("jellyshops/packages/storefront-registry/dist/index.js", `file:///${root.replaceAll("\\", "/")}`).href);

const pack = structuredClone(themes.getStarterPack("jelly-resthaven"));
const photo = (name) => `/themes/jelly-resthaven/${name}.webp`;
const img = (name, alt, extra = {}) => ({ url: photo(name), alt, ...extra });

// ---------------------------------------------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------------------------------------------
const SIZES = ["Single", "Double", "King", "Super King"];
const SIZE_FACTOR = { Single: 1, Double: 1.3, King: 1.5, "Super King": 1.75 };
const BED_SIZE = { Single: [98, 198], Double: [146, 205], King: [161, 215], "Super King": [191, 215] };
const MATTRESS_SIZE = { Single: [90, 190], Double: [135, 190], King: [150, 200], "Super King": [180, 200] };
const HEADBOARD_WIDTH = { Single: 92, Double: 140, King: 155, "Super King": 185 };
const TEST_NOTE = "TEST PRODUCT: replace this with your real product details.";
const round = (pounds) => Math.round(pounds) - 0.01;
// Service add-ons on every bed: an "Optional extra" choice (type addon), priced per pick and added to the bag line.
const BED_EXTRAS = { name: "Extras", type: "addon", values: ["Professional assembly", "Remove my old bed"], prices: [3900, 2900] };

const collections = [
  { handle: "beds", title: "Beds", description: "Divan, ottoman storage, upholstered and wooden bed frames in every size from single to super king. Two-person delivery to the room of your choice." },
  { handle: "mattresses", title: "Mattresses", description: "Pocket sprung, memory foam and hybrid mattresses. Not sure which feel suits you? Every product page lists its comfort, layers and exact sizes." },
  { handle: "headboards", title: "Headboards", description: "Upholstered and wooden headboards that fit most bed frames and divans. Choose your width and fabric." },
];

function product(definition) {
  const { handle, title, collection, type, base, compareAt, images, tags, about, specs, sizeSpec } = definition;
  const variants = SIZES.map((size, index) => ({
    sku: `TEST-EB-${handle.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 18)}-${["S", "D", "K", "SK"][index]}`,
    options: { Size: size },
    priceMinor: Math.round(round(base * SIZE_FACTOR[size]) * 100),
    ...(compareAt ? { compareAtPriceMinor: Math.round(round(compareAt * SIZE_FACTOR[size]) * 100) } : {}),
    stock: [6, 12, 10, 4][index],
  }));
  const specifications = { ...specs };
  for (const size of SIZES) Object.assign(specifications, sizeSpec(size));
  return {
    handle, title, collections: [collection], type, vendor: "Express Bed", images,
    description: `${TEST_NOTE}\n\n${about}`,
    options: [{ name: "Size", values: SIZES }, ...(collection === "beds" ? [BED_EXTRAS] : [])], variants,
    tags: ["test-product", ...tags], specifications,
  };
}

const bedSpec = (height) => (size) => ({ [`${size} (W x L x H)`]: `${BED_SIZE[size][0]} x ${BED_SIZE[size][1]} x ${height} cm` });
const mattressSpec = (depth) => (size) => ({ [`${size} (W x L x H)`]: `${MATTRESS_SIZE[size][0]} x ${MATTRESS_SIZE[size][1]} x ${depth} cm` });
const headboardSpec = (height) => (size) => ({ [`${size} (W x L x H)`]: `${HEADBOARD_WIDTH[size]} x 8 x ${height} cm` });

const products = [
  // Beds
  product({ handle: "ashby-divan-bed", title: "Ashby Divan Bed", collection: "beds", type: "Divan bed", base: 299, images: ["divan", "room-guest"], tags: ["Storage:Two drawers", "Fabric:Woven"],
    about: "A sturdy divan base with two smooth-running drawers, finished in a soft woven fabric. Delivered to your room by our two-person team; add assembly as an extra.",
    specs: { Frame: "Kiln-dried timber", Storage: "Two side drawers", Fabric: "Woven oatmeal", Assembly: "Optional extra (£39)" }, sizeSpec: bedSpec(38) }),
  product({ handle: "calder-ottoman-storage-bed", title: "Calder Ottoman Storage Bed", collection: "beds", type: "Ottoman bed", base: 449, compareAt: 549, images: ["larch-storage-bed", "room-main"], tags: ["Storage:Ottoman lift", "Fabric:Velvet"],
    about: "Lift the base on gas struts and the whole bed becomes storage. A padded headboard and plush velvet make it the centre of the room.",
    specs: { Frame: "Engineered timber with gas-lift struts", Storage: "Full ottoman lift", Fabric: "Velvet", Assembly: "Optional extra (£39)" }, sizeSpec: bedSpec(115) }),
  product({ handle: "wren-oak-bed-frame", title: "Wren Oak Bed Frame", collection: "beds", type: "Bed frame", base: 399, images: ["wren-oak-bed", "room-kids"], tags: ["Storage:None", "Fabric:Wood"],
    about: "Solid oak with a slatted headboard and a sprung slatted base. Simple, warm and built to last for years.",
    specs: { Frame: "Solid oak", Base: "Sprung slats", Finish: "Natural oil", Assembly: "Optional extra (£39)" }, sizeSpec: bedSpec(100) }),
  product({ handle: "elm-wingback-upholstered-bed", title: "Elm Wingback Upholstered Bed", collection: "beds", type: "Upholstered bed", base: 549, compareAt: 649, images: ["elm-wingback-bed", "detail"], tags: ["Storage:None", "Fabric:Boucle"],
    about: "A tall wingback headboard wraps the bed in soft boucle. Piped edges and a padded frame give it a hotel feel.",
    specs: { Frame: "Hardwood and plywood", Base: "Sprung slats", Fabric: "Boucle", Assembly: "Optional extra (£39)" }, sizeSpec: bedSpec(135) }),
  product({ handle: "rowan-four-poster-bed", title: "Rowan Four Poster Bed", collection: "beds", type: "Bed frame", base: 699, images: ["rowan-four-poster", "room-main"], tags: ["Storage:None", "Fabric:Wood"],
    about: "Slim posts and a light oak finish make a four poster that feels airy rather than heavy. Ideal for rooms with high ceilings.",
    specs: { Frame: "Oak veneer on hardwood", Base: "Sprung slats", Height: "190 cm to the top of the posts", Assembly: "Optional extra (£39)" }, sizeSpec: bedSpec(190) }),
  product({ handle: "harlow-velvet-bed", title: "Harlow Velvet Bed", collection: "beds", type: "Upholstered bed", base: 499, images: ["harbour-sage", "fabrics"], tags: ["Storage:None", "Fabric:Velvet"],
    about: "A deep panelled headboard in sage velvet on a low, padded frame. Order free fabric swatches before you choose.",
    specs: { Frame: "Hardwood", Base: "Sprung slats", Fabric: "Sage velvet", Assembly: "Optional extra (£39)" }, sizeSpec: bedSpec(125) }),
  // Mattresses
  product({ handle: "hollis-pocket-1000-mattress", title: "Hollis Pocket 1000 Mattress", collection: "mattresses", type: "Pocket sprung", base: 249, compareAt: 299, images: ["hollis-mattress", "mattress"], tags: ["Comfort:Medium", "Fabric:Quilted cover"],
    about: "One thousand individually wrapped springs move with you and keep partners from disturbing each other. Medium feel, quilted cover.",
    specs: { Comfort: "Medium", Springs: "1,000 pocket springs (king size)", Turn: "Rotate monthly" }, sizeSpec: mattressSpec(25) }),
  product({ handle: "fern-memory-foam-mattress", title: "Fern Memory Foam Mattress", collection: "mattresses", type: "Memory foam", base: 199, images: ["fern-mattress", "mattress"], tags: ["Comfort:Medium soft", "Fabric:Knitted cover"],
    about: "Layers of cooling memory foam mould to your shape and ease pressure on shoulders and hips. Arrives rolled for easy carrying upstairs.",
    specs: { Comfort: "Medium soft", Layers: "3 foam layers", Delivery: "Rolled in a box" }, sizeSpec: mattressSpec(22) }),
  product({ handle: "orbit-hybrid-2000-mattress", title: "Orbit Hybrid 2000 Mattress", collection: "mattresses", type: "Hybrid", base: 349, images: ["mattress", "hollis-mattress"], tags: ["Comfort:Medium firm", "Fabric:Quilted cover"],
    about: "Two thousand pocket springs topped with memory foam: the bounce of springs with the hug of foam.",
    specs: { Comfort: "Medium firm", Springs: "2,000 pocket springs (king size)", Layers: "Springs plus memory foam" }, sizeSpec: mattressSpec(28) }),
  product({ handle: "cedar-pillowtop-mattress", title: "Cedar Pillowtop Mattress", collection: "mattresses", type: "Pocket sprung", base: 299, images: ["cedar-topper", "mattress"], tags: ["Comfort:Soft", "Fabric:Quilted cover"],
    about: "A deep pillowtop layer sewn on top of pocket springs for a soft, cloud-like first feel.",
    specs: { Comfort: "Soft", Springs: "1,500 pocket springs (king size)", Top: "Sewn-on pillowtop" }, sizeSpec: mattressSpec(30) }),
  product({ handle: "essential-open-coil-mattress", title: "Essential Open Coil Mattress", collection: "mattresses", type: "Open coil", base: 149, images: ["bright-mattresses", "mattress"], tags: ["Comfort:Firm", "Fabric:Quilted cover"],
    about: "A firm, supportive open coil mattress at an everyday price. A good choice for guest rooms and first homes.",
    specs: { Comfort: "Firm", Springs: "Open coil", Turn: "Turn and rotate monthly" }, sizeSpec: mattressSpec(20) }),
  product({ handle: "luxe-natural-3000-mattress", title: "Luxe Natural 3000 Mattress", collection: "mattresses", type: "Pocket sprung", base: 549, compareAt: 649, images: ["hollis-mattress", "fern-mattress"], tags: ["Comfort:Medium firm", "Fabric:Wool cover"],
    about: "Three thousand pocket springs with natural wool and cotton fillings that stay cool and breathe through the night.",
    specs: { Comfort: "Medium firm", Springs: "3,000 pocket springs (king size)", Fillings: "Wool and cotton" }, sizeSpec: mattressSpec(32) }),
  // Headboards
  product({ handle: "arlo-panelled-headboard", title: "Arlo Panelled Headboard", collection: "headboards", type: "Upholstered headboard", base: 129, images: ["headboard"], tags: ["Fabric:Velvet"],
    about: "Deep vertical panels in rust velvet. Bolts to most divans and bed frames; fixings included.",
    specs: { Fabric: "Velvet", Fixing: "Bolts and struts included", Fits: "Most divans and bed frames" }, sizeSpec: headboardSpec(120) }),
  product({ handle: "moss-velvet-headboard", title: "Moss Velvet Headboard", collection: "headboards", type: "Upholstered headboard", base: 149, images: ["moss-headboard"], tags: ["Fabric:Velvet"],
    about: "Soft moss-green velvet with a gently curved top. Adds colour without a full bed change.",
    specs: { Fabric: "Velvet", Fixing: "Bolts and struts included", Fits: "Most divans and bed frames" }, sizeSpec: headboardSpec(125) }),
  product({ handle: "piped-wingback-headboard", title: "Piped Wingback Headboard", collection: "headboards", type: "Upholstered headboard", base: 179, compareAt: 219, images: ["detail", "elm-wingback-bed"], tags: ["Fabric:Boucle"],
    about: "Wings on each side and hand-finished piping. Floor-standing, so it also works with wall-mounted beds.",
    specs: { Fabric: "Boucle", Fixing: "Floor standing", Fits: "All bed frames and divans" }, sizeSpec: headboardSpec(140) }),
  product({ handle: "boucle-channel-headboard", title: "Boucle Channel Headboard", collection: "headboards", type: "Upholstered headboard", base: 159, images: ["hero"], tags: ["Fabric:Boucle"],
    about: "Wide channels in nubby oatmeal boucle. Calm, tactile and easy to pair with any bedding.",
    specs: { Fabric: "Boucle", Fixing: "Bolts and struts included", Fits: "Most divans and bed frames" }, sizeSpec: headboardSpec(130) }),
  product({ handle: "linen-button-back-headboard", title: "Linen Button-Back Headboard", collection: "headboards", type: "Upholstered headboard", base: 119, images: ["fabrics"], tags: ["Fabric:Linen"],
    about: "Classic deep buttoning in washable linen-look fabric. Choose from four soft colours (test copy).",
    specs: { Fabric: "Linen look", Fixing: "Bolts and struts included", Fits: "Most divans and bed frames" }, sizeSpec: headboardSpec(115) }),
  product({ handle: "oak-slatted-headboard", title: "Oak Slatted Headboard", collection: "headboards", type: "Wooden headboard", base: 139, images: ["wren-oak-bed"], tags: ["Fabric:Wood"],
    about: "Solid oak slats with a natural oil finish. Wall-mounted, so it fits any bed.",
    specs: { Material: "Solid oak", Fixing: "Wall mounted, fixings included", Fits: "All beds" }, sizeSpec: headboardSpec(100) }),
];

const reviews = [
  { product: "calder-ottoman-storage-bed", rating: 5, title: "So much storage", body: "Test review. Delivered in a week and the lift is really smooth. Our bedroom finally feels tidy.", author: "Test shopper A." },
  { product: "hollis-pocket-1000-mattress", rating: 5, title: "Best sleep in years", body: "Test review. Medium feel is spot on for both of us and we no longer feel each other move.", author: "Test shopper B." },
  { product: "elm-wingback-upholstered-bed", rating: 4, title: "Looks like a hotel", body: "Test review. Beautiful bed, the fitters were quick. Took a few days for the boucle smell to go.", author: "Test shopper C." },
  { product: "fern-memory-foam-mattress", rating: 5, title: "Easy to carry upstairs", body: "Test review. Came rolled in a box and was full size by the evening.", author: "Test shopper D." },
  { product: "arlo-panelled-headboard", rating: 4, title: "Great colour", body: "Test review. The rust velvet is gorgeous. Fitting took twenty minutes.", author: "Test shopper E." },
];

const pages = [
  { handle: "about", title: "About Express Bed", body: [
    ["A bed showroom that delivers", "Express Bed is a bed showroom for beds, mattresses and headboards. Come and lie on every mattress in our showroom, or shop online and have your new bed delivered to the room of your choice, usually within a week."],
    ["What we believe", "A good bed should be simple to choose. That is why every product page lists the exact sizes, you can spread the cost with Klarna and our team will happily talk you through the options."],
    ["Placeholder copy", "This page was written as sample copy for the Express Bed test store. Replace it with your own story."],
  ] },
  { handle: "contact", title: "Contact us", body: [
    ["Visit the showroom", "Express Bed Showroom, 1 Sample Street, London, AB1 2CD (placeholder address). Open Monday to Saturday 9am to 6pm and Sunday 10am to 4pm."],
    ["Call or email", "Phone 020 0000 0000 or email hello@example.com (placeholders). We reply within one working day."],
    ["Delivery questions", "Already ordered? Have your order number ready and we will check your delivery slot."],
  ] },
  { handle: "faq", title: "Questions and answers", body: [
    ["How fast is delivery?", "Most beds and mattresses are delivered within 5 to 7 working days. Our two-person team carries everything to the room of your choice and takes the packaging away."],
    ["Can I pay in instalments?", "Yes. Choose Klarna at checkout to split the cost into smaller payments. Klarna checks your eligibility and sets its own terms."],
    ["Which size should I choose?", "Single 90 x 190 cm, double 135 x 190 cm, king 150 x 200 cm, super king 180 x 200 cm. Every product page lists the exact outside measurements."],
    ["Do headboards fit any bed?", "Bolt-on headboards fit most divans and bed frames. Floor-standing and wall-mounted headboards fit every bed."],
  ] },
  { handle: "shipping", title: "Delivery", body: [
    ["Delivery charges", "Delivery is charged by order and shown at checkout before you pay."],
    ["When will it arrive?", "We call you to book a day, usually within 5 to 7 working days of your order."],
    ["Assembly and old bed removal", "Add professional assembly (£39) or old bed removal (£29) as an extra when you choose your bed."],
  ] },
  { handle: "returns", title: "Returns", body: [
    ["30-day returns", "Changed your mind about a bed or headboard? Return it within 30 days in its original condition."],
    ["Mattresses", "For hygiene reasons a mattress can only be returned unopened in its original packaging."],
  ] },
  { handle: "privacy", title: "Privacy policy", body: [["Placeholder", "This is placeholder text for the Express Bed test store. Replace it with your own privacy policy before you start selling."]] },
  { handle: "terms", title: "Terms of service", body: [["Placeholder", "This is placeholder text for the Express Bed test store. Replace it with your own terms before you start selling."]] },
];

// ---------------------------------------------------------------------------------------------------------------
// Storefront: shared sections
// ---------------------------------------------------------------------------------------------------------------
const global = (id) => pack.globalSections.find((entry) => entry.section.id === id).section;
const announcement = global("studio-announcement");
announcement.settings.text = "Spread the cost with Klarna";
const announcementLines = ["Beds delivered in 5 to 7 working days", "Two-person delivery to the room of your choice", "Visit our showroom and try before you buy"];
announcement.blocks.forEach((block, index) => { block.settings.text = announcementLines[index] ?? block.settings.text; });

const header = global("studio-header");
Object.assign(header.settings, { extraLinkLabel: "Visit our showroom", extraLink: "/contact", extraLinkIcon: "phone" });

const footer = global("studio-footer");
Object.assign(footer.settings, {
  text: "Beds, mattresses and headboards, delivered fast by our own two-person team.",
  newsletterHeading: "Offers and sleep tips",
  newsletterText: "Occasional emails about new beds and showroom events. Unsubscribe at any time.",
});
const footerLinks = [
  ["link-heading", { text: "Shop" }], ["link", { label: "Beds", link: "/collections/beds" }], ["link", { label: "Mattresses", link: "/collections/mattresses" }],
  ["link", { label: "Headboards", link: "/collections/headboards" }], ["link", { label: "Shop all", link: "/shop" }],
  ["link-heading", { text: "Help" }], ["link", { label: "Questions and answers", link: "/pages/faq" }], ["link", { label: "Delivery", link: "/pages/shipping" }],
  ["link", { label: "Returns", link: "/pages/returns" }],
  ["link-heading", { text: "Express Bed" }], ["link", { label: "About us", link: "/pages/about" }], ["link", { label: "Contact and showroom", link: "/contact" }],
  ["link", { label: "Privacy policy", link: "/pages/privacy" }],
];
footer.blocks = footerLinks.map(([type, settings], index) => ({ id: `expressbed-footer-${index}`, type, enabled: true, settings, blocks: [] }));

// ---------------------------------------------------------------------------------------------------------------
// Storefront: pages
// ---------------------------------------------------------------------------------------------------------------
const template = (key) => pack.templates.find((entry) => entry.key === key).layout;
const inline = (layout, id) => layout.sections.find((placement) => placement.kind === "inline" && placement.section.id === id).section;
const block = (section, id) => section.blocks.find((entry) => entry.id === id);
const without = (layout, ids) => { layout.sections = layout.sections.filter((placement) => placement.kind !== "inline" || !ids.includes(placement.section.id)); };

const home = template("home");
const hero = inline(home, "studio-hero");
hero.settings.eyebrow = "Bed showroom, delivered fast";
hero.settings.image = img("hero", "A calm bedroom with an oatmeal boucle bed, white bedding and a jute rug", { fit: "cover", focalPoint: { x: 62, y: 55 } });
block(hero, "resthaven-hero-title").settings.text = "Better sleep, delivered this week.";
block(hero, "resthaven-hero-text").settings.text = "Beds, mattresses and headboards in every size from single to super king, with two-person delivery to the room of your choice. Spread the cost with Klarna.";
Object.assign(block(hero, "resthaven-hero-action-0").settings, { label: "Shop beds", href: "/collections/beds" });
Object.assign(block(hero, "resthaven-hero-action-1").settings, { label: "Find your mattress", href: "/collections/mattresses" });

const categories = inline(home, "resthaven-categories");
Object.assign(categories.settings, { heading: "Shop by category", text: "Everything for a better night, from the base to the headboard.", columns: 4 });
// Four tiles: four across on desktop, two by two on phones (three left one tile alone on phones).
categories.blocks = [
  ["all", "Shop all", "room-main", "A main bedroom with an upholstered bed made up in white linen", "/shop"],
  ["beds", "Beds", "divan", "An oatmeal divan bed with drawers in a bright guest room"],
  ["mattresses", "Mattresses", "mattress", "A cut-away mattress corner showing its quilted cover and springs"],
  ["headboards", "Headboards", "headboard", "A rust velvet panelled headboard behind white pillows"],
].map(([handle, label, image, alt, href]) => ({ id: `expressbed-category-${handle}`, type: "collection-card", enabled: true, settings: { label, image: img(image, alt), link: href ?? `/collections/${handle}` }, blocks: [] }))
  .sort((a, b) => (a.id.endsWith("-all") ? 1 : 0) - (b.id.endsWith("-all") ? 1 : 0));

Object.assign(inline(home, "resthaven-featured").settings, { heading: "Best sellers", text: "The beds, mattresses and headboards our customers choose most." });

const promo = inline(home, "resthaven-promo");
promo.settings.eyebrow = "Bed and mattress together";
promo.settings.image = img("room-main", "A main bedroom with an upholstered bed made up in white linen");
block(promo, "resthaven-promo-title").settings.text = "Pair a bed and mattress in one delivery";
block(promo, "resthaven-promo-text").settings.text = "Choose your frame, add the mattress that suits how you sleep, and we deliver both on the same day. Add assembly as an extra.";
Object.assign(block(promo, "resthaven-promo-action").settings, { label: "Shop beds", href: "/collections/beds" });

const look = inline(home, "resthaven-shop-look");
Object.assign(look.settings, { eyebrow: "Shop the room", heading: "A calm main bedroom", text: "One bed, one mattress and a headboard that ties the room together. Tap a pin to see each piece.", image: img("room-main", "A main bedroom with an upholstered bed, bedside table and rug") });

const fabric = inline(home, "resthaven-fabric-story");
fabric.settings.image = img("fabrics", "Fabric swatches in velvet, boucle and linen on an oak table");
block(fabric, fabric.blocks[0].id).settings.text = "Finish the room with a new headboard";
block(fabric, fabric.blocks[1].id).settings.text = "Velvet, boucle, linen or solid oak, in widths from single to super king. Most bolt straight onto your existing bed.";
Object.assign(block(fabric, fabric.blocks[2].id).settings, { label: "Shop headboards", href: "/collections/headboards" });

const mattressStory = inline(home, "resthaven-mattress-feature");
mattressStory.settings.image = img("hollis-mattress", "A pocket sprung mattress on a bed base");
block(mattressStory, mattressStory.blocks[0].id).settings.text = "Find the feel that suits you";
block(mattressStory, mattressStory.blocks[1].id).settings.text = "Pocket sprung, memory foam or hybrid, from soft to firm. Lie on every one in our showroom, or compare comfort and layers on each product page.";
Object.assign(block(mattressStory, mattressStory.blocks[2].id).settings, { label: "Find your mattress", href: "/collections/mattresses" });

inline(home, "resthaven-trust-row").blocks.forEach((entry, index) => { entry.settings.text = ["Two-person delivery", "Delivered in 5 to 7 days", "Pay with Klarna", "Showroom you can visit"][index] ?? entry.settings.text; });

Object.assign(inline(home, "resthaven-spotlight").settings, { text: "Our best-selling storage bed: a full ottoman lift, a padded headboard and soft velvet, delivered to the room of your choice.", buttonLabel: "View the bed" });

const testimonials = inline(home, "resthaven-reviews");
const quotes = [
  ["The bed arrived on the day they promised and the team carried it upstairs and built it in twenty minutes.", "Bought the Calder ottoman bed"],
  ["I tried every mattress in the showroom before choosing. Three weeks in and my back has never felt better.", "Bought the Hollis mattress"],
  ["Ordered a headboard on Monday, fitted by Friday. It has completely changed the room.", "Bought the Arlo headboard"],
  ["Helpful staff, no pressure and the price matched what I saw online.", "Visited the showroom"],
];
testimonials.blocks.forEach((entry, index) => { if (quotes[index]) Object.assign(entry.settings, { quote: `${quotes[index][0]} (Sample review.)`, detail: quotes[index][1] }); });

const story = inline(home, "resthaven-brand-story");
story.settings.image = img("detail", "Close-up of hand-finished piping on an upholstered headboard");
block(story, story.blocks[0].id).settings.text = "A showroom you can sleep on";
block(story, story.blocks[1].id).settings.text = "Lie on every mattress, sit on every bed and feel every fabric before you buy. Then let our own delivery team bring it home, usually within a week.";
if (story.blocks[2]) Object.assign(story.blocks[2].settings, { label: "Visit our showroom", href: "/contact" });

const gallery = inline(home, "resthaven-gallery");
Object.assign(gallery.settings, { heading: "Rested at home", text: "Bedrooms from our customers. Share yours with #ExpressBedHome." });
const galleryPhotos = [["room-main", "A main bedroom with an upholstered bed"], ["room-guest", "A guest room with a divan bed"], ["room-kids", "A child's room with an oak bed"], ["harbour-sage", "A sage velvet bed"], ["rowan-four-poster", "An oak four poster bed"], ["elm-wingback-bed", "A boucle wingback bed"]];
gallery.blocks.forEach((entry, index) => { entry.settings.image = img(...galleryPhotos[index % galleryPhotos.length]); });

const newsletter = inline(home, "resthaven-newsletter");
newsletter.blocks[0].settings.text = "Sleep better, spend less";
newsletter.blocks[1].settings.text = "Showroom events, new arrivals and early access to offers. Once or twice a month.";

// Product page: "Complete the set" under Add to basket (a bed suggests a mattress and a headboard, each with a size
// choice that starts on the bed's size and an Add button).
const mainProduct = template("product").sections.find((placement) => placement.kind === "inline" && placement.section.type === "main-product").section;
const purchaseAt = mainProduct.blocks.findIndex((entry) => entry.type === "part-product-purchase");
mainProduct.blocks.splice(purchaseAt + 1, 0, {
  id: "expressbed-complete-set", type: "complementary-products", enabled: true, blocks: [],
  settings: { heading: "Complete the set", limit: 3, source: "pairs", addToBag: true, matchSize: true },
});

const collection = template("collection");
const help = inline(collection, "resthaven-collection-help");
block(help, "resthaven-collection-help-title").settings.text = "Not sure which size or feel is right?";
block(help, "resthaven-collection-help-text").settings.text = "Every product page lists exact measurements for each size. Still unsure? Visit the showroom and try them all.";
Object.assign(block(help, "resthaven-collection-help-action").settings, { label: "Read our size guide", href: "/pages/faq" });

// No bedding, pillows or decor in this store: point any leftover search links at the right collections.
const RELINK = { "/search?q=Beds": "/collections/beds", "/search?q=Mattresses": "/collections/mattresses", "/search?q=Bedding": "/collections/headboards", "/search?q=Pillows": "/collections/headboards", "/search?q=Decor": "/shop", "/search?q=Sale": "/shop" };
const relink = (value) => {
  if (typeof value === "string") return RELINK[value] ?? value.replaceAll("Resthaven", "Express Bed").replaceAll("#RestedAtHome", "#ExpressBedHome");
  if (Array.isArray(value)) return value.map(relink);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, relink(entry)]));
  return value;
};
pack.templates = relink(pack.templates);
pack.globalSections = relink(pack.globalSections);

// ---------------------------------------------------------------------------------------------------------------
// Main menu (large menu with columns and photo tiles)
// ---------------------------------------------------------------------------------------------------------------
let menuId = 0;
const link = (label, url, children = [], image) => ({ id: `expressbed-menu-${++menuId}`, label, target: { kind: "external", url }, children, ...(image ? { image } : {}) });
const sizeLinks = (handle) => SIZES.map((size) => link(size, `/collections/${handle}?f.size=${encodeURIComponent(size)}`));
const mainMenu = [
  link("Beds", "/collections/beds", [
    link("Bed types", "/collections/beds", ["Divan bed", "Ottoman bed", "Upholstered bed", "Bed frame"].map((type) => link(`${type}s`, `/collections/beds?f.type=${encodeURIComponent(type)}`))),
    link("Bed sizes", "/collections/beds", sizeLinks("beds")),
    link("Main bedroom", "/collections/beds", [], img("room-main", "A main bedroom with an upholstered bed")),
    link("Guest room", "/collections/beds?f.type=Divan%20bed", [], img("room-guest", "A guest room with a divan bed")),
    link("Kids room", "/collections/beds?f.size=Single", [], img("room-kids", "A child's room with a single oak bed")),
  ]),
  link("Mattresses", "/collections/mattresses", [
    link("By type", "/collections/mattresses", ["Pocket sprung", "Memory foam", "Hybrid", "Open coil"].map((type) => link(type, `/collections/mattresses?f.type=${encodeURIComponent(type)}`))),
    link("By size", "/collections/mattresses", sizeLinks("mattresses")),
    link("Mattress guide", "/pages/faq", [], img("mattress", "A cut-away mattress corner")),
  ]),
  link("Headboards", "/collections/headboards", [
    link("By size", "/collections/headboards", sizeLinks("headboards")),
    link("Upholstered", "/collections/headboards?f.type=Upholstered%20headboard", [], img("headboard", "A rust velvet headboard")),
    link("Wooden", "/collections/headboards?f.type=Wooden%20headboard", [], img("wren-oak-bed", "An oak slatted headboard")),
  ]),
  link("About", "/pages/about"),
  link("Contact", "/contact"),
];

// ---------------------------------------------------------------------------------------------------------------
// Theme settings: Resthaven with the "Midnight oat" style (warm oat, midnight ink, brass), which suits these photos.
// ---------------------------------------------------------------------------------------------------------------
const style = themes.listThemeStyles("jelly-resthaven").find((entry) => entry.id === "midnight-oat");
const themeSettings = themes.applyThemeStyle(structuredClone(pack.theme.settings), style);
themeSettings.cart = { ...(themeSettings.cart ?? {}), type: "drawer", freeDeliveryFrom: 0 };

// ---------------------------------------------------------------------------------------------------------------
// Checks: every section must pass the registry, as the editor and publish would require.
// ---------------------------------------------------------------------------------------------------------------
const problems = [];
for (const entry of pack.templates) for (const placement of entry.layout.sections) {
  if (placement.kind !== "inline") continue;
  for (const issue of registry.validateSectionAgainstRegistry(placement.section, entry.type, "jelly-resthaven")) problems.push(`${entry.key}/${placement.section.id}: ${issue.code} ${issue.message}`);
}
for (const { section } of pack.globalSections) {
  const group = section.type === "footer" ? "footer" : "header";
  for (const issue of registry.validateSectionAgainstRegistry(section, { group }, "jelly-resthaven")) problems.push(`global/${section.id}: ${issue.code} ${issue.message}`);
}
const leftovers = JSON.stringify(pack.templates).match(/Resthaven|bright-[a-z-]+\.webp|Bedding|Pillows/g) ?? [];
if (problems.length) throw new Error(`Sections do not validate:\n${problems.join("\n")}`);

const missingPhotos = [...new Set([...products.flatMap((entry) => entry.images)])].filter((name) => {
  try { readFileSync(fileURLToPath(new URL(`jellyshops/packages/storefront-themes/src/themes/jelly-resthaven/assets/${name}.webp`, `file:///${root.replaceAll("\\", "/")}`))); return false; } catch { return true; }
});
if (missingPhotos.length) throw new Error(`Missing photos: ${missingPhotos.join(", ")}`);

const plan = {
  store: { name: "Express Bed", slug: "express-bed", currency: "GBP", country: "GB" },
  starterId: "jelly-resthaven",
  globalSections: pack.globalSections,
  templates: pack.templates,
  menus: { main: mainMenu },
  // Product picks in the home page, by handle (the installer swaps in the product ids once products exist).
  productLinks: [
    { template: "home", section: "resthaven-spotlight", product: "calder-ottoman-storage-bed" },
    { template: "home", section: "resthaven-shop-look", block: "resthaven-pin-bed", product: "elm-wingback-upholstered-bed" },
    { template: "home", section: "resthaven-shop-look", block: "resthaven-pin-bedside", product: "piped-wingback-headboard" },
    { template: "home", section: "resthaven-shop-look", block: "resthaven-pin-rug", product: "hollis-pocket-1000-mattress" },
  ],
  themeSettings,
  collections, products, reviews, pages,
};
writeFileSync(fileURLToPath(new URL("./plan.json", import.meta.url)), `${JSON.stringify(plan, null, 2)}\n`);
console.log(`plan.json: ${products.length} products, ${products.reduce((sum, entry) => sum + entry.variants.length, 0)} variants, ${collections.length} collections, ${pages.length} pages, ${reviews.length} reviews.`);
if (leftovers.length) console.log(`Leftover words to review: ${[...new Set(leftovers)].join(", ")}`);
