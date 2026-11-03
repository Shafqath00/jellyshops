"use client";

import type { ReactNode } from "react";
import { registerInstalledTheme, type InstalledTheme } from "./installed-theme";

/**
 * Makes an uploaded theme known in the browser before anything below resolves it, and draws its
 * stylesheet. Without a theme (a store on a built-in theme) it renders its children unchanged.
 */
export function InstalledThemeProvider({ theme, children }: { theme: InstalledTheme | null; children: ReactNode }) {
  if (theme) registerInstalledTheme(theme);
  return <>
    {theme && theme.css ? <style data-installed-theme={theme.versionId}>{theme.css}</style> : null}
    {children}
  </>;
}
