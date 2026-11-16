"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyThemeStyle, listStarterPacks, listThemeStyles } from "@jelly/storefront-themes";
import { useAuth } from "@/features/auth/providers/auth-provider";
import { createStoreEditorApi } from "../api/client";
import type { ThemeCatalogEntry, ThemeConfigurationRecord } from "../api/types";
import { templateStoreLogo, templateStoreProducts, type TemplateStoreData } from "../template-store-data";

export const STORE_DESIGNS_HREF = "/admin/online-store";
export const EDITOR_HREF = "/admin/online-store/editor";

/** The full-page preview of one store design. */
export function templatePreviewHref(templateId: string): string {
  return `${STORE_DESIGNS_HREF}/preview/${encodeURIComponent(templateId)}`;
}

/**
 * The store's current design and the actions on it, shared by the Store designs library and the
 * full-page template preview: load the theme catalogue and draft, and install a design as a new draft
 * (asking first when the store already has one).
 */
export function useStoreDesigns() {
  const router = useRouter();
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
    if (hasWorkspace) setSwitching({ starterId, styleId });
    else void installStarter(starterId, styleId);
  }

  async function installStarter(starterId: string, styleId?: string) {
    if (!api || !storeId || operation.current) return;
    operation.current = true;
    setSaving(`starter:${starterId}`); setError(undefined);
    try {
      if (hasWorkspace) {
        const workspace = await api.loadWorkspace(storeId);
        await api.installStarterPack(storeId, starterId, { replaceDraft: true, expectedGeneration: workspace.generation });
      } else await api.installStarterPack(storeId, starterId);
      // A theme style picked in the preview (other than the theme's default look) is applied to the new draft.
      const starter = listStarterPacks().find((item) => item.id === starterId);
      const styles = listThemeStyles(starter?.theme.themeId);
      const style = styles.find((item) => item.id === styleId);
      if (style && style !== styles[0]) {
        const installed = await api.getThemeConfiguration(storeId);
        if (installed) await api.saveThemeConfiguration(storeId, installed.revision, { themeId: installed.themeId, themeVersion: installed.themeVersion, settings: applyThemeStyle(installed.settings, style), draftArtifactId: installed.draftArtifactId ?? null });
      }
      if (mounted.current) router.push(EDITOR_HREF);
    } catch (reason) { if (mounted.current) setError(reason instanceof Error ? reason.message : "Could not prepare this store design. Try again."); }
    finally { operation.current = false; if (mounted.current) setSaving(undefined); }
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
    reload, chooseStarter, installStarter, switching, setSwitching, runOperation, mounted,
  };
}

/** The merchant's own name, logo and products for the design preview; loaded once `enabled` turns on. */
export function useTemplateStoreData(designs: Pick<ReturnType<typeof useStoreDesigns>, "api" | "storeId" | "activeStore" | "configuration" | "loading">, enabled: boolean): TemplateStoreData | undefined {
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
