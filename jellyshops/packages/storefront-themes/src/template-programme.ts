/**
 * The 20-template programme (docs/reports/2026-11-08-twenty-template-categories-research.md).
 *
 * Every template is described by the layout types ("archetypes") it uses for six parts of the
 * store. `checkTemplateDistinctness` enforces the rule that keeps the templates genuinely different:
 * two templates may share at most three of the six choices and never both the hero and the
 * product page, and each template has its own display typeface.
 */

export const ARCHETYPE_DIMENSIONS = ["header", "hero", "card", "collection", "product", "cart"] as const;
export type ArchetypeDimension = (typeof ARCHETYPE_DIMENSIONS)[number];

export type ArchetypeOption = {
  code: string;
  label: string;
  /** The setting value that draws this archetype today, when it is built. */
  implementation?: { section: string; setting: string; value: string | boolean };
};

export const ARCHETYPES: Record<ArchetypeDimension, ArchetypeOption[]> = {
  header: [
    { code: "H1", label: "Centred logo, menu split left and right", implementation: { section: "header", setting: "layout", value: "split" } },
    { code: "H2", label: "Logo left, menu beside it, search", implementation: { section: "header", setting: "layout", value: "classic" } },
    { code: "H3", label: "Header over the first image", implementation: { section: "header", setting: "transparent", value: true } },
    { code: "H4", label: "Minimal bar, full-screen menu", implementation: { section: "header", setting: "layout", value: "minimal" } },
    { code: "H5", label: "Two rows: logo, search and tools, then a category bar", implementation: { section: "header", setting: "layout", value: "category-bar" } },
    { code: "H6", label: "Side navigation always visible on desktop" },
    { code: "H7", label: "Vertical rail" },
    { code: "H8", label: "Search first, with a delivery note", implementation: { section: "header", setting: "layout", value: "search-first" } },
    { code: "H9", label: "Search box left, logo in the middle, menu row under it", implementation: { section: "header", setting: "layout", value: "search-bar" } },
  ],
  hero: [
    { code: "R1", label: "Full-bleed video" },
    { code: "R2", label: "Split image and text" },
    { code: "R3", label: "Editorial collage" },
    { code: "R4", label: "Product on a colour field with callouts" },
    { code: "R5", label: "Slideshow with promotion tiles" },
    { code: "R6", label: "Countdown to a drop" },
    { code: "R7", label: "Shoppable scene with hotspots" },
    { code: "R8", label: "Finder (vehicle, gift, quiz)" },
    { code: "R9", label: "Type-led statement" },
  ],
  card: [
    { code: "C1", label: "Tall image, minimal text" },
    { code: "C2", label: "Square with spec chips" },
    { code: "C3", label: "Quick-add quantity stepper" },
    { code: "C4", label: "Tinted field with benefit chips" },
    { code: "C5", label: "Outlined technical card with compare" },
    { code: "C6", label: "Framed or arched image" },
    { code: "C7", label: "Large landscape lifestyle card" },
    { code: "C8", label: "List row" },
  ],
  collection: [
    { code: "L1", label: "Editorial grid with story tiles" },
    { code: "L2", label: "Dense grid with sidebar filters" },
    { code: "L3", label: "Filter chips on top" },
    { code: "L4", label: "Shop by need first, then the grid" },
    { code: "L5", label: "Table with bulk add" },
    { code: "L6", label: "Browse by room or scene" },
    { code: "L7", label: "Aisle rows" },
  ],
  product: [
    { code: "P1", label: "Stacked images, sticky details" },
    { code: "P2", label: "Details left, images scroll right" },
    { code: "P3", label: "Centred image, details in tabs below" },
    { code: "P4", label: "Gallery with specification tables" },
    { code: "P5", label: "Configurator" },
    { code: "P6", label: "Story chapters" },
    { code: "P7", label: "Compact buy box with quantity" },
    { code: "P8", label: "Enquiry or appointment led" },
  ],
  cart: [
    { code: "K1", label: "Full-height drawer" },
    { code: "K2", label: "Cart page with suggestions" },
    { code: "K3", label: "Mini-cart popover" },
    { code: "K4", label: "Bottom sheet on phones, drawer on desktop" },
    { code: "K5", label: "Order pad" },
    { code: "K6", label: "Drawer with a gift step" },
  ],
};

