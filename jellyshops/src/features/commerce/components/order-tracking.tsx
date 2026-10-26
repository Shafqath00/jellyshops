import type { PublicProgressStep, PublicShipment, PublicTimelineEntry } from "../api/types";

/** Shared shopper-facing order tracking: delivery progress, shipments and the timeline. Styled by each theme through the `jelly-order-*` and `jelly-shipment*` classes. */

export function formatOrderDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function OrderProgress({ steps }: { steps: PublicProgressStep[] }) {
  if (steps.length === 0) return null;
  return <ol className="jelly-order-progress" aria-label="Delivery progress">
    {steps.map((step) => {
      const date = formatOrderDate(step.at);
      return <li key={step.key} className="jelly-order-progress-step" data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
        <span className="jelly-order-progress-marker" aria-hidden="true" />
        <span className="jelly-order-progress-label">{step.label}</span>
        {date && step.state !== "upcoming" && <span className="jelly-order-progress-date">{date}</span>}
        {step.state === "upcoming" && <span className="jelly-visually-hidden"> (not yet)</span>}
      </li>;
    })}
  </ol>;
}

export function ShipmentList({ shipments }: { shipments: PublicShipment[] }) {
  if (shipments.length === 0) return null;
  return <section className="jelly-order-shipments" aria-labelledby="order-shipments-heading">
    <h2 id="order-shipments-heading">{shipments.length === 1 ? "Your shipment" : "Your shipments"}</h2>
    {shipments.map((shipment, index) => {
      const shipped = formatOrderDate(shipment.shippedAt);
      const delivered = formatOrderDate(shipment.deliveredAt);
      return <article key={shipment.id} className="jelly-shipment" data-status={shipment.status}>
        <header>
          <strong>{shipments.length > 1 ? `Shipment ${index + 1}` : "Shipment"}</strong>
          <span className="jelly-shipment-status">{delivered ? `Delivered ${delivered}` : shipped ? `Shipped ${shipped}` : "Shipped"}</span>
        </header>
        {shipment.carrier && <p className="jelly-shipment-carrier">Carrier: {shipment.carrier}</p>}
        {shipment.trackingNumber && <p className="jelly-shipment-number">Tracking number: <span>{shipment.trackingNumber}</span></p>}
        {shipment.trackingUrl && <p><a className="jelly-button jelly-button--link" href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer">Track on {shipment.carrier ?? "the courier's website"} (opens in a new tab)</a></p>}
        {shipment.items.length > 0 && <ul className="jelly-shipment-items">{shipment.items.map((item, position) => <li key={`${item.title}-${position}`}>{item.title}<small> × {item.quantity}</small></li>)}</ul>}
      </article>;
    })}
  </section>;
}

export function OrderTimeline({ entries }: { entries: PublicTimelineEntry[] }) {
  if (entries.length === 0) return null;
  return <section className="jelly-order-timeline" aria-labelledby="order-timeline-heading">
    <h2 id="order-timeline-heading">Order history</h2>
    <ol>{entries.map((entry, index) => <li key={`${entry.label}-${index}`}><span>{entry.label}</span>{formatOrderDate(entry.at) && <time dateTime={entry.at}>{formatOrderDate(entry.at)}</time>}</li>)}</ol>
  </section>;
}
