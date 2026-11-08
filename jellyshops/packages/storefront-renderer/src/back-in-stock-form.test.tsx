import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { BackInStockForm } from "./sections/back-in-stock-form";

describe("back-in-stock form", () => {
  it("asks for an email, sends it and confirms", async () => {
    const onSubmit = vi.fn(async () => ({ ok: true }));
    const { container } = render(<BackInStockForm onSubmit={onSubmit} />);
    expect((await axe.run(container, { rules: { "color-contrast": { enabled: false }, region: { enabled: false } } })).violations).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Email me" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter your email address.");
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "ana@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me" }));
    expect(await screen.findByRole("status")).toHaveTextContent("We'll email you once when it's back.");
    expect(onSubmit).toHaveBeenCalledWith("ana@example.test", undefined);
  });

  it("shows the shop's message when refused", async () => {
    render(<BackInStockForm onSubmit={async () => ({ ok: false, message: "Good news: this is in stock now." })} />);
    fireEvent.change(screen.getByLabelText("Your email"), { target: { value: "ana@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("in stock now");
  });
});
