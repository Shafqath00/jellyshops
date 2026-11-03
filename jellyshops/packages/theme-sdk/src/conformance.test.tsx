import { COMPLETE_STOREFRONT_THEME_IDS } from "@jelly/storefront-themes";
import { describeThemeConformance } from "./testing";

// Every complete built-in theme goes through the same suite a third-party theme must pass.
for (const themeId of COMPLETE_STOREFRONT_THEME_IDS) describeThemeConformance(themeId);
