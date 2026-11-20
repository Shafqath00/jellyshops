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
// Every message in one slow line that scrolls sideways (announcement style "Scroll sideways").
announcement.settings.style = "marquee";
const announcementLines = ["Beds delivered in 5 to 7 working days", "Two-person delivery to the room of your choice", "Try every bed in our showroom, open 7 days"];
announcement.blocks.forEach((block, index) => { block.settings.text = announcementLines[index] ?? block.settings.text; });

const header = global("studio-header");
Object.assign(header.settings, { extraLinkLabel: "Visit our showroom", extraLink: "/contact", extraLinkIcon: "phone", sticky: true });

const footer = global("studio-footer");
Object.assign(footer.settings, {
  text: "Beds, mattresses and headboards, delivered fast by our own two-person team.",
  newsletterHeading: "Offers and sleep tips",
  newsletterText: "Occasional emails about new beds and showroom events. Unsubscribe at any time.",
  paymentMethods: "Visa, Mastercard, American Express, Apple Pay, Klarna",
  wordmark: true,
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
// Express Bed photos: public/images/express-bed/<name>.webp (labelled placeholders until the real photos arrive;
// docs/express-bed/image-prompts.md, scripts/express-bed/images.mjs).
const eb = (name, alt, extra = {}) => ({ url: `/images/express-bed/${name}.webp`, alt, ...extra });
const textNode = (text, italic) => ({ type: "text", text, ...(italic ? { marks: [{ type: "italic" }] } : {}) });
/** A one-line heading with an italic accent word: the plain text and its formatted copy (Editorial look > accent words). */
const accented = (key, ...parts) => ({ [key]: parts.map(([text]) => text).join(""), [`${key}Doc`]: { type: "doc", content: [{ type: "paragraph", content: parts.map(([text, italic]) => textNode(text, italic)) }] } });
const blockOf = (id, type, settings, blocks = []) => ({ id, type, enabled: true, settings, blocks });
const sectionOf = (id, type, settings, blocks = []) => ({ kind: "inline", section: { id, type, enabled: true, settings, blocks } });
// "From £299": the cheapest size of the cheapest matching product.
const fromPrice = (match) => `From £${Math.min(...products.filter(match).flatMap((entry) => entry.variants.map((variant) => variant.priceMinor))) / 100 | 0}`;

// 1. Hero: inset photo with swept corner, magazine headline, floating best-seller card, promises on the bottom edge.
const hero = inline(home, "studio-hero");
Object.assign(hero.settings, {
  layout: "overlay", height: "large", overlay: 0, eyebrow: "Beds, mattresses and headboards",
  image: eb("eb-hero-1", "A sunlit bedroom with a cobalt velvet bed, white bedding and tangerine and yellow cushions", { fit: "cover", focalPoint: { x: 64, y: 55 } }),
  promises: ["truck: Two-person delivery to your room", "clock: Delivered in 5 to 7 working days", "card: Spread the cost with Klarna", "home: Try every bed in our showroom"].join("\n"),
});
Object.assign(block(hero, "resthaven-hero-title").settings, accented("text", ["Beds worth "], ["waking up for.", true]));
block(hero, "resthaven-hero-text").settings.text = "Beds, mattresses and headboards in every size from single to super king, carried to the room of your choice by our own two-person team.";
Object.assign(block(hero, "resthaven-hero-action-0").settings, { label: "Shop beds", href: "/collections/beds" });
Object.assign(block(hero, "resthaven-hero-action-1").settings, { label: "Find your mattress", href: "/collections/mattresses" });
hero.blocks.push(blockOf("expressbed-hero-card", "floating-card", { eyebrow: "Best seller", position: "bottom-right" }));

// 2. Shop by type: bento tiles with "From £" labels.
const types = inline(home, "resthaven-categories");
Object.assign(types.settings, { ...accented("heading", ["Shop by "], ["type", true]), text: "From storage ottomans to statement wingbacks, every frame comes in every size.", layout: "bento", columns: 3, imageRatio: "portrait" });
types.blocks = [
  ["upholstered", "Upholstered beds", "eb-cat-upholstered", "A tall cobalt velvet wingback bed in a bright room", "/collections/beds?f.type=Upholstered%20bed", (entry) => entry.type === "Upholstered bed"],
  ["ottoman", "Ottoman storage beds", "eb-cat-ottoman", "A tangerine linen ottoman bed with its storage base open", "/collections/beds?f.type=Ottoman%20bed", (entry) => entry.type === "Ottoman bed"],
  ["divan", "Divan beds", "eb-cat-divan", "A cobalt buttoned divan bed with drawers", "/collections/beds?f.type=Divan%20bed", (entry) => entry.type === "Divan bed"],
  ["mattresses", "Mattresses", "eb-cat-mattresses", "A deep pocket sprung mattress with a quilted top", "/collections/mattresses", (entry) => entry.collections.includes("mattresses")],
  ["headboards", "Headboards", "eb-cat-headboards", "A blush velvet scalloped headboard", "/collections/headboards", (entry) => entry.collections.includes("headboards")],
].map(([handle, label, image, alt, link, match]) => blockOf(`expressbed-type-${handle}`, "collection-card", { label, image: eb(image, alt), link, chip: fromPrice(match) }));

// 3. Shop by size, drawn to scale (the four sizes the store sells).
const sizes = sectionOf("expressbed-sizes", "size-picker", {
  eyebrow: "Shop by size", ...accented("heading", ["Find your "], ["fit", true]), text: "Every size drawn to scale. Tap one to see the beds that come in it.", unit: "cm", contentAlignment: "left", styleScheme: "scheme2",
}, [["Single", 90, 190], ["Double", 135, 190, "Most popular"], ["King", 150, 200], ["Super King", 180, 200]].map(([label, width, length, note]) => blockOf(`expressbed-size-${label.toLowerCase().replace(/ /g, "-")}`, "size-option", { label, width, length, ...(note ? { note } : {}), link: `/collections/beds?f.size=${encodeURIComponent(label)}` })));

// 4. Best sellers.
Object.assign(inline(home, "resthaven-featured").settings, { ...accented("heading", ["Our best "], ["sellers", true]), text: "The beds, mattresses and headboards our customers choose most.", viewAllLabel: "Shop all beds", viewAllLink: "/collections/beds", limit: 8, columns: 4 });

// 5. Offer panel on Butter. The code must exist in Admin > Discounts before this goes live.
const offer = sectionOf("expressbed-offer", "offer-panel", {
  eyebrow: "Weekend offer", bigText: "20% off", ...accented("heading", ["Every bed, "], ["every size", true]),
  text: "Add the code at checkout. Ends Sunday 30 November at midnight.", code: "SLEEP20", codeLabel: "Use code",
  countdownTo: "2026-11-30 23:59", countdownEndText: "This offer has ended. Keep an eye out for the next one.",
  image: eb("eb-offer", "A cobalt velvet bed with a tangerine cushion against a butter yellow wall"), imageLabel: "Calder ottoman in cobalt velvet", imagePosition: "right",
  buttonLabel: "Shop the offer", buttonLink: "/collections/beds", styleScheme: "scheme3",
});

// 6. Shop by room.
const rooms = sectionOf("expressbed-rooms", "category-grid", { ...accented("heading", ["Shop by "], ["room", true]), text: "Beds picked for the way each room is used.", layout: "grid", columns: 4, imageRatio: "portrait" }, [
  ["main", "Main bedroom", "eb-room-main", "A calm main bedroom with a king-size cobalt bed", "/collections/beds?f.type=Upholstered%20bed"],
  ["guest", "Guest room", "eb-room-guest", "A welcoming guest room with a blush double bed", "/collections/beds?f.type=Divan%20bed"],
  ["kids", "Kids room", "eb-room-kids", "A cheerful child's room with a wooden single bed", "/collections/beds?f.size=Single"],
  ["small", "Small rooms", "eb-room-small", "A narrow box room with a butter boucle ottoman bed", "/collections/beds?f.type=Ottoman%20bed"],
].map(([handle, label, image, alt, link]) => blockOf(`expressbed-room-${handle}`, "collection-card", { label, image: eb(image, alt), link })));

// 7. Comfort story on Ink.
const mattressStory = inline(home, "resthaven-mattress-feature");
Object.assign(mattressStory.settings, { eyebrow: "Mattresses", image: eb("eb-mattress-layers", "A cut-away mattress showing its quilted top, comfort foam and pocket springs"), imagePosition: "right", styleScheme: "scheme4" });
Object.assign(mattressStory.blocks[0].settings, accented("text", ["Built in layers. "], ["Made for you.", true]));
mattressStory.blocks[1].settings.text = "Pocket springs, memory foam or both, from soft to firm. Every mattress page lists its layers, feel and exact sizes, and you can lie on all of them in our showroom.";
Object.assign(mattressStory.blocks[2].settings, { label: "Find your mattress", href: "/collections/mattresses" });

// 8. Fabric swatches.
const fabrics = sectionOf("expressbed-fabrics", "swatch-showcase", {
  eyebrow: "Fabrics", ...accented("heading", ["Feel the "], ["difference", true]), text: "Every upholstered frame comes in hard-wearing fabrics. Pick one to see it in a room.",
  image: eb("eb-fabrics", "Fabric swatches in cobalt velvet, tangerine linen, butter boucle and mint weave"), imagePosition: "left", buttonLabel: "Feel them in the showroom", buttonLink: "/contact",
}, [
  ["velvet", "Velvet", "#2348E0", "Soft sheen, rich colour", "eb-cat-upholstered", "/collections/beds?f.fabric=Velvet"],
  ["boucle", "Boucle", "#F3E6C9", "Cosy, looped texture", "eb-room-small", "/collections/beds?f.fabric=Boucle"],
  ["linen", "Linen", "#FF7A45", "Washed and relaxed", "eb-cat-ottoman", "/collections/headboards"],
  ["weave", "Weave", "#CFEFDF", "Hard-wearing, family proof", "eb-cat-divan", "/collections/beds?f.fabric=Woven"],
].map(([handle, name, color, note, photo, link]) => blockOf(`expressbed-swatch-${handle}`, "swatch", { name, color, note, link, image: eb(`eb-swatch-${handle}`, `${name} fabric close up`), photo: eb(photo, `A bed in ${name.toLowerCase()}`) })));

// 9. Shop the look on Blush.
const look = inline(home, "resthaven-shop-look");
Object.assign(look.settings, { eyebrow: "Shop the room", ...accented("heading", ["A calm "], ["main bedroom", true]), text: "One bed, one mattress and a headboard that ties the room together. Tap a pin to see each piece.", image: eb("eb-room-main", "A main bedroom with a cobalt upholstered bed, oak bedside tables and lamps"), styleScheme: "scheme6" });

// 10. Reviews: tinted cards that scroll sideways.
const testimonials = inline(home, "resthaven-reviews");
Object.assign(testimonials.settings, { ...accented("heading", ["Loved in homes "], ["like yours", true]), layout: "carousel", cardStyle: "tinted" });
const quotes = [
  ["The bed arrived on the day they promised and the team carried it upstairs and built it in twenty minutes.", "Bought the Calder ottoman bed"],
  ["I tried every mattress in the showroom before choosing. Three weeks in and my back has never felt better.", "Bought the Hollis mattress"],
  ["Ordered a headboard on Monday, fitted by Friday. It has completely changed the room.", "Bought the Arlo headboard"],
  ["Helpful staff, no pressure and the price matched what I saw online.", "Visited the showroom"],
];
testimonials.blocks.forEach((entry, index) => { if (quotes[index]) Object.assign(entry.settings, { quote: `${quotes[index][0]} (Sample review.)`, detail: quotes[index][1], rating: 5 }); });

// 11. How delivery works, with real dates.
const steps = sectionOf("expressbed-steps", "steps", {
  eyebrow: "How delivery works", ...accented("heading", ["From our showroom to "], ["your bedroom", true]), text: "Dates are worked out from today. Order before 2pm and today counts.",
  showDates: true, cutoffHour: 14, weekends: false, contentAlignment: "left", styleScheme: "scheme2",
}, [
  ["order", "Order today", "Pick your bed, size and extras. Pay now or spread the cost with Klarna.", "card", 0],
  ["call", "We call you", "Our team calls to book a two-hour delivery slot that suits you.", "phone", 1],
  ["deliver", "In your room", "Two people carry it to the room you choose, build it if you added assembly and take the packaging away.", "truck", 5],
].map(([handle, title, text, icon, days]) => blockOf(`expressbed-step-${handle}`, "step", { title, text, icon, days })));

// 12. Product spotlight.
Object.assign(inline(home, "resthaven-spotlight").settings, { text: "Our best-selling storage bed: a full ottoman lift, a padded headboard and soft velvet, delivered to the room of your choice.", buttonLabel: "View the bed" });

// 13. Showroom story.
const story = inline(home, "resthaven-brand-story");
story.settings.image = eb("eb-showroom", "A bright bed showroom with styled beds in cobalt, blush, butter and mint");
Object.assign(story.blocks[0].settings, accented("text", ["A showroom you can "], ["sleep on", true]));
story.blocks[1].settings.text = "Lie on every mattress, sit on every bed and feel every fabric before you buy. Then let our own delivery team bring it home.";
if (story.blocks[2]) Object.assign(story.blocks[2].settings, { label: "Visit our showroom", href: "/contact" });

// 14. Questions.
const faq = sectionOf("expressbed-home-faq", "faq", { ...accented("heading", ["Questions, "], ["answered", true]), text: "Quick answers about delivery, paying and sizes. More in our help pages." },
  pages.find((page) => page.handle === "faq").body.map(([question, answer], index) => blockOf(`expressbed-home-faq-${index}`, "faq-item", { question, answer })));

// 15. Sign-up on Cobalt.
const newsletter = inline(home, "resthaven-newsletter");
Object.assign(newsletter.blocks[0].settings, accented("text", ["Sleep better, "], ["spend less", true]));
newsletter.blocks[1].settings.text = "New arrivals, showroom events and early access to offers. Once or twice a month.";
newsletter.settings.styleScheme = "scheme5";

{
  const order = ["studio-hero", "resthaven-categories", "expressbed-sizes", "resthaven-featured", "expressbed-offer", "expressbed-rooms", "resthaven-mattress-feature", "expressbed-fabrics", "resthaven-shop-look", "resthaven-reviews", "expressbed-steps", "resthaven-spotlight", "resthaven-brand-story", "expressbed-home-faq", "resthaven-newsletter"];
  const placements = [...home.sections, sizes, offer, rooms, fabrics, steps, faq];
  const inlineById = new Map(placements.filter((placement) => placement.kind === "inline").map((placement) => [placement.section.id, placement]));
  const before = home.sections.filter((placement) => placement.kind !== "inline" && home.sections.indexOf(placement) < home.sections.findIndex((entry) => entry.kind === "inline"));
  const after = home.sections.filter((placement) => placement.kind !== "inline" && !before.includes(placement));
  const unknown = order.filter((id) => !inlineById.has(id));
  if (unknown.length) throw new Error(`Home sections not found: ${unknown.join(", ")}`);
  // Left out on purpose: the old promo, fabric story, trust row (the hero's promises replace it) and stock gallery.
  home.sections = [...before, ...order.map((id) => inlineById.get(id)), ...after];
  // Every band's colour is set here (paper unless chosen above), never inherited from the starter's own choices.
  for (const id of order) {
    const settings = inlineById.get(id).section.settings;
    if (!settings.styleScheme) settings.styleScheme = "scheme1";
    delete settings.colorScheme;
  }
}


// Product page, two columns on large screens:
//   left  = photos, then "Complete the set", the description, details, dimensions and reviews (blocks set to
//           "Under the photos");
//   right = a short buying panel that stays in view: rating, title and price, size tiles with their prices, extras
//           as tick cards, quantity and Add to basket (delivery and returns promises sit under the photos).
// Phones stack photos, buying panel, then the rest; a bottom bar keeps the price and Add to basket in reach.
const productLayout = template("product");
const mainProduct = productLayout.sections.find((placement) => placement.kind === "inline" && placement.section.type === "main-product").section;
Object.assign(mainProduct.settings, { mediaWidth: "wide", mediaRatio: "square", stickyColumn: "details" });
const partOf = (type) => mainProduct.blocks.find((entry) => entry.type === type);
Object.assign(partOf("part-product-options").settings, { style: "tiles", tileColumns: 2 });
Object.assign(partOf("part-product-purchase").settings, { stickyBar: true, showPrice: true, label: "Add to bag" });
// Delivery and returns promises sit under the photos with the other reading content, keeping the panel short.
Object.assign(partOf("part-trust-strip").settings, { column: "below" });
Object.assign(partOf("part-product-description").settings, { layout: "plain", column: "below" });
Object.assign(partOf("part-product-specifications").settings, { layout: "table", column: "below" });
const takeSection = (type) => {
  const index = productLayout.sections.findIndex((placement) => placement.kind === "inline" && placement.section.type === type);
  return index < 0 ? undefined : productLayout.sections.splice(index, 1)[0].section;
};
// The delivery countdown sits right under Add to bag: "Order in 3h 12m for delivery Tue 2 – Thu 4 Dec".
mainProduct.blocks.splice(mainProduct.blocks.indexOf(partOf("part-product-purchase")) + 1, 0, {
  id: "expressbed-delivery-clock", type: "delivery-estimate", enabled: true, blocks: [],
  settings: { cutoffHour: 14, dispatchDays: 0, deliveryMin: 5, deliveryMax: 7, style: "clock", column: "panel" },
});
const dimensions = takeSection("product-dimensions");
const reviewsSection = takeSection("product-reviews");
const purchaseAt = mainProduct.blocks.findIndex((entry) => entry.type === "part-product-trust-strip" || entry.type === "part-trust-strip");
mainProduct.blocks.splice(purchaseAt + 1, 0, {
  // Under the photos, first: seen right after choosing a size, without making the buying panel taller.
  id: "expressbed-complete-set", type: "complementary-products", enabled: true, blocks: [],
  settings: { heading: "Complete the set", limit: 3, source: "pairs", addToBag: true, matchSize: true, column: "below" },
});
mainProduct.blocks.push(
  ...(dimensions ? [{ id: dimensions.id, type: "part-product-dimensions", enabled: true, blocks: [], settings: { ...dimensions.settings, column: "below" } }] : []),
  ...(reviewsSection ? [{ id: reviewsSection.id, type: "part-product-reviews", enabled: true, blocks: [], settings: { ...reviewsSection.settings, column: "below" } }] : []),
);

const collection = template("collection");
// Quick links under the collection title switch between the main ranges.
Object.assign(collection.sections.find((placement) => placement.kind === "inline" && placement.section.type === "collection-header").section.settings, {
  showBreadcrumb: true, showDescription: true, descriptionLines: "2",
  quickLinks: ["Beds | /collections/beds", "Ottoman storage | /collections/beds?f.type=Ottoman%20bed", "Upholstered | /collections/beds?f.type=Upholstered%20bed", "Mattresses | /collections/mattresses", "Headboards | /collections/headboards"].join("\n"),
});
const help = inline(collection, "resthaven-collection-help");
block(help, "resthaven-collection-help-title").settings.text = "Not sure which size or feel is right?";
block(help, "resthaven-collection-help-text").settings.text = "Every product page lists exact measurements for each size. Still unsure? Visit the showroom and try them all.";
Object.assign(block(help, "resthaven-collection-help-action").settings, { label: "Read our size guide", href: "/pages/faq" });

// Bag page: a row of best sellers under the bag, so a bed order can pick up its mattress and headboard.
{
  const cart = template("cart");
  const at = cart.sections.findIndex((placement) => placement.kind === "inline" && placement.section.type === "cart-summary");
  cart.sections.splice(at + 1, 0, sectionOf("expressbed-cart-more", "product-grid", { ...accented("heading", ["Finish the "], ["bedroom", true]), text: "Mattresses and headboards to go with your bed, delivered together.", limit: 4, columns: 4, styleScheme: "scheme1" }));
}

// 404: a friendlier line and the best sellers, so a dead link still leads somewhere.
{
  const notFound = template("not-found");
  const message = notFound.sections.find((placement) => placement.kind === "inline" && placement.section.type === "not-found-message")?.section;
  const heading = message?.blocks.find((entry) => entry.type === "heading");
  if (heading) Object.assign(heading.settings, accented("text", ["This bed has "], ["already been made.", true]));
  const text = message?.blocks.find((entry) => entry.type === "text");
  if (text) text.settings.text = "The page you were looking for has moved or no longer exists. Try a search, or start with our best sellers.";
  const at = notFound.sections.indexOf(notFound.sections.find((placement) => placement.kind === "inline" && placement.section.type === "not-found-message"));
  notFound.sections.splice(at + 1, 0, sectionOf("expressbed-404-best", "product-grid", { ...accented("heading", ["Our best "], ["sellers", true]), limit: 4, columns: 4, viewAllLabel: "Shop all beds", viewAllLink: "/collections/beds", styleScheme: "scheme1" }));
}

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
    link("Main bedroom", "/collections/beds", [], { url: "/images/express-bed/eb-room-main.webp", alt: "A main bedroom with a cobalt upholstered bed" }),
    link("Guest room", "/collections/beds?f.type=Divan%20bed", [], { url: "/images/express-bed/eb-room-guest.webp", alt: "A guest room with a blush double bed" }),
    link("Kids room", "/collections/beds?f.size=Single", [], { url: "/images/express-bed/eb-room-kids.webp", alt: "A child's room with a wooden single bed" }),
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
// Theme settings: Resthaven with the "Express Sunrise" style (paper, ink, cobalt, tangerine and butter, Editorial look on;
// 2026-11-20 premium showroom brief, docs/reports/2026-11-20-express-bed-showroom-design-brief.md).
// ---------------------------------------------------------------------------------------------------------------
const style = themes.listThemeStyles("jelly-resthaven").find((entry) => entry.id === "express-sunrise");
const themeSettings = themes.applyThemeStyle(structuredClone(pack.theme.settings), style);
themeSettings.cart = { ...(themeSettings.cart ?? {}), type: "drawer", freeDeliveryFrom: 0 };
// Cards: the theme defaults (stars, % off, second photo on hover, colour dots) plus Quick view.
const resthavenDefaults = JSON.parse(readFileSync(fileURLToPath(new URL("jellyshops/packages/storefront-themes/src/themes/jelly-resthaven/theme.json", `file:///${root.replaceAll("\\", "/")}`)), "utf8")).settingsDefaults;
themeSettings.productCard = { ...resthavenDefaults.productCard, ...(themeSettings.productCard ?? {}), quickView: true };

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
    { template: "home", section: "studio-hero", block: "expressbed-hero-card", product: "calder-ottoman-storage-bed" },
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

// ---------------------------------------------------------------------------------------------------------------
// Local preview (/theme-preview/express-bed): the same design with the products as sample cards, so the store can be
// reviewed in the browser before it is installed or published. Written into the app; never sent anywhere.
// ---------------------------------------------------------------------------------------------------------------
{
  const money = (minor) => `£${(minor / 100).toFixed(2)}`;
  const photoUrl = (name) => `/themes/jelly-resthaven/${name}.webp`;
  const sampleProducts = products.map((entry) => {
    const cheapest = entry.variants.reduce((low, variant) => (variant.priceMinor < low.priceMinor ? variant : low), entry.variants[0]);
    const tagFilters = entry.tags.filter((tag) => tag.includes(":")).map((tag) => tag.split(":")).map(([name, value]) => ({ name, values: [value] }));
    return {
      id: entry.handle, name: entry.title, price: money(cheapest.priceMinor), priceMinor: cheapest.priceMinor, available: true, href: "#",
      ...(cheapest.compareAtPriceMinor ? { compareAtPrice: money(cheapest.compareAtPriceMinor), saving: money(cheapest.compareAtPriceMinor - cheapest.priceMinor), discountPercent: Math.round((1 - cheapest.priceMinor / cheapest.compareAtPriceMinor) * 100) } : {}),
      imageUrl: photoUrl(entry.images[0]), ...(entry.images[1] ? { hoverImageUrl: photoUrl(entry.images[1]) } : {}),
      filters: [{ name: "Size", values: SIZES }, { name: "Type", values: [entry.type] }, ...tagFilters],
      collection: entry.collections[0], about: entry.about, specifications: entry.specifications, gallery: entry.images.map(photoUrl),
      sizes: entry.variants.map((variant) => ({ label: variant.options.Size, price: money(variant.priceMinor) })),
    };
  });
  // Product picks point at products by handle; the preview's product ids are the handles.
  const previewTemplates = structuredClone(pack.templates);
  for (const linkEntry of plan.productLinks) {
    const layout = previewTemplates.find((entry) => entry.key === linkEntry.template)?.layout;
    const section = layout?.sections.find((placement) => placement.kind === "inline" && placement.section.id === linkEntry.section)?.section;
    const target = linkEntry.block ? section?.blocks.find((entry) => entry.id === linkEntry.block) : section;
    if (target) target.settings = { ...target.settings, productId: linkEntry.product };
  }
  const design = {
    _comment: "Generated by scripts/express-bed/build-plan.mjs. Do not edit by hand.",
    themeSettings,
    pack: { ...pack, id: "express-bed", name: "Express Bed", theme: { ...pack.theme, settings: themeSettings }, templates: previewTemplates, menus: [{ key: "main", handle: "main", items: mainMenu }] },
    products: sampleProducts,
    reviews: reviews.map(({ product, rating }) => ({ product, rating })),
  };
  writeFileSync(fileURLToPath(new URL("jellyshops/src/features/theme-preview/express-bed-design.json", `file:///${root.replaceAll("\\", "/")}`)), `${JSON.stringify(design, null, 2)}\n`);
  const usedPhotos = [...new Set(JSON.stringify(design.pack).match(/\/images\/express-bed\/[a-z0-9-]+\.webp/g) ?? [])];
  const missing = usedPhotos.filter((url) => { try { readFileSync(fileURLToPath(new URL(`jellyshops/public${url}`, `file:///${root.replaceAll("\\", "/")}`))); return false; } catch { return true; } });
  if (missing.length) throw new Error(`Missing Express Bed photos (run node scripts/express-bed/images.mjs placeholders): ${missing.join(", ")}`);
  console.log(`express-bed-design.json: preview design with ${sampleProducts.length} sample products, ${usedPhotos.length} Express Bed photos.`);
}
