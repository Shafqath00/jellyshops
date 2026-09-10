import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShopProvider } from "@/contexts/shop-context";
import NewProductPage from "./page";

it("creates a sellable product from merchant inputs", async () => {
  const user = userEvent.setup();
  render(<ShopProvider><NewProductPage /></ShopProvider>);

  await user.type(screen.getByLabelText(/product name/i), "Mango Jelly Cake");
  await user.clear(screen.getByLabelText(/^price/i));
  await user.type(screen.getByLabelText(/^price/i), "650");
  await user.clear(screen.getByLabelText(/stock quantity/i));
  await user.type(screen.getByLabelText(/stock quantity/i), "6");
  await user.click(screen.getByRole("button", { name: /save product/i }));

  expect(await screen.findByText("Product saved")).toBeVisible();
});
