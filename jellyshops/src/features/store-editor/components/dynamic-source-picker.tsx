import type { DynamicBinding, DynamicValueType } from "@jelly/storefront-schema";

export interface DynamicSourceOption {
  id: string;
  label: string;
  valueType: DynamicValueType;
  binding: DynamicBinding;
}

export function DynamicSourcePicker({
  acceptedTypes,
  sources,
  onSelect,
}: {
  acceptedTypes: DynamicValueType[];
  sources: DynamicSourceOption[];
  onSelect(binding: DynamicBinding): void;
}) {
  if (acceptedTypes.length === 0) return null;
  const compatible = sources.filter((source) => acceptedTypes.includes(source.valueType));
  if (compatible.length === 0) return null;

  return (
    <details className="mt-1.5" aria-label="Dynamic sources">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden" title="Fill this in automatically from your store, such as the store name or the product shown">Use store data</summary>
      <div className="mt-1 space-y-0.5 rounded-lg border border-border bg-muted/50 p-1">
        {compatible.map((source) => (
          <button
            key={source.id}
            type="button"
            aria-label={source.label}
            onClick={() => onSelect(structuredClone(source.binding))}
            className="flex min-h-8 w-full items-center rounded-md px-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-white"
          >
            {source.label}
          </button>
        ))}
      </div>
    </details>
  );
}