export type TemplatePlan = {
  /** Working name shown to merchants (checked against the Shopify Theme Store on 2026-11-08). */
  name: string;
  category: string;
  /** Theme id once the template exists. Never change an id after release. */
  themeId?: string;
  status: "existing" | "planned";
  phase: 1 | 2 | 3 | 4 | 5;
  archetypes: Record<ArchetypeDimension, string>;
  displayFont: string;
  signature: string;
};

const a = (header: string, hero: string, card: string, collection: string, product: string, cart: string) => ({ header, hero, card, collection, product, cart });

export const TEMPLATE_PROGRAMME: TemplatePlan[] = [
  { name: "Avenue", category: "Fashion editorial", themeId: "jelly-avenue", status: "existing", phase: 2, archetypes: a("H3", "R3", "C1", "L1", "P1", "K1"), displayFont: "Avenue (current)", signature: "Shop the look" },
  { name: "Asphalt", category: "Streetwear and limited drops", status: "planned", phase: 1, archetypes: a("H4", "R6", "C1", "L3", "P2", "K1"), displayFont: "Syne", signature: "Drop calendar and notify me" },
  { name: "Zari", category: "Ethnic and occasion wear", status: "planned", phase: 2, archetypes: a("H1", "R2", "C6", "L4", "P5", "K2"), displayFont: "Cormorant Garamond", signature: "Stitching and measurements" },
  { name: "Halo", category: "Beauty and skincare", status: "planned", phase: 1, archetypes: a("H2", "R4", "C4", "L4", "P6", "K1"), displayFont: "Plus Jakarta Sans", signature: "Routine builder" },
  { name: "Gilt", category: "Jewellery", status: "planned", phase: 1, archetypes: a("H1", "R9", "C1", "L1", "P8", "K6"), displayFont: "EB Garamond", signature: "Engraving and gift step" },
  { name: "Dose", category: "Wellness and supplements", status: "planned", phase: 3, archetypes: a("H1", "R9", "C4", "L4", "P6", "K2"), displayFont: "Outfit", signature: "Build your stack" },
  { name: "Trailhead", category: "Sport and outdoor", status: "planned", phase: 2, archetypes: a("H3", "R1", "C2", "L2", "P4", "K1"), displayFont: "Oswald", signature: "Gear finder" },
  { name: "Diode", category: "Electronics", status: "planned", phase: 1, archetypes: a("H2", "R4", "C5", "L2", "P4", "K1"), displayFont: "Space Grotesk", signature: "Compare tray" },
  { name: "Linden", category: "Home decor", status: "planned", phase: 2, archetypes: a("H1", "R7", "C7", "L6", "P1", "K2"), displayFont: "Lora", signature: "Shop the room page" },
  { name: "Forma", category: "Furniture", themeId: "jelly-forma", status: "existing", phase: 4, archetypes: a("H2", "R7", "C7", "L2", "P5", "K2"), displayFont: "Manrope", signature: "Configurator with dimensions" },
  { name: "Resthaven", category: "Sleep and big-ticket showroom", themeId: "jelly-resthaven", status: "existing", phase: 4, archetypes: a("H9", "R5", "C2", "L3", "P5", "K2"), displayFont: "Playfair Display", signature: "Finance, trial and firmness" },
  { name: "Basket", category: "Grocery", status: "planned", phase: 1, archetypes: a("H8", "R5", "C3", "L7", "P7", "K4"), displayFont: "Poppins", signature: "Reorder and lists" },
  { name: "Larder", category: "Gourmet food and drink", status: "planned", phase: 2, archetypes: a("H3", "R7", "C4", "L1", "P6", "K1"), displayFont: "Libre Baskerville", signature: "Build a box" },
  { name: "Acorn", category: "Kids and baby", status: "planned", phase: 3, archetypes: a("H1", "R2", "C4", "L4", "P3", "K6"), displayFont: "Fredoka", signature: "Age and stage navigator" },
  { name: "Kibble", category: "Pets", status: "planned", phase: 3, archetypes: a("H2", "R8", "C3", "L3", "P7", "K1"), displayFont: "Bricolage Grotesque", signature: "Pet profile and feeding calculator" },
  { name: "Loom", category: "Handmade, art and stationery", status: "planned", phase: 4, archetypes: a("H6", "R3", "C6", "L1", "P3", "K3"), displayFont: "Crimson Pro", signature: "Edition and frame picker" },
  { name: "Stem", category: "Flowers and gifting", status: "planned", phase: 3, archetypes: a("H8", "R8", "C4", "L4", "P5", "K6"), displayFont: "Gloock", signature: "Date-first ordering" },
  { name: "Ratchet", category: "Auto parts, tools and hardware", status: "planned", phase: 5, archetypes: a("H5", "R8", "C8", "L5", "P4", "K5"), displayFont: "Barlow Condensed", signature: "Garage and fitment check" },
  { name: "Bazaar", category: "Multi-category megastore", status: "planned", phase: 5, archetypes: a("H5", "R5", "C2", "L2", "P4", "K2"), displayFont: "Figtree", signature: "Department landing pages" },
  { name: "Glyph", category: "Digital products and creators", status: "planned", phase: 4, archetypes: a("H4", "R9", "C7", "L3", "P3", "K3"), displayFont: "Unbounded", signature: "Instant delivery and licence picker" },
];

