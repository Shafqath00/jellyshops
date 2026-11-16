"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyThemeStyle, listStarterPacks, listThemeStyles } from "@jelly/storefront-themes";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { createStoreEditorApi } from "../api/client";
import type { MenuRecord, ThemeCatalogEntry, ThemeConfigurationRecord } from "../api/types";
import { carriedThemeSettings, menusToRestore, withCarriedSettings } from "../design-switch";
import { templateDisplayName } from "../template-gallery";
import { templateStoreLogo, templateStoreProducts, type TemplateStoreData } from "../template-store-data";

/** A design installed as a draft, and how publishing it went. */
export type ReadyDraft = {
  starterId: string;
  name: string;
  /** It replaced an earlier draft. */
  switched: boolean;
  /** What of the store's own content was carried over ("logo", "social links", "languages", "menus"). */
  kept: string[];
  publish: { status: "idle" | "publishing" | "published" } | { status: "blocked"; problems: string[] } | { status: "failed"; message: string };
};

export const STORE_DESIGNS_HREF = "/admin/online-store";
export const EDITOR_HREF = "/admin/online-store/editor";

/** The full-page preview of one store design. */
export function templatePreviewHref(templateId: string): string {
  return `${STORE_DESIGNS_HREF}/preview/${encodeURIComponent(templateId)}`;
}

/** Names of what a switch carried over, in reading order. */
export function keptContent(carried: Record<string, unknown>, restoredMenus: number): string[] {
  const branding = (carried.branding ?? {}) as Record<string, unknown>;
  return [
    branding.logoUrl || branding.faviconUrl ? "logo" : "",
    carried.social ? "social links" : "",
    carried.languages ? "languages" : "",
    restoredMenus ? "menus" : "",
  ].filter(Boolean);
}

function idempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `publish-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The store's current design and the actions on it, shared by the Store designs library and the
 * full-page template preview: load the theme catalogue and draft, install a design as a new draft
 * (asking first when the store already has one, and keeping the store's own logo, links and menus),
 * then customize or publish it.
 */
export function useStoreDesigns() {
  const { session, activeStore } = useAuth();
  const storeId = activeStore?.id;
  const token = session?.access_token;
  const api = useMemo(() => token && storeId ? createStoreEditorApi({
    baseUrl: process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001", token,
  }) : null, [token, storeId]);
  const [themes, setThemes] = useState<ThemeCatalogEntry[]>([]);
  const [configuration, setConfiguration] = useState<ThemeConfigurationRecord | null>(null);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string>();
  const [error, setError] = useState<string>();
  const [retry, setRetry] = useState(0);
  /** The design waiting for a yes before it replaces the draft. */
  const [switching, setSwitching] = useState<{ starterId: string; styleId?: string } | null>(null);
  /** Keep the store's logo, social links, languages and menus when switching (asked in the switch dialog). */
  const [keepContent, setKeepContent] = useState(true);
  /** The design just installed as a draft: the merchant chooses to customize it or publish it. */
  const [ready, setReady] = useState<ReadyDraft | null>(null);
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!api || !storeId) return;
    let alive = true;
    void Promise.all([api.listThemeCatalog(storeId), api.getThemeConfiguration(storeId), api.listTemplates(storeId), api.listGlobalSections(storeId), api.listMenus(storeId)])
      .then(([catalog, selected, templates, globals, menus]) => {
        if (!alive) return;
        setThemes(catalog); setConfiguration(selected); setError(undefined);
        setHasWorkspace(Boolean(selected || templates.length || globals.length || menus.length));
      }).catch((reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : "Could not load your store designs. Try again."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, storeId, retry]);

  function reload() { setLoading(true); setError(undefined); setRetry((value) => value + 1); }

  /** A store that already has a draft is asked first; a new store starts straight away. */
  function chooseStarter(starterId: string, styleId?: string) {
    if (hasWorkspace) { setKeepContent(true); setSwitching({ starterId, styleId }); }
    else void installStarter(starterId, styleId);
  }

  async function installStarter(starterId: string, styleId?: string) {
    if (!api || !storeId || operation.current) return;
    operation.current = true;
    setSaving(`starter:${starterId}`); setError(undefined);
    try {
      // The store's own logo, links and menus are read first: installing a design replaces them in the draft.
      const keep = hasWorkspace && keepContent;
      const [previousConfiguration, previousMenus]: [ThemeConfigurationRecord | null, MenuRecord[]] = keep
        ? await Promise.all([api.getThemeConfiguration(storeId), api.listMenus(storeId)])
        : [null, []];
      if (hasWorkspace) {
        const workspace = await api.loadWorkspace(storeId);
        await api.installStarterPack(storeId, starterId, { replaceDraft: true, expectedGeneration: workspace.generation });
      } else await api.installStarterPack(storeId, starterId);

      // A theme style picked in the preview (other than the theme's default look) and the carried values go into one save.
      const starter = listStarterPacks().find((item) => item.id === starterId);
      const styles = listThemeStyles(starter?.theme.themeId);
      const style = styles.find((item) => item.id === styleId);
      const restyle = Boolean(style && style !== styles[0]);
      const carried = carriedThemeSettings(previousConfiguration?.settings);
      let installed = await api.getThemeConfiguration(storeId);
      if (installed && (restyle || Object.keys(carried).length)) {
        const styled = restyle && style ? applyThemeStyle(installed.settings, style) : installed.settings;
        installed = (await api.saveThemeConfiguration(storeId, installed.revision, {
          themeId: installed.themeId, themeVersion: installed.themeVersion, settings: withCarriedSettings(styled, carried), draftArtifactId: installed.draftArtifactId ?? null,
        })).theme;
      }
      let restoredMenus = 0;
      if (keep && previousMenus.length) {
        // Menus still exactly as the previous design shipped them are its samples; only the merchant's own menus come across.
        const previousTheme = previousConfiguration?.themeId;
        const previousStarter = listStarterPacks().find((item) => item.id === previousTheme || item.theme.themeId === previousTheme);
        for (const { menu, items } of menusToRestore(previousMenus, await api.listMenus(storeId), previousStarter?.menus ?? [])) { await api.updateMenu(storeId, menu.id, menu.revision, { items }); restoredMenus += 1; }
      }
      if (!mounted.current) return;
      setConfiguration(installed);
      setHasWorkspace(true);
      setReady({ starterId, name: templateDisplayName(starter?.name ?? "Your design"), switched: hasWorkspace, kept: keptContent(carried, restoredMenus), publish: { status: "idle" } });
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Could not prepare this store design. Try again."); }
    finally { operation.current = false; if (mounted.current) setSaving(undefined); }
  }

  /** Publishes the current draft: the new design becomes what shoppers see. */
  async function publishDraft() {
    if (!api || !storeId || !ready || ready.publish.status === "publishing") return;
    setReady((current) => current && { ...current, publish: { status: "publishing" } });
    try {
      const workspace = await api.loadWorkspace(storeId);
      const result = await api.publish(storeId, workspace.generation, idempotencyKey());
      const problems = result.diagnostics.filter((item) => item.severity === "error").map((item) => item.message);
      if (!mounted.current) return;
      setReady((current) => current && {
        ...current,
        publish: result.ok ? { status: "published" } : { status: "blocked", problems: problems.length ? problems : ["Something on a page needs fixing before it can go live."] },
      });
    } catch (reason) {
      if (mounted.current) setReady((current) => current && { ...current, publish: { status: "failed", message: reason instanceof Error ? reason.message : "Could not publish. Try again." } });
    }
  }

  /** Runs one change at a time (the library's theme-only switch uses it too). */
  async function runOperation(key: string, work: () => Promise<void>) {
    if (operation.current) return;
    operation.current = true;
    setSaving(key); setError(undefined);
    try { await work(); }
    catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Something went wrong. Try again."); }
    finally { operation.current = false; if (mounted.current) setSaving(undefined); }
  }

  return {
    api, storeId, token, activeStore, themes, configuration, setConfiguration, hasWorkspace, loading, saving, error, setError,
    reload, chooseStarter, installStarter, switching, setSwitching, keepContent, setKeepContent, ready, setReady, publishDraft, runOperation, mounted,
  };
}

export type StoreDesigns = ReturnType<typeof useStoreDesigns>;

/** The merchant's own name, logo and products for the design preview; loaded once `enabled` turns on. */
export function useTemplateStoreData(designs: Pick<StoreDesigns, "api" | "storeId" | "activeStore" | "configuration" | "loading">, enabled: boolean): TemplateStoreData | undefined {
  const { api, storeId, activeStore, configuration, loading } = designs;
  const [storeData, setStoreData] = useState<TemplateStoreData>();
  useEffect(() => {
    if (!enabled || loading || storeData || !api || !storeId || !activeStore) return;
    let alive = true;
    const base = { name: activeStore.name, logoUrl: templateStoreLogo(configuration?.settings) };
    api.listProducts(storeId)
      .then((result) => { if (alive) setStoreData({ ...base, products: templateStoreProducts(result.nodes, activeStore.slug, activeStore.currency) }); })
      .catch(() => { if (alive) setStoreData({ ...base, products: [] }); });
    return () => { alive = false; };
  }, [enabled, loading, storeData, api, storeId, activeStore, configuration]);
  return storeData;
}
