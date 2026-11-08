"use client";
import { useCallback, useEffect, useState } from "react";
import { authApiOrigin, useAuth } from "@/features/auth/providers/auth-provider";

export interface StoreSettings {
  id: string; name: string; slug: string; currency: string; country: string;
  shippingMinor: number; shippingCopy: string; contactEmail: string | null; timezone: string; revision: number;
}
export type StoreSettingsPatch = Partial<Pick<StoreSettings, "name" | "slug" | "contactEmail" | "timezone" | "shippingMinor" | "shippingCopy">>;

async function read(response: Response): Promise<StoreSettings> {
  const body = await response.json().catch(() => ({})) as { settings?: StoreSettings; error?: { message?: string } };
  if (!response.ok || !body.settings) throw new Error(body.error?.message ?? "Could not load or save your settings. Try again.");
  return body.settings;
}

/** Loads the store's settings and saves only the fields a page changes, with the revision check. */
export function useStoreSettings() {
  const { activeStore, session } = useAuth();
  const storeId = activeStore?.id, token = session?.access_token;
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!storeId || !token) return;
    const controller = new AbortController();
    void fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/settings`, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
      .then(read).then((value) => { setSettings(value); setError(""); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load settings."); });
    return () => controller.abort();
  }, [storeId, token, attempt]);
  const save = useCallback(async (patch: StoreSettingsPatch) => {
    if (!storeId || !token || !settings) throw new Error("Settings are still loading.");
    const next = await fetch(`${authApiOrigin()}/api/stores/${encodeURIComponent(storeId)}/settings`, {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ revision: settings.revision, ...patch }),
    }).then(read);
    setSettings(next);
    return next;
  }, [storeId, token, settings]);
  return { settings, error, save, reload: () => setAttempt((value) => value + 1) };
}
