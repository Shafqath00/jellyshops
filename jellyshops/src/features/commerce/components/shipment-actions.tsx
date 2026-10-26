"use client";

import { useState } from "react";

/**
 * Merchant controls for one order's delivery: mark packed, send a parcel out
 * for delivery, and report or clear a delay or failed delivery. The parent does
 * the API call and reloads the order; this component only decides which actions
 * make sense now and shows a failure if one is refused.
 */
export interface ShipmentActionsShipment {
  id: string;
  status: string;
  exception?: string | null;
  deliveredAt?: string | null;
  trackingNumber?: string | null;
  carrier?: string | null;
}

export interface ShipmentActionsProps {
  orderStatus: string;
  revision: number;
  shipments: ShipmentActionsShipment[];
  onPacked(revision: number): Promise<unknown>;
  onOutForDelivery(shipmentId: string, revision: number): Promise<unknown>;
  onException(shipmentId: string, exception: "DELAYED" | "DELIVERY_FAILED" | null, revision: number): Promise<unknown>;
}

const EXCEPTION_LABEL: Record<"DELAYED" | "DELIVERY_FAILED", string> = { DELAYED: "Delayed", DELIVERY_FAILED: "Delivery attempt failed" };

export function ShipmentActions({ orderStatus, revision, shipments, onPacked, onOutForDelivery, onException }: ShipmentActionsProps) {
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const canPack = orderStatus === "PROCESSING";

  async function run(key: string, work: () => Promise<unknown>) {
    setBusy(key);
    setError(undefined);
    try {
      await work();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This action could not be completed. Refresh and try again.");
    } finally {
      setBusy(undefined);
    }
  }

  return <section aria-labelledby="shipment-actions-heading" className="rounded-2xl border border-border bg-card p-5">
    <h2 id="shipment-actions-heading" className="font-semibold">Delivery actions</h2>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {canPack && <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">The order is being prepared. Mark it packed when it is ready to go.</p>
      <button type="button" className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50" disabled={busy !== undefined} onClick={() => void run("packed", () => onPacked(revision))}>Mark packed</button>
    </div>}
    {shipments.map((shipment, index) => {
      const open = !shipment.deliveredAt && (shipment.status === "SHIPPED" || shipment.status === "OUT_FOR_DELIVERY");
      const label = shipments.length > 1 ? `Shipment ${index + 1}` : "Shipment";
      return <div key={shipment.id} className="mt-4 grid gap-3 border-t border-border pt-4" data-testid={`shipment-actions-${shipment.id}`}>
        <p className="text-sm font-medium">{label}{shipment.exception && shipment.exception in EXCEPTION_LABEL ? <span className="ml-2 rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-900">{EXCEPTION_LABEL[shipment.exception as "DELAYED" | "DELIVERY_FAILED"]}</span> : null}</p>
        {open && <div className="flex flex-wrap gap-2">
          {shipment.status === "SHIPPED" && <button type="button" className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50" disabled={busy !== undefined} onClick={() => void run(`out:${shipment.id}`, () => onOutForDelivery(shipment.id, revision))}>Out for delivery</button>}
          {!shipment.exception && <>
            <button type="button" className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50" disabled={busy !== undefined} onClick={() => void run(`delay:${shipment.id}`, () => onException(shipment.id, "DELAYED", revision))}>Report delay</button>
            <button type="button" className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50" disabled={busy !== undefined} onClick={() => void run(`fail:${shipment.id}`, () => onException(shipment.id, "DELIVERY_FAILED", revision))}>Report failed delivery</button>
          </>}
          {shipment.exception && <button type="button" className="min-h-10 rounded-lg border border-border px-3 text-sm font-semibold disabled:opacity-50" disabled={busy !== undefined} onClick={() => void run(`clear:${shipment.id}`, () => onException(shipment.id, null, revision))}>Clear problem</button>}
        </div>}
      </div>;
    })}
  </section>;
}
