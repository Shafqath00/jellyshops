import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopProvider } from "@/contexts/shop-context";
import { OrderDetailView } from "./page";

it("moves a confirmed order into processing", async () => {
  const user = userEvent.setup();
  render(<ShopProvider><OrderDetailView orderId="order-001" /></ShopProvider>);

  await user.click(screen.getByRole("button", { name: /start processing/i }));

  expect(screen.getByText("Processing")).toBeVisible();
});
