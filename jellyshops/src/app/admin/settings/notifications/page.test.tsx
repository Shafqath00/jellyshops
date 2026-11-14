import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/admin";
import NotificationSettingsPage from "./page";

vi.mock("@/features/auth/providers/auth-provider", () => ({ authApiOrigin: () => "http://api.test", useAuth: () => ({ session: { access_token: "token" }, activeStore: { id: "store-1" } }) }));
afterEach(() => vi.unstubAllGlobals());

it("edits and previews email wording without changing the order details or sending mail", async () => {
  const user = userEvent.setup();
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/branding")) return new Response(JSON.stringify({ accentColor: "#192642" }));
    if (url.includes("/templates/")) return new Response(JSON.stringify({ subject: "Order placed", heading: "Thank you", message: "We received your order", closing: "Thanks" }));
    if (url.endsWith("/preview")) return new Response(JSON.stringify({ html: "<p>Example item</p>" }));
    return new Response("{}", { status: 404 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ToastProvider><NotificationSettingsPage /></ToastProvider>);
  const message = await screen.findByLabelText("Message");
  await user.clear(message);
  await user.type(message, "We are delighted to make this for you.");
  await user.click(screen.getByRole("button", { name: "Preview email" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith("http://api.test/api/stores/store-1/order-notifications/preview", expect.objectContaining({ method: "POST", body: expect.stringContaining("We are delighted to make this for you.") })));
  expect(screen.getByTitle("Order email preview")).toHaveAttribute("srcdoc", "<p>Example item</p>");
  await user.click(screen.getByRole("button", { name: "Save wording" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith("http://api.test/api/stores/store-1/order-notifications/templates/PLACED", expect.objectContaining({ method: "PUT", body: expect.stringContaining("We are delighted to make this for you.") })));
  expect(await screen.findByText("Email wording saved")).toBeVisible();
});
