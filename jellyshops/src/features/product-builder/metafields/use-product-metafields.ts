"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MetafieldApiError, type MetafieldDefinition, type MetafieldsApi, type NewDefinition } from "./api";
import { sameValue } from "./values";

/** "product", or "variant:<id>" for one combination. */
export type OwnerKey = "product" | `variant:${string}`;
type Values = Record<OwnerKey, Record<string, unknown>>;

export interface ProductMetafields {
  loading: boolean;
  loadError: string;
  productDefinitions: MetafieldDefinition[];
  variantDefinitions: MetafieldDefinition[];
  /** What is currently entered; undefined when the field has no value. */
  valueOf(owner: OwnerKey, definitionId: string): unknown;
  /** `null` takes the value away. */
  setValue(owner: OwnerKey, definitionId: string, value: unknown): void;
  problemFor(owner: OwnerKey, definitionId: string): string | undefined;
  dirty: boolean;
  createDefinition(input: NewDefinition): Promise<MetafieldDefinition>;
  /** Back to what was last loaded or saved. */
  reset(): void;
  /** Forgets everything, for starting a new product. */
  clear(): void;
  /** Saves what changed. `variantIds` maps the editor's combination ids to the saved ones. */
  saveAll(args: { productId: string; variantIds: Record<string, string> }): Promise<{ ok: boolean; message?: string }>;
}

type Options = {
  api: MetafieldsApi | null;
  storeId: string | undefined;
  /** The saved product, if there is one. */
  productId: string | null;
  /** Ids of combinations that already exist on the server. */
  variantIds: string[];
  onChange?: () => void;
};

const clone = (values: Values): Values => JSON.parse(JSON.stringify(values)) as Values;
const ownerOf = (key: OwnerKey) => key === "product" ? { type: "product" as const, id: "" } : { type: "variant" as const, id: key.slice(8) };

/**
 * The custom fields of a product and its combinations, loaded with the product and saved after it.
 * Values are kept here rather than in the product draft because they are stored separately.
 */
