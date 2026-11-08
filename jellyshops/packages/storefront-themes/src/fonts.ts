/**
 * Font families a merchant can pick. All but Georgia and Arial are Google fonts
 * self-hosted by the app (`jellyshops/src/app/fonts.ts`) as CSS variables; a
 * browser only downloads the ones a store actually uses.
 */
export const FONT_OPTIONS = [
  { value: "Fraunces", label: "Fraunces (serif)" },
  { value: "Inter", label: "Inter (sans-serif)" },
  { value: "Playfair Display", label: "Playfair Display (serif)" },
  { value: "Cormorant Garamond", label: "Cormorant Garamond (serif)" },
  { value: "Lora", label: "Lora (serif)" },
  { value: "EB Garamond", label: "EB Garamond (serif)" },
  { value: "Libre Baskerville", label: "Libre Baskerville (serif)" },
  { value: "DM Serif Display", label: "DM Serif Display (serif)" },
  { value: "Crimson Pro", label: "Crimson Pro (serif)" },
  { value: "Manrope", label: "Manrope (sans-serif)" },
  { value: "DM Sans", label: "DM Sans (sans-serif)" },
  { value: "Work Sans", label: "Work Sans (sans-serif)" },
  { value: "Montserrat", label: "Montserrat (sans-serif)" },
  { value: "Outfit", label: "Outfit (sans-serif)" },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans (sans-serif)" },
  { value: "Nunito Sans", label: "Nunito Sans (sans-serif)" },
  { value: "Raleway", label: "Raleway (sans-serif)" },
  { value: "Space Grotesk", label: "Space Grotesk (sans-serif)" },
  { value: "Josefin Sans", label: "Josefin Sans (sans-serif)" },
  { value: "Figtree", label: "Figtree (sans-serif)" },
  { value: "Jost", label: "Jost (sans-serif)" },
  { value: "Poppins", label: "Poppins (sans-serif, Hindi)" },
  { value: "Hind", label: "Hind (sans-serif, Hindi)" },
  { value: "Oswald", label: "Oswald (display)" },
  { value: "Bebas Neue", label: "Bebas Neue (display)" },
  { value: "Syne", label: "Syne (display)" },
  { value: "Georgia", label: "Georgia (serif)" },
  { value: "Arial", label: "Arial (sans-serif)" },
] as const;

const stacks: Record<string, string> = {
  "Fraunces": "var(--font-fraunces), Georgia, \"Times New Roman\", serif",
  "Inter": "var(--font-inter), \"Helvetica Neue\", Arial, sans-serif",
  "Playfair Display": "var(--font-playfair-display), Georgia, \"Times New Roman\", serif",
  "Cormorant Garamond": "var(--font-cormorant-garamond), Georgia, \"Times New Roman\", serif",
  "Lora": "var(--font-lora), Georgia, \"Times New Roman\", serif",
  "EB Garamond": "var(--font-eb-garamond), Georgia, \"Times New Roman\", serif",
  "Libre Baskerville": "var(--font-libre-baskerville), Georgia, \"Times New Roman\", serif",
  "DM Serif Display": "var(--font-dm-serif-display), Georgia, \"Times New Roman\", serif",
  "Crimson Pro": "var(--font-crimson-pro), Georgia, \"Times New Roman\", serif",
  "Manrope": "var(--font-manrope), \"Helvetica Neue\", Arial, sans-serif",
  "DM Sans": "var(--font-dm-sans), \"Helvetica Neue\", Arial, sans-serif",
  "Work Sans": "var(--font-work-sans), \"Helvetica Neue\", Arial, sans-serif",
  "Montserrat": "var(--font-montserrat), \"Helvetica Neue\", Arial, sans-serif",
  "Outfit": "var(--font-outfit), \"Helvetica Neue\", Arial, sans-serif",
  "Plus Jakarta Sans": "var(--font-plus-jakarta-sans), \"Helvetica Neue\", Arial, sans-serif",
  "Nunito Sans": "var(--font-nunito-sans), \"Helvetica Neue\", Arial, sans-serif",
  "Raleway": "var(--font-raleway), \"Helvetica Neue\", Arial, sans-serif",
  "Space Grotesk": "var(--font-space-grotesk), \"Helvetica Neue\", Arial, sans-serif",
  "Josefin Sans": "var(--font-josefin-sans), \"Helvetica Neue\", Arial, sans-serif",
  "Figtree": "var(--font-figtree), \"Helvetica Neue\", Arial, sans-serif",
  "Jost": "var(--font-jost), \"Helvetica Neue\", Arial, sans-serif",
  "Poppins": "var(--font-poppins), \"Helvetica Neue\", Arial, sans-serif",
  "Hind": "var(--font-hind), \"Helvetica Neue\", Arial, sans-serif",
  "Oswald": "var(--font-oswald), Impact, \"Arial Narrow\", sans-serif",
  "Bebas Neue": "var(--font-bebas-neue), Impact, \"Arial Narrow\", sans-serif",
  "Syne": "var(--font-syne), Impact, \"Arial Narrow\", sans-serif",
  "Georgia": "Georgia, \"Times New Roman\", serif",
  "Arial": "Arial, \"Helvetica Neue\", sans-serif",
};

/** Turns a saved font name into a safe CSS font-family stack. Unknown but well-formed names are quoted with a generic fallback. */
export function fontStack(name: unknown, fallback: string): string {
  const value = typeof name === "string" ? name.trim() : "";
  if (stacks[value]) return stacks[value];
  if (/^[\w .'-]{1,80}$/.test(value)) return `"${value.replace(/"/g, "")}", ${stacks[fallback] ?? fallback}`;
  return stacks[fallback] ?? fallback;
}
