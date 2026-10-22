import { render, screen } from "@testing-library/react";
import { OrderStatusBadge } from "./order-status";

it("shows a readable shipped status", () => {
  render(<OrderStatusBadge status="SHIPPED" />);
  expect(screen.getByText("Shipped")).toBeVisible();
});
