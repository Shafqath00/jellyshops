/**
 * Checkout design tokens. `checkout.css` defines each one on `.jelly-checkout`
 * from the theme's contract tokens (`--j-*`), with a neutral fallback. To give a
 * store its own checkout look later, set these properties on the checkout root
 * (or on the theme root); no layout code needs to change.
 */
import type { Appearance } from "@stripe/stripe-js";

export const CHECKOUT_TOKENS = [
  "--checkout-bg",
  "--checkout-surface",
  "--checkout-text",
  "--checkout-muted",
  "--checkout-border",
  "--checkout-primary",
  "--checkout-on-primary",
  "--checkout-danger",
  "--checkout-success",
  "--checkout-focus",
  "--checkout-font-body",
  "--checkout-font-heading",
  "--checkout-radius",
  "--checkout-radius-field",
  "--checkout-radius-button",
  "--checkout-space",
  "--checkout-field-height",
  "--checkout-button-height",
  "--checkout-max-width",
] as const;

export type CheckoutToken = (typeof CHECKOUT_TOKENS)[number];

const FALLBACK = {
  surface: "#ffffff",
  text: "#1f2328",
  muted: "#5f6670",
  border: "#c9cdd2",
  primary: "#1f2328",
  danger: "#b42318",
  radiusField: "8px",
  font: "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const PLAIN = /^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/i;

/**
 * Stripe only takes plain colours (hex, rgb, hsl). Theme tokens are often
 * color-mix() or semi-transparent, so paint them over the field colour on a
 * 1px canvas and read back plain rgb. Without a canvas (tests) the fallback is used.
 */
function plainColour(value: string, fallback: string, over = FALLBACK.surface): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  if (PLAIN.test(trimmed) && !trimmed.startsWith("rgba") && !trimmed.startsWith("hsla")) return trimmed;
  try {
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!context) return PLAIN.test(trimmed) ? trimmed : fallback;
    context.fillStyle = over;
    context.fillRect(0, 0, 1, 1);
    context.fillStyle = fallback;
    context.fillStyle = trimmed; // an unknown value leaves the fallback in place
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return PLAIN.test(trimmed) ? trimmed : fallback;
  }
}

function length(value: string, fallback: string): string {
  const trimmed = value.trim();
  return /^\d+(\.\d+)?(px|rem|em)$/.test(trimmed) ? trimmed : fallback;
}

/** Builds the Stripe Payment Element look from the tokens on the checkout root, so the card form matches the theme. */
export function stripeAppearance(root: Element | null): Appearance {
  const style = root ? getComputedStyle(root) : null;
  const read = (token: CheckoutToken) => style?.getPropertyValue(token) ?? "";
  const font = read("--checkout-font-body").trim();
  const surface = plainColour(read("--checkout-surface"), FALLBACK.surface);
  return {
    theme: "stripe",
    variables: {
      colorPrimary: plainColour(read("--checkout-primary"), FALLBACK.primary, surface),
      colorBackground: surface,
      colorText: plainColour(read("--checkout-text"), FALLBACK.text, surface),
      colorTextSecondary: plainColour(read("--checkout-muted"), FALLBACK.muted, surface),
      colorDanger: plainColour(read("--checkout-danger"), FALLBACK.danger, surface),
      borderRadius: length(read("--checkout-radius-field"), FALLBACK.radiusField),
      // The card form is drawn in Stripe's own frame; theme web fonts are not loaded there, so keep a system fallback.
      fontFamily: font ? `${font}, ${FALLBACK.font}` : FALLBACK.font,
      spacingUnit: "4px",
    },
    rules: {
      ".Input": { border: `1px solid ${plainColour(read("--checkout-border"), FALLBACK.border, surface)}`, boxShadow: "none" },
      ".Label": { fontWeight: "500" },
    },
  };
}
