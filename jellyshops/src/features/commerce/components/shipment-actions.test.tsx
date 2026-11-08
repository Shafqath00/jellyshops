import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShipmentActions, type ShipmentActionsProps } from "./shipment-actions";

function setup(overrides: Partial<ShipmentActionsProps> = {}) {
  const props: ShipmentActionsProps = {
    orderStatus: "PROCESSING",
    revision: 7,
    shipments: [],
    onPacked: vi.fn(async () => {}),
    onOutForDelivery: vi.fn(async () => {}),
    onException: vi.fn(async () => {}),
    ...overrides,
  };
  render(<ShipmentActions {...props} />);
  return props;
}

const shipped = { id: "f1", status: "SHIPPED", deliveredAt: null, exception: null };

describe("ShipmentActions", () => {
  it("offers packing only while the order is being prepared, and passes the current revision", async () => {
    const props = setup({ orderStatus: "PROCESSING" });
    fireEvent.click(screen.getByRole("button", { name: "Mark packed" }));
    await waitFor(() => expect(props.onPacked).toHaveBeenCalledWith(7));
  });

  it("does not offer packing once the order has moved on", () => {
    setup({ orderStatus: "SHIPPED", shipments: [shipped] });
    expect(screen.queryByRole("button", { name: "Mark packed" })).not.toBeInTheDocument();
  });

  it("sends a shipped parcel out for delivery, and reports or clears problems on the right parcels", async () => {
    const props = setup({ shipments: [shipped, { id: "f2", status: "OUT_FOR_DELIVERY", deliveredAt: null, exception: "DELAYED" }] });
    const first = screen.getByTestId("shipment-actions-f1");
    fireEvent.click(within(first).getByRole("button", { name: "Out for delivery" }));
    await waitFor(() => expect(props.onOutForDelivery).toHaveBeenCalledWith("f1", 7));
    const second = screen.getByTestId("shipment-actions-f2");
    expect(within(second).queryByRole("button", { name: "Out for delivery" })).not.toBeInTheDocument();
    expect(within(second).queryByRole("button", { name: "Report delay" })).not.toBeInTheDocument();
    expect(within(second).getByText("Delayed")).toBeInTheDocument();
    fireEvent.click(within(second).getByRole("button", { name: "Clear problem" }));
    await waitFor(() => expect(props.onException).toHaveBeenCalledWith("f2", null, 7));
  });

  it("reports a delay or a failed delivery on a parcel that is on its way", async () => {
    const props = setup({ shipments: [shipped] });
    const card = screen.getByTestId("shipment-actions-f1");
    fireEvent.click(within(card).getByRole("button", { name: "Report failed delivery" }));
    await waitFor(() => expect(props.onException).toHaveBeenCalledWith("f1", "DELIVERY_FAILED", 7));
  });

  it("offers nothing on a delivered parcel", () => {
    setup({ shipments: [{ id: "f1", status: "DELIVERED", deliveredAt: "2026-10-23T10:00:00.000Z", exception: null }] });
    expect(screen.getByTestId("shipment-actions-f1").querySelectorAll("button")).toHaveLength(0);
  });

  it("shows the reason when the server refuses an action, and lets the merchant try again", async () => {
    const onPacked = vi.fn(async () => { throw new Error("This order changed. Refresh and review the latest version."); });
    setup({ onPacked });
    fireEvent.click(screen.getByRole("button", { name: "Mark packed" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This order changed");
    expect(screen.getByRole("button", { name: "Mark packed" })).toBeEnabled();
  });
});
