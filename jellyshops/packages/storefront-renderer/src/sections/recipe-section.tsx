import type { SectionNode } from "@jelly/storefront-schema";
import { expandRecipe, getRecipe } from "@jelly/storefront-themes";
import type { SectionRenderProps } from "../render-registry";
import { CustomContentSection } from "./custom-content";

/**
 * A section a theme described as a recipe (see storefront-themes `recipes.ts`). The recipe and the
 * merchant's settings become blocks of the Custom content section, which draws them, so recipes get
 * its styling, spacing and responsive behaviour. The blocks are generated, not stored, so clicks in
 * the editor preview select the whole section.
 */
export function RecipeSection({ section, context }: SectionRenderProps) {
  const recipe = getRecipe(section.type);
  if (!recipe) return null;
  const { settings, blocks } = expandRecipe(recipe, section.settings);
  const drawn: SectionNode = { ...section, type: "custom-content", settings: { ...section.settings, ...settings }, blocks };
  return <CustomContentSection section={drawn} context={context} editor={false} />;
}
