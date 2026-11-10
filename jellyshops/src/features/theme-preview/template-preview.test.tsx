import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { jellyFormaPreview, jellyMinimalPreview } from "./configs";
import { TemplatePreview } from "./template-preview";

afterEach(cleanup);

it("previews furniture finishes and an interactive same-product gallery", async () => {
  render(<TemplatePreview template="product" config={jellyFormaPreview} />);
  // The page is laid out by the live loader, which answers asynchronously.
  expect(await screen.findByRole("group", { name: "Product photos" }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Natural oak" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Small" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Buy now" })).not.toBeInTheDocument();
});

it("preserves the existing size choices and gallery path for other previews", async () => {
  render(<TemplatePreview template="product" config={jellyMinimalPreview} />);
  expect(await screen.findByRole("button", { name: "Small" }, { timeout: 5000 })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Medium" })).toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Product photos" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Buy now" })).toBeInTheDocument();
});