export function useProductMetafields({ api, storeId, productId, variantIds, onChange }: Options): ProductMetafields {
  const [loading, setLoading] = useState(Boolean(api && storeId));
  const [loadError, setLoadError] = useState("");
  const [productDefinitions, setProductDefinitions] = useState<MetafieldDefinition[]>([]);
  const [variantDefinitions, setVariantDefinitions] = useState<MetafieldDefinition[]>([]);
  const [values, setValues] = useState<Values>({ product: {} });
  const [saved, setSaved] = useState<Values>({ product: {} });
  const [problems, setProblems] = useState<Record<string, string>>({});
  const variantKey = variantIds.join(",");

  useEffect(() => {
    if (!api || !storeId) return;
    let cancelled = false;
    (async () => {
      try {
        const [forProduct, forVariant] = await Promise.all([api.listDefinitions(storeId, "product"), api.listDefinitions(storeId, "variant")]);
        const [productValues, variantValues] = productId
          ? await Promise.all([api.listValues(storeId, "product", [productId]), api.listValues(storeId, "variant", variantKey ? variantKey.split(",") : [])])
          : [[], []];
        if (cancelled) return;
        const loaded: Values = { product: {} };
        for (const entry of productValues) loaded.product[entry.definitionId] = entry.value;
        for (const entry of variantValues) { const key = `variant:${entry.ownerId}` as OwnerKey; (loaded[key] ??= {})[entry.definitionId] = entry.value; }
        setProductDefinitions(forProduct);
        setVariantDefinitions(forVariant);
        // Keep what the seller has already typed for combinations that were not loaded.
        setValues((current) => ({ ...loaded, ...Object.fromEntries(Object.entries(current).filter(([key]) => key !== "product" && !(key in loaded))) } as Values));
        setSaved(clone(loaded));
        setLoadError("");
      } catch (caught) {
        if (!cancelled) setLoadError(caught instanceof Error ? caught.message : "Custom data could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [api, storeId, productId, variantKey]);

  const valueOf = useCallback((owner: OwnerKey, definitionId: string) => values[owner]?.[definitionId], [values]);
  const problemFor = useCallback((owner: OwnerKey, definitionId: string) => problems[`${owner}|${definitionId}`], [problems]);

  const setValue = useCallback((owner: OwnerKey, definitionId: string, value: unknown) => {
    setValues((current) => {
      const next = { ...(current[owner] ?? {}) };
      if (value === null || value === undefined) delete next[definitionId]; else next[definitionId] = value;
      return { ...current, [owner]: next };
    });
    setProblems((current) => {
      const key = `${owner}|${definitionId}`;
      if (!(key in current)) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
    onChange?.();
  }, [onChange]);

  const dirty = useMemo(() => {
    const owners = new Set([...Object.keys(values), ...Object.keys(saved)]) as Set<OwnerKey>;
    for (const owner of owners) {
      const ids = new Set([...Object.keys(values[owner] ?? {}), ...Object.keys(saved[owner] ?? {})]);
      for (const id of ids) if (!sameValue(values[owner]?.[id], saved[owner]?.[id])) return true;
    }
    return false;
  }, [values, saved]);

  const createDefinition = useCallback(async (input: NewDefinition) => {
    if (!api || !storeId) throw new Error("Sign in to your store first.");
    const created = await api.createDefinition(storeId, input);
    (input.ownerType === "product" ? setProductDefinitions : setVariantDefinitions)((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    return created;
  }, [api, storeId]);

  const reset = useCallback(() => { setValues(clone(saved)); setProblems({}); }, [saved]);
  const clear = useCallback(() => { setValues({ product: {} }); setSaved({ product: {} }); setProblems({}); }, []);

  const saveAll = useCallback(async ({ productId: id, variantIds: map }: { productId: string; variantIds: Record<string, string> }) => {
    if (!api || !storeId) return { ok: true };
    const owners = new Set([...Object.keys(values), ...Object.keys(saved)]) as Set<OwnerKey>;
    const nextProblems: Record<string, string> = {};
    const nextSaved = clone(saved);
    let failure = "";
    for (const owner of owners) {
      const ids = new Set([...Object.keys(values[owner] ?? {}), ...Object.keys(saved[owner] ?? {})]);
      const changes: Record<string, unknown> = {};
      for (const definitionId of ids) if (!sameValue(values[owner]?.[definitionId], saved[owner]?.[definitionId])) changes[definitionId] = values[owner]?.[definitionId] ?? null;
      if (Object.keys(changes).length === 0) continue;
      const target = ownerOf(owner);
      const ownerId = target.type === "product" ? id : map[target.id] ?? target.id;
      try {
        await api.saveValues(storeId, target.type, ownerId, changes);
        nextSaved[owner] = { ...(values[owner] ?? {}) };
      } catch (caught) {
        const error = caught instanceof MetafieldApiError ? caught : null;
        for (const [definitionId, message] of Object.entries(error?.issues ?? {})) nextProblems[`${owner}|${definitionId}`] = message;
        failure ||= error?.message ?? (caught instanceof Error ? caught.message : "Custom data could not be saved.");
      }
    }
    // Combinations created in this session now have saved ids; their values move to the saved id.
    const rekey = (source: Values): Values => {
      const moved = { ...source } as Values;
      for (const [draftId, savedId] of Object.entries(map)) {
        const from = `variant:${draftId}` as OwnerKey, to = `variant:${savedId}` as OwnerKey;
        if (from === to || !(from in moved) || Object.keys(nextProblems).some((key) => key.startsWith(`${from}|`))) continue;
        moved[to] = moved[from];
        delete moved[from];
      }
      return moved;
    };
    setSaved(rekey(nextSaved));
    setValues((current) => rekey(current));
    setProblems(nextProblems);
    return failure ? { ok: false, message: failure } : { ok: true };
  }, [api, storeId, values, saved]);

  return { loading, loadError, productDefinitions, variantDefinitions, valueOf, setValue, problemFor, dirty, createDefinition, reset, clear, saveAll };
}
