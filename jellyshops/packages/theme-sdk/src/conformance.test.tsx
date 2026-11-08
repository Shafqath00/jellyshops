import { COMPLETE_STOREFRONT_THEME_IDS, listThemes } from "@jelly/storefront-themes";
import { describeThemeConformance } from "./testing";

// Every complete built-in theme goes through the same suite a third-party theme must pass, and so does every
// generated theme (one built on a base design with `extends`, made by scripts/new-theme.mjs).
for (const themeId of COMPLETE_STOREFRONT_THEME_IDS) describeThemeConformance(themeId);
for (const theme of listThemes()) if (typeof (theme.manifest as { extends?: unknown }).extends === "string") describeThemeConformance(theme.id);
