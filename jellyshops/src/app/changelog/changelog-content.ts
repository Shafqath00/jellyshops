/**
 * Jellyshop changelog, newest first. Only things merchants or shoppers can use today; keep each entry true.
 * The home page "New" pill links here, so its words should match the newest entry worth announcing.
 */
export type ChangelogArea = "Admin" | "Store" | "Designs" | "Sign-up";

export interface ChangelogEntry {
  date: string; // ISO date
  title: string;
  summary: string;
  points: string[];
  areas: ChangelogArea[];
}

export const changelog: ChangelogEntry[] = [
  {
    date: "2026-11-15",
    title: "A faster way to open your store",
    summary: "Sign up, confirm your email and set up your store in five short steps.",
    points: [
      "Name your store and claim its web address, with a live check that it is free.",
      "Tell us what you sell and how you sell today, and we suggest a design to match.",
      "Add your first product as a draft, then land on a dashboard with a setup checklist.",
      "Your progress is saved as you go, so you can finish later.",
    ],
    areas: ["Sign-up"],
  },
  {
    date: "2026-11-14",
    title: "Bulk import your catalogue from a spreadsheet",
    summary: "Move a whole catalogue in at once, or change hundreds of products together.",
    points: [
      "Import products and variants from a CSV or Excel file, with a check before anything is saved.",
      "Add photos from web addresses in the sheet, or upload a folder of photos matched by file name.",
      "Export everything, a filtered list or just the products you tick.",
      "Bulk edit prices, stock, status, tags and collections, with a before-and-after preview.",
    ],
    areas: ["Admin"],
  },
  {
    date: "2026-11-11",
    title: "Built for big catalogues",
    summary: "Shoppers find their way around stores with hundreds of products.",
    points: [
      "Large menus with columns and photo tiles.",
      "Filters with counts for size, colour, brand and more, even on large collections.",
      "A recently viewed row that follows each shopper around your store.",
    ],
    areas: ["Store"],
  },
  {
    date: "2026-11-10",
    title: "Quantity rules and smarter search",
    summary: "Sell in packs and help shoppers find things as they type.",
    points: [
      "Set a minimum, a step size and a most-per-order limit for any product.",
      "Search suggestions appear while shoppers type, with full keyboard support.",
      "The bag icon shows how many items are in the bag.",
    ],
    areas: ["Store", "Admin"],
  },
  {
    date: "2026-11-09",
    title: "Two new designs: Halo and Diode",
    summary: "A calm skincare design and a spec-led electronics design, both fully editable.",
    points: [
      "Halo: soft colours, skin-concern filters and product stories in chapters.",
      "Diode: technical product cards, a full specification table and a compare tray for up to four products.",
    ],
    areas: ["Designs"],
  },
  {
    date: "2026-11-08",
    title: "Reviews, back-in-stock alerts and personalisation",
    summary: "Tools that bring shoppers back and help them buy with confidence.",
    points: [
      "Product reviews with star ratings, moderated by you before they appear.",
      "Shoppers can ask to be emailed when a sold-out size is back.",
      "Let shoppers add a name or message to a product, with an optional extra charge.",
    ],
    areas: ["Store", "Admin"],
  },
];

export function formatChangelogDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}
