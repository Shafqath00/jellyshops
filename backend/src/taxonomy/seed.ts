export type SeedTemplate = {
  name: string;
  kind: "variant" | "configuration" | "addon";
  display?: "buttons" | "dropdown" | "color" | "image";
  required?: boolean;
  multiple?: boolean;
  values?: string[];
};

export type SeedCategory = { name: string; templates?: SeedTemplate[]; children?: SeedCategory[] };

const size = (...values: string[]): SeedTemplate => ({ name: "Size", kind: "variant", required: true, values });
const colour = (...values: string[]): SeedTemplate => ({ name: "Colour", kind: "variant", display: "color", required: true, values });
const LETTER_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

/**
 * Platform starter tree. Copied into each store on first use (never referenced),
 * so merchants can rename, hide or extend it freely. Templates are inherited by
 * sub-categories and are only suggestions. Add industries here; no schema change needed.
 */
export const PLATFORM_CATEGORY_SEED: SeedCategory[] = [
  {
    name: "Fashion",
    children: [
      { name: "Men", children: [
        { name: "T-Shirts", templates: [size(...LETTER_SIZES), colour("Black", "White")] },
        { name: "Shirts", templates: [size(...LETTER_SIZES), colour("White", "Blue")] },
        { name: "Jeans", templates: [size("28", "30", "32", "34", "36"), colour("Blue", "Black")] },
        { name: "Shoes", templates: [size("6", "7", "8", "9", "10", "11"), colour("Black", "White")] },
      ] },
      { name: "Women", children: [
        { name: "Tops", templates: [size(...LETTER_SIZES), colour("Black", "White")] },
        { name: "Dresses", templates: [size(...LETTER_SIZES), colour("Black", "Red")] },
        { name: "Shoes", templates: [size("4", "5", "6", "7", "8"), colour("Black", "Beige")] },
      ] },
      { name: "Kids" },
      { name: "Accessories", children: [{ name: "Bags" }, { name: "Watches" }, { name: "Belts" }] },
    ],
  },
  {
    name: "Furniture",
    children: [
      { name: "Bedroom", children: [
        { name: "Beds", templates: [
          { name: "Bed size", kind: "variant", required: true, values: ["Single", "Double", "Queen", "King"] },
          { name: "Storage", kind: "variant", values: ["With storage", "Without storage"] },
          { name: "Material", kind: "configuration", display: "dropdown", values: ["Wood", "Metal", "Engineered wood"] },
          { name: "Mattress firmness", kind: "configuration", values: ["Soft", "Medium", "Firm"] },
          { name: "Extras", kind: "addon", multiple: true, values: ["Headboard", "Mattress", "Bedside tables"] },
        ] },
        { name: "Mattresses", templates: [{ name: "Size", kind: "variant", required: true, values: ["Single", "Double", "Queen", "King"] }, { name: "Firmness", kind: "configuration", values: ["Soft", "Medium", "Firm"] }] },
        { name: "Wardrobes" },
      ] },
      { name: "Living room", children: [{ name: "Sofas", templates: [{ name: "Seats", kind: "variant", required: true, values: ["2 seater", "3 seater"] }, colour("Grey", "Beige")] }, { name: "Tables" }, { name: "TV units" }] },
      { name: "Office", children: [{ name: "Desks" }, { name: "Chairs", templates: [colour("Black", "Grey")] }] },
    ],
  },
  {
    name: "Electronics",
    children: [
      { name: "Mobile phones", children: [{ name: "Smartphones", templates: [
        { name: "Storage", kind: "variant", required: true, values: ["64GB", "128GB", "256GB"] },
        colour("Black", "Silver"),
        { name: "Extras", kind: "addon", multiple: true, values: ["Screen guard", "Case"] },
      ] }, { name: "Accessories" }] },
      { name: "Computers", children: [{ name: "Laptops" }, { name: "Tablets" }] },
      { name: "Audio", children: [{ name: "Headphones", templates: [colour("Black", "White")] }, { name: "Speakers" }] },
    ],
  },
  { name: "Home & Living", children: [{ name: "Decor" }, { name: "Kitchen" }, { name: "Bedding", templates: [size("Single", "Double", "King")] }] },
  { name: "Beauty & Care", children: [{ name: "Skincare" }, { name: "Haircare" }, { name: "Fragrance" }] },
  { name: "Jewellery", children: [{ name: "Rings", templates: [size("5", "6", "7", "8", "9")] }, { name: "Necklaces" }, { name: "Earrings" }] },
  { name: "Food & Drink", children: [{ name: "Snacks" }, { name: "Beverages" }] },
  { name: "Books & Stationery", children: [{ name: "Books" }, { name: "Stationery" }] },
  { name: "Gifts", templates: [
    { name: "Gift wrap", kind: "addon", values: ["Gift wrap"] },
  ] },
  { name: "Other" },
];
