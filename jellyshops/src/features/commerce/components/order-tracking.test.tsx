import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderProgress, OrderTimeline, ShipmentList } from "./order-tracking";

const steps = [
  { key: "PLACED" as const, label: "Placed", state: "done" as const, at: "2026-10-20T10:00:00.000Z" },
  { key: "PROCESSING" as const, label: "Being prepared", state: "done" as const, at: "2026-10-20T12:00:00.000Z" },
  { key: "SHIPPED" as const, label: "Shipped", state: "current" as const, at: "2026-10-21T09:00:00.000Z" },
  { key: "DELIVERED" as const, label: "Delivered", state: "upcoming" as const, at: null },
];

describe("OrderProgress", () => {
  it("marks the current step for assistive technology and hides dates for steps not reached yet", () => {
    render(<OrderProgress steps={steps} />);
    const list = screen.getByRole("list", { name: "Delivery progress" });
    const items = within(list).getAllByRole("listitem");
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[0]).toHaveAttribute("data-state", "done");
    expect(items[3]).toHaveTextContent("(not yet)");
    expect(items[3]).not.toHaveAttribute("aria-current");
  });

  it("renders nothing when there is no progress to show", () => {
    const { container } = render(<OrderProgress steps={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("ShipmentList", () => {
  const shipment = {
    id: "s1",
    status: "SHIPPED",
    carrier: "Royal Mail",
    trackingNumber: "RM123",
    trackingUrl: "https://track.example.com/RM123",
    items: [{ title: "Belted wool coat", quantity: 1 }],
    shippedAt: "2026-10-21T09:00:00.000Z",
    deliveredAt: null,
  };

  it("shows the carrier, tracking number, items and a courier link that opens safely in a new tab", () => {
    render(<ShipmentList shipments={[shipment]} />);
    expect(screen.getByRole("heading", { name: "Your shipment" })).toBeInTheDocument();
    expect(screen.getByText("RM123")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Track on Royal Mail/ });
    expect(link).toHaveAttribute("href", "https://track.example.com/RM123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Belted wool coat")).toBeInTheDocument();
  });

  it("numbers several shipments and shows the delivery date once delivered", () => {
    render(<ShipmentList shipments={[shipment, { ...shipment, id: "s2", trackingNumber: null, trackingUrl: null, carrier: null, deliveredAt: "2026-10-23T15:00:00.000Z" }]} />);
    expect(screen.getByRole("heading", { name: "Your shipments" })).toBeInTheDocument();
    expect(screen.getByText("Shipment 2")).toBeInTheDocument();
    expect(screen.getByText(/Delivered Oct 23, 2026/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Track on/ })).toHaveTextContent("Royal Mail");
  });

  it("renders nothing without shipments", () => {
    const { container } = render(<ShipmentList shipments={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("OrderTimeline", () => {
  it("lists entries in the order given, with dates", () => {
    render(<OrderTimeline entries={[{ label: "Order placed", at: "2026-10-20T10:00:00.000Z" }, { label: "Shipped", at: "2026-10-21T09:00:00.000Z" }]} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["Order placedOct 20, 2026", "ShippedOct 21, 2026"]);
  });
});
