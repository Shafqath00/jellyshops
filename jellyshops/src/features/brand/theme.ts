/**
 * Light/dark theme for the Jellyshop brand pages (home, sign-in, onboarding, legal, changelog).
 *
 * The visitor's choice is "system" (the default, follows prefers-color-scheme), "light" or "dark".
 * `HOME_THEME_SCRIPT` runs before paint from the root layout: it writes the resolved theme to
 * html[data-home-theme] and the choice to html[data-home-theme-choice], so the first paint is right
 * and React never renders a theme of its own (no hydration mismatch). It also follows system changes
 * and choices made in other tabs, live. brand.css turns the attribute into `color-scheme`.
 */
export const HOME_THEME_KEY = "jellyshop-home-theme";

export type ThemeChoice = "system" | "light" | "dark";
export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

/** Kept small and dependency-free: it is inlined into every page's HTML. `window.__jellyTheme()` re-applies. */
export const HOME_THEME_SCRIPT = `(function(){var d=document.documentElement,k=${JSON.stringify(HOME_THEME_KEY)},m=window.matchMedia&&matchMedia("(prefers-color-scheme: light)");function a(){var c=null;try{c=localStorage.getItem(k)}catch(e){}if(c!=="light"&&c!=="dark")c="system";d.dataset.homeThemeChoice=c;d.dataset.homeTheme=c==="system"?(m&&m.matches?"light":"dark"):c}a();if(m){m.addEventListener?m.addEventListener("change",a):m.addListener(a)}addEventListener("storage",function(e){if(e.key===k)a()});window.__jellyTheme=a})()`;

declare global {
  interface Window { __jellyTheme?: () => void }
}

export function subscribeThemeChoice(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-home-theme-choice", "data-home-theme"] });
  return () => observer.disconnect();
}

export function readThemeChoice(): ThemeChoice {
  const value = document.documentElement.dataset.homeThemeChoice;
  return value === "light" || value === "dark" ? value : "system";
}

export function setThemeChoice(choice: ThemeChoice) {
  let saved = true;
  try {
    if (choice === "system") localStorage.removeItem(HOME_THEME_KEY);
    else localStorage.setItem(HOME_THEME_KEY, choice);
  } catch { saved = false; /* private mode: keep it for this page only */ }
  if (saved && window.__jellyTheme) window.__jellyTheme();
  else {
    const root = document.documentElement;
    root.dataset.homeThemeChoice = choice;
    root.dataset.homeTheme = choice === "system" ? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark") : choice;
  }
}

/** The next choice for the header's one-button switch: System, then Light, then Dark. */
export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  return THEME_CHOICES[(THEME_CHOICES.indexOf(choice) + 1) % THEME_CHOICES.length];
}

/**
 * `<meta name="color-scheme">` and browser bar colours for brand pages: both themes are supported, so the
 * browser's own canvas, scroll bars and form controls follow along. Export it as `viewport` from each brand
 * page or layout (not the root layout: shop pages pick their own colours).
 */
export const brandViewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
} satisfies import("next").Viewport;
