"use client";

import type { MetafieldDefinition } from "./api";
import { MetafieldInput, type InputContext } from "./metafield-input";
import type { OwnerKey, ProductMetafields } from "./use-product-metafields";
import { typeLabel } from "./values";

type Props = {
  owner: OwnerKey;
  definitions: MetafieldDefinition[];
  state: ProductMetafields;
  context: InputContext;
  /** Keeps ids unique when several owners show the same fields. */
  idPrefix: string;
};

/** The custom fields of one product or combination, each with its own input, hint and error. */
export function MetafieldFields({ owner, definitions, state, context, idPrefix }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {definitions.map((definition) => {
        const id = `${idPrefix}-${definition.id}`;
        const problem = state.problemFor(owner, definition.id);
        const hintId = `${id}-hint`;
        const errorId = `${id}-error`;
        return (
          <div key={definition.id} className={definition.type.startsWith("list:") || ["text", "rich_text"].includes(definition.type) ? "sm:col-span-2" : undefined}>
            <label htmlFor={id} className="text-[13px] font-semibold text-foreground">{definition.name}</label>
            <div className="mt-1.5">
              <MetafieldInput definition={definition} id={id} value={state.valueOf(owner, definition.id)} onChange={(value) => state.setValue(owner, definition.id, value)} invalid={Boolean(problem)} describedBy={problem ? errorId : hintId} context={context} />
            </div>
            <p id={hintId} className="mt-1 text-[12px] leading-5 text-muted-foreground">
              {definition.description ? `${definition.description} · ` : ""}{typeLabel(definition.type)} · <code>{definition.namespace}.{definition.key}</code>{definition.storefrontVisible ? " · Available to your theme" : " · Admin only"}
            </p>
            {problem && <p id={errorId} role="alert" className="mt-1 text-[12px] font-semibold text-destructive">{problem}</p>}
          </div>
        );
      })}
    </div>
  );
}
