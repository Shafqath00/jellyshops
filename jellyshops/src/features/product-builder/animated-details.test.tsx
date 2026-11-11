import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LazyMotion, domAnimation } from "framer-motion";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AnimatedDetails } from "./animated-details";

const policy = vi.hoisted(() => ({ animated: true }));
vi.mock("./product-surface", () => ({ useProductMotion: () => policy.animated }));
beforeEach(() => { policy.animated = true; });

function renderDetails() {
  return render(<LazyMotion features={domAnimation}><AnimatedDetails><summary>Optional settings</summary><label>Stock code<input defaultValue="KEEP-01" /></label></AnimatedDetails></LazyMotion>);
}

describe("animated product disclosures", () => {
  it("keeps field values mounted through opening, closing and rapid reversal", async () => {
    const user = userEvent.setup();
    renderDetails();
    const trigger = screen.getByText("Optional settings");
    const field = screen.getByLabelText("Stock code");
    await user.click(trigger);
    await user.type(field, "A");
    await user.click(trigger);
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(field).toHaveValue("KEEP-01A");
    await user.click(trigger);
    await waitFor(() => expect(trigger.closest("details")).not.toHaveAttribute("open"));
    expect(screen.getByLabelText("Stock code")).toBe(field);
  });

  it("adopts a native open requested by validation", async () => {
    renderDetails();
    const details = screen.getByText("Optional settings").closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    await waitFor(() => expect(screen.getByText("Optional settings")).toHaveAttribute("aria-expanded", "true"));
  });

  it("uses immediate native disclosure behavior when motion is disabled", async () => {
    policy.animated = false;
    const user = userEvent.setup();
    renderDetails();
    const trigger = screen.getByText("Optional settings");
    await user.click(trigger);
    expect(screen.getByLabelText("Stock code")).toBeVisible();
    await user.click(trigger);
    expect(screen.getByLabelText("Stock code")).not.toBeVisible();
  });
});
