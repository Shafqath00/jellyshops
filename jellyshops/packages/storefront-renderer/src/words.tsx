import { createContext, useContext } from "react";
import { storefrontWord, type StorefrontWordKey } from "@jelly/storefront-schema";

/** The language the shopper reads the store in (null = the main language). Set by RegistrySectionRenderer. */
export const StorefrontLanguage = createContext<string | null>(null);

/** Built-in words (buttons, list toolbars, the bag, search) in the shopper's language; English where none is written. */
export function useWords(): (key: StorefrontWordKey, values?: Record<string, string | number>) => string {
  const language = useContext(StorefrontLanguage);
  return (key, values) => storefrontWord(key, language, values);
}
