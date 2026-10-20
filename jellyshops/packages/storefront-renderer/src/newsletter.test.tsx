import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { NewsletterSection } from "./sections/home-sections";
it("requires consent and reports persistence failures without claiming success", async () => {
  const subscribe = vi.fn(async () => { throw new Error("Try again later"); });
  render(<NewsletterSection section={{ id: "newsletter", type: "newsletter", settings: {}, blocks: [], enabled: true }} subscribe={subscribe} mode="published" />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "reader@example.test" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Try again later"));
  expect(subscribe).toHaveBeenCalledWith("reader@example.test", "newsletter");
  expect(screen.queryByText("You’re subscribed.")).not.toBeInTheDocument();
});
