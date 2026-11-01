"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { StoreLanguage } from "@jelly/storefront-themes";

/**
 * The language a shopper reads the store in. The main language is `null`; the
 * others come from theme settings (Languages). A `?lang=hi` link picks one, and
 * the choice is remembered in this browser for the store.
 */
export interface StorefrontLanguageState {
  language: string | null;
  languages: StoreLanguage[];
  mainName: string;
  setLanguage(code: string | null): void;
}

export const StorefrontLanguageContext = createContext<StorefrontLanguageState>({ language: null, languages: [], mainName: "English", setLanguage: () => undefined });

export function useStorefrontLanguage(): StorefrontLanguageState {
  return useContext(StorefrontLanguageContext);
}

const storageKey = (storeSlug: string) => `jelly-language:${storeSlug}`;

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}

function write(key: string, value: string | null) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch { /* private mode: the choice lasts for this page only */ }
}

export function useStorefrontLanguageState(storeSlug: string, languages: StoreLanguage[], mainName: string): StorefrontLanguageState {
  const [chosen, setChosen] = useState<string | null>(null);
  const codes = languages.map((item) => item.code).join(",");
  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get("lang");
    const saved = fromLink ?? read(storageKey(storeSlug));
    const valid = saved && codes.split(",").includes(saved) ? saved : null;
    if (fromLink) write(storageKey(storeSlug), valid);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved choice is only readable in the browser.
    setChosen(valid);
  }, [storeSlug, codes]);
  const setLanguage = useCallback((code: string | null) => {
    const valid = code && codes.split(",").includes(code) ? code : null;
    write(storageKey(storeSlug), valid);
    setChosen(valid);
  }, [storeSlug, codes]);
  // A language removed from theme settings falls back to the main language.
  const language = chosen && codes.split(",").includes(chosen) ? chosen : null;
  return { language, languages, mainName, setLanguage };
}

/** The language picker in the store footer (shown only when the store has other languages). */
export function LanguageSwitcher() {
  const { language, languages, mainName, setLanguage } = useStorefrontLanguage();
  if (!languages.length) return null;
  return <div className="jelly-language-switcher">
    <label>
      <span>Language</span>
      <select value={language ?? ""} onChange={(event) => setLanguage(event.target.value || null)}>
        <option value="">{mainName}</option>
        {languages.map((item) => <option key={item.code} value={item.code} lang={item.code}>{item.name}</option>)}
      </select>
    </label>
  </div>;
}
