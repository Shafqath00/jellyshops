import { fireEvent, render, screen } from "@testing-library/react";
import { getV4StarterPack } from "@jelly/storefront-registry";
import { expect, it, vi } from "vitest";
import { TemplatePreviewDialog } from "./template-preview";

it("renders each shared starter section once in an isolated responsive preview", () => {
  render(<TemplatePreviewDialog starter={getV4StarterPack("fresh-market")} hasWorkspace={false} busy={false} onClose={vi.fn()} onUse={vi.fn()} onEdit={vi.fn()} />);
  const frame = screen.getByTitle("Template preview") as HTMLIFrameElement;
  fireEvent.load(frame);
  expect(frame.contentDocument!.querySelectorAll('[data-testid="section-header"]')).toHaveLength(1);
  expect(frame.contentDocument!.querySelectorAll('[data-testid="section-announcement-bar"]')).toHaveLength(1);
  expect(frame.contentDocument!.querySelectorAll('[data-testid="section-footer"]')).toHaveLength(1);
});

it("shows the merchant's own name, logo and products, and switches theme styles", () => {
  const onUse = vi.fn();
  const store = { name: "Moss & Fern", logoUrl: "https://cdn.example.com/logo.png", products: [{ id: "p1", name: "Fern candle", href: "/moss/products/fern-candle", imageUrl: "", price: "£18.00" }] };
  render(<TemplatePreviewDialog starter={getV4StarterPack("jelly-signature")} hasWorkspace={false} busy={false} store={store} onClose={vi.fn()} onUse={onUse} onEdit={vi.fn()} />);
  expect(screen.getByText(/Moss & Fern's name, logo and products/)).toBeInTheDocument();
  const frame = screen.getByTitle("Template preview") as HTMLIFrameElement;
  fireEvent.load(frame);
  const doc = frame.contentDocument!;
  expect(doc.querySelectorAll('[data-testid="section-header"]')).toHaveLength(1);
  // With a logo the header shows the logo, named after the store.
  const logo = doc.querySelector(".jelly-header img");
  expect(logo?.getAttribute("src")).toBe("https://cdn.example.com/logo.png");
  expect(logo?.getAttribute("alt")).toBe("Moss & Fern");
  const styles = screen.getByRole("radiogroup", { name: "Theme style" });
  expect(screen.getByRole("radio", { name: /Warm sand/ })).toHaveAttribute("aria-checked", "true");
  fireEvent.click(screen.getByRole("radio", { name: /Sage/ }));
  expect(screen.getByRole("radio", { name: /Sage/ })).toHaveAttribute("aria-checked", "true");
  expect(styles).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Start with this design/ }));
  expect(onUse).toHaveBeenCalledWith("sage");
});

it("offers no style switcher for themes without styles", () => {
  render(<TemplatePreviewDialog starter={getV4StarterPack("fresh-market")} hasWorkspace={false} busy={false} onClose={vi.fn()} onUse={vi.fn()} onEdit={vi.fn()} />);
  expect(screen.queryByRole("radiogroup", { name: "Theme style" })).not.toBeInTheDocument();
});
