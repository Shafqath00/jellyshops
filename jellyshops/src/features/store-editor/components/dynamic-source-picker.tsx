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
    <div className="mt-2 rounded-lg border border-[#e3e3e3] bg-[#fafafa] p-2" aria-label="Dynamic sources">
      <p className="px-1 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#8c9196]">Dynamic source</p>
      <div className="space-y-0.5">
        {compatible.map((source) => (
          <button
            key={source.id}
            type="button"
            aria-label={source.label}
            onClick={() => onSelect(structuredClone(source.binding))}
            className="flex min-h-8 w-full items-center rounded-md px-2 text-left text-[11px] font-medium text-[#454f5b] hover:bg-white"
          >
            {source.label}
          </button>
        ))}
      </div>
    </div>
  );
}
