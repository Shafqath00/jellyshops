import { formatWeight, parcelWeight, type ShippingSnapshot } from "@/features/product-builder/shipping";

type Line = { quantity: number; fulfillmentType?: string; fulfilmentType?: string; shippingSnapshot?: ShippingSnapshot | null };

/** Total weight of what has to be packed, and a nudge when some lines have no recorded weight. */
export function ParcelWeight({ items }: { items: Line[] }) {
  const parcel = parcelWeight(items);
  if (parcel.physical === 0) return null;
  return (
    <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
      <span>Parcel weight: <strong className="font-semibold text-foreground">{parcel.missing === parcel.physical ? "Not recorded" : formatWeight(parcel.grams)}</strong></span>
      {parcel.missing > 0 && parcel.missing < parcel.physical && <span> · {parcel.missing} {parcel.missing === 1 ? "item has" : "items have"} no recorded weight, so this is a minimum</span>}
    </div>
  );
}
