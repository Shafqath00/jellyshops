"use client";

import { useState } from "react";
import { MetafieldFields } from "../metafields/metafield-fields";
import type { InputContext } from "../metafields/metafield-input";
import { NewDefinitionForm } from "../metafields/new-definition-form";
import type { ProductMetafields } from "../metafields/use-product-metafields";
import { Section } from "./section-parts";

type Props = {
  state: ProductMetafields;
  context: InputContext;
  /** Seller can create fields only with permission; the server decides, so this just hides a button that would fail. */
  canCreate?: boolean;
};

/** Extra details about the product that are not part of the standard form: material, care, a size guide link... */
export function MetafieldsSection({ state, context, canCreate = true }: Props) {
  const [adding, setAdding] = useState(false);
  const { productDefinitions } = state;

  return (
    <Section title="Custom data" hint="Extra details your theme can show, like material, care instructions or a size guide. Each field is set up once and used on every product.">
      {state.loading && <p role="status" className="text-[13px] text-muted-foreground">Loading custom fields…</p>}
      {state.loadError && <p role="alert" className="text-[13px] font-semibold text-destructive">{state.loadError}</p>}

      {!state.loading && !state.loadError && productDefinitions.length === 0 && !adding && (
        <p className="text-[13px] text-muted-foreground">No custom fields yet.{canCreate ? " Add one to keep details like material or care instructions with the product." : ""}</p>
      )}

      {productDefinitions.length > 0 && <MetafieldFields owner="product" definitions={productDefinitions} state={state} context={context} idPrefix="mf-product" />}

      {adding ? (
        <NewDefinitionForm ownerType="product" onCreate={(input) => state.createDefinition(input)} onCreated={() => setAdding(false)} onCancel={() => setAdding(false)} />
      ) : (
        canCreate && !state.loading && <button type="button" className="h-9 rounded-lg border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted" onClick={() => setAdding(true)}>Add custom field</button>
      )}
    </Section>
  );
}
