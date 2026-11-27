"use client";

import { X } from "lucide-react";
import { useCallback, useId, useState } from "react";
import type { ItemSelection } from "@jelly/storefront-schema";
import { Button, Picker, type PickerItem } from "@/components/admin";

export interface CatalogNames {
  products: Record<string, { title: string; active: boolean }>;
  collections: Record<string, { title: string; count: number }>;
}

/**
 * Which items something covers: all products (optional), chosen products or chosen collections. Chosen items show
 * as removable chips; "Browse" opens the kit picker with search.
 */
export function SelectionField({ legend, hideLegend = false, value, onChange, names, allowAll = false, allLabel = "All products", error, help }: {
  legend: string;
  /** When the card around it already says the same. */
  hideLegend?: boolean;
  value: ItemSelection;
  onChange: (next: ItemSelection) => void;
  names: CatalogNames;
  allowAll?: boolean;
  allLabel?: string;
  error?: string;
  help?: string;
}) {
  const id = useId();
  const [picking, setPicking] = useState(false);
  const scopes: Array<{ value: ItemSelection["scope"]; label: string }> = [
    ...(allowAll ? [{ value: "all" as const, label: allLabel }] : []),
    { value: "collections", label: "Specific collections" },
    { value: "products", label: "Specific products" },
  ];
  const chosen = value.scope === "products" ? value.productIds : value.scope === "collections" ? value.collectionIds : [];
  const label = (itemId: string) => (value.scope === "products" ? names.products[itemId]?.title : names.collections[itemId]?.title) ?? "Item no longer in your shop";
  const load = useCallback(async (query: string): Promise<PickerItem[]> => {
    const needle = query.toLowerCase();
    if (value.scope === "collections") {
      return Object.entries(names.collections).filter(([, item]) => item.title.toLowerCase().includes(needle)).slice(0, 100)
        .map(([itemId, item]) => ({ id: itemId, label: item.title, detail: `${item.count} ${item.count === 1 ? "product" : "products"}` }));
    }
    return Object.entries(names.products).filter(([, item]) => item.title.toLowerCase().includes(needle)).slice(0, 100)
      .map(([itemId, item]) => ({ id: itemId, label: item.title, detail: item.active ? undefined : "Not on sale" }));
  }, [names, value.scope]);
  const setIds = (ids: string[]) => onChange(value.scope === "products" ? { ...value, productIds: ids } : { ...value, collectionIds: ids });

  return <fieldset className="jk-discount-fieldset" aria-describedby={[help ? `${id}-help` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}>
    <legend className={hideLegend ? "sr-only" : undefined}>{legend}</legend>
    {help && <p id={`${id}-help`} className="jk-muted jk-discount-help">{help}</p>}
    <div className="jk-discount-options" role="radiogroup" aria-label={legend}>
      {scopes.map((scope) => <label key={scope.value} className="jk-discount-option">
        <input type="radio" name={`${id}-scope`} checked={value.scope === scope.value} onChange={() => onChange({ scope: scope.value, productIds: value.productIds, collectionIds: value.collectionIds })} />
        {scope.label}
      </label>)}
    </div>
    {value.scope !== "all" && <div className="jk-discount-chosen">
      {chosen.length > 0 && <ul aria-label={`Chosen ${value.scope}`}>
        {chosen.map((itemId) => <li key={itemId} className="jk-discount-chip">
          <span>{label(itemId)}</span>
          {value.scope === "products" && names.products[itemId] && !names.products[itemId]!.active && <span className="jk-muted"> · not on sale</span>}
          <button type="button" onClick={() => setIds(chosen.filter((other) => other !== itemId))} aria-label={`Remove ${label(itemId)}`}><X size={14} aria-hidden="true" /></button>
        </li>)}
      </ul>}
      <Button size="small" onClick={() => setPicking(true)}>{chosen.length ? "Change" : value.scope === "products" ? "Choose products" : "Choose collections"}</Button>
    </div>}
    {error && <p id={`${id}-error`} className="jk-field-error" role="alert">{error}</p>}
    <Picker
      open={picking}
      onOpenChange={setPicking}
      title={value.scope === "products" ? "Choose products" : "Choose collections"}
      searchLabel={value.scope === "products" ? "Search products" : "Search collections"}
      load={load}
      initialSelection={chosen}
      onDone={(items) => { setIds(items.map((item) => item.id)); setPicking(false); }}
    />
  </fieldset>;
}
