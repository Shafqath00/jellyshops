import { z } from "zod";
import type { ControlDefinition } from "./types.js";

/**
 * Where a Main product block shows on large screens: in the buying panel (beside the photos) or in the column under
 * the photos. Content under the photos keeps the buying panel short, so it can stay in view while shoppers read
 * the description, specifications and reviews. On phones everything stacks: photos, buying panel, then the rest.
 * Blocks saved before this setting stay in the buying panel.
 */
export const MAIN_PRODUCT_COLUMNS = ["panel", "below"] as const;
export const mainProductColumnSchema = z.object({ column: z.union([z.enum(MAIN_PRODUCT_COLUMNS), z.literal("")]).optional() }).passthrough();
export const mainProductColumnControl: ControlDefinition = {
  type: "segmented", key: "column", label: "Where it shows", group: "layout",
  description: "Under the photos keeps the buying panel short so it stays in view while scrolling. On phones it shows after the buying panel.",
  options: [{ label: "Buying panel", value: "panel" }, { label: "Under the photos", value: "below" }],
};
