"use client";
import { SitePreferences } from "@/features/store-preferences/site-preferences";

/** Settings > Store > Site preferences: the tabs share one set of edits and one save bar. */
export default function SitePreferencesLayout({ children }: { children: React.ReactNode }) {
  return <SitePreferences>{children}</SitePreferences>;
}