export const MAX_SHARED_ARCHETYPES = 3;

export function sharedArchetypes(first: TemplatePlan, second: TemplatePlan): ArchetypeDimension[] {
  return ARCHETYPE_DIMENSIONS.filter((dimension) => first.archetypes[dimension] === second.archetypes[dimension]);
}

/** Plain-language problems that break the "every template is different" rule; empty when the plan is fine. */
export function checkTemplateDistinctness(plans: readonly TemplatePlan[] = TEMPLATE_PROGRAMME): string[] {
  const problems: string[] = [];
  const known = new Map(ARCHETYPE_DIMENSIONS.map((dimension) => [dimension, new Set(ARCHETYPES[dimension].map((option) => option.code))]));
  for (const plan of plans) {
    for (const dimension of ARCHETYPE_DIMENSIONS) {
      if (!known.get(dimension)?.has(plan.archetypes[dimension])) problems.push(`${plan.name}: unknown ${dimension} layout ${plan.archetypes[dimension]}.`);
    }
  }
  for (let i = 0; i < plans.length; i += 1) {
    for (let j = i + 1; j < plans.length; j += 1) {
      const shared = sharedArchetypes(plans[i], plans[j]);
      if (shared.length > MAX_SHARED_ARCHETYPES) problems.push(`${plans[i].name} and ${plans[j].name} share ${shared.length} layouts (${shared.join(", ")}); at most ${MAX_SHARED_ARCHETYPES} are allowed.`);
      if (shared.includes("hero") && shared.includes("product")) problems.push(`${plans[i].name} and ${plans[j].name} share both the hero and the product page.`);
    }
  }
  const seen = new Map<string, string>();
  for (const plan of plans) {
    for (const [key, label] of [[plan.name.toLowerCase(), "name"], [`font:${plan.displayFont.toLowerCase()}`, "display font"]] as const) {
      const other = seen.get(key);
      if (other) problems.push(`${plan.name} and ${other} use the same ${label}.`);
      else seen.set(key, plan.name);
    }
  }
  return problems;
}
