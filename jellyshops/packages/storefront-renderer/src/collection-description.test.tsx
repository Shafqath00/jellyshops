import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CollectionDescriptionSection, CollectionHeaderSection } from "./sections/collection-sections";
import type { StorefrontRuntimeContext } from "./runtime-context";

const contextFor = (collection: Record<string, unknown>) => ({
  page: { pageType: "collection", resource: { id: "c1", handle: "cakes", data: { collectionPresentation: { collection: { id: "c1", title: "Cakes", description: "Baked daily", ...collection }, products: [], totalProducts: 0 } } } },
}) as unknown as StorefrontRuntimeContext;
const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Baked ", marks: [{ type: "bold" }] }, { type: "text", text: "daily" }] }] };

it("shows the formatted collection description when there is one", () => {
  const { container } = render(<CollectionDescriptionSection context={contextFor({ descriptionDoc: doc })} section={{ settings: {} }} />);
  expect(container.querySelector(".jelly-rich-description strong")).toHaveTextContent("Baked");
  expect(container).toHaveTextContent("Baked daily");
});

it("falls back to the plain description, and shows nothing when there is none", () => {
  const plain = render(<CollectionDescriptionSection context={contextFor({})} section={{ settings: {} }} />);
  expect(plain.container.querySelector("p")).toHaveTextContent("Baked daily");
  plain.unmount();
  const none = render(<CollectionDescriptionSection context={contextFor({ description: "", descriptionDoc: null })} section={{ settings: {} }} />);
  expect(none.container).toBeEmptyDOMElement();
});

it("uses the formatted description in the collection header too", () => {
  const { container } = render(<CollectionHeaderSection context={contextFor({ descriptionDoc: doc })} section={{ settings: { showDescription: true } }} />);
  expect(container.querySelector(".jelly-rich-description strong")).toBeTruthy();
  render(<CollectionHeaderSection context={contextFor({})} section={{ settings: {} }} />);
  expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(2);
});
