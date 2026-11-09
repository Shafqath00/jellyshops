import {
  Fraunces,
  Inter,
  Playfair_Display,
  Cormorant_Garamond,
  Lora,
  EB_Garamond,
  Libre_Baskerville,
  DM_Serif_Display,
  Crimson_Pro,
  Manrope,
  DM_Sans,
  Work_Sans,
  Montserrat,
  Outfit,
  Plus_Jakarta_Sans,
  Nunito_Sans,
  Raleway,
  Space_Grotesk,
  Josefin_Sans,
  Figtree,
  Jost,
  Poppins,
  Hind,
  Oswald,
  Bebas_Neue,
  Syne,
  IBM_Plex_Mono,
} from "next/font/google";

/**
 * Self-hosted storefront fonts. Theme settings refer to them by family name; see `fontStack` in
 * @jelly/storefront-themes (every font listed there needs its variable here). Only Fraunces and
 * Inter are preloaded; the others download when a store's CSS uses them.
 */
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const playfairDisplay = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair-display", display: "swap", preload: false });
const cormorantGaramond = Cormorant_Garamond({ subsets: ["latin"], variable: "--font-cormorant-garamond", display: "swap", preload: false });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap", preload: false });
const ebGaramond = EB_Garamond({ subsets: ["latin"], variable: "--font-eb-garamond", display: "swap", preload: false });
const libreBaskerville = Libre_Baskerville({ subsets: ["latin"], variable: "--font-libre-baskerville", display: "swap", preload: false });
const dmSerifDisplay = DM_Serif_Display({ subsets: ["latin"], weight: ["400"], variable: "--font-dm-serif-display", display: "swap", preload: false });
const crimsonPro = Crimson_Pro({ subsets: ["latin"], variable: "--font-crimson-pro", display: "swap", preload: false });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", display: "swap", preload: false });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", preload: false });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap", preload: false });
const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-plus-jakarta-sans", display: "swap", preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap", preload: false });
const raleway = Raleway({ subsets: ["latin"], variable: "--font-raleway", display: "swap", preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap", preload: false });
const josefinSans = Josefin_Sans({ subsets: ["latin"], variable: "--font-josefin-sans", display: "swap", preload: false });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap", preload: false });
const jost = Jost({ subsets: ["latin"], variable: "--font-jost", display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap", preload: false });
const hind = Hind({ subsets: ["latin", "devanagari"], weight: ["400", "500", "600", "700"], variable: "--font-hind", display: "swap", preload: false });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-oswald", display: "swap", preload: false });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: ["400"], variable: "--font-bebas-neue", display: "swap", preload: false });
const syne = Syne({ subsets: ["latin"], variable: "--font-syne", display: "swap", preload: false });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-ibm-plex-mono", display: "swap", preload: false });

export const storefrontFontVariables = [
  fraunces.variable, inter.variable, playfairDisplay.variable, cormorantGaramond.variable, lora.variable, ebGaramond.variable, libreBaskerville.variable, dmSerifDisplay.variable, crimsonPro.variable, manrope.variable, dmSans.variable, workSans.variable, montserrat.variable, outfit.variable, plusJakartaSans.variable, nunitoSans.variable, raleway.variable, spaceGrotesk.variable, josefinSans.variable, figtree.variable, jost.variable, poppins.variable, hind.variable, oswald.variable, bebasNeue.variable, syne.variable, ibmPlexMono.variable,
].join(" ");
