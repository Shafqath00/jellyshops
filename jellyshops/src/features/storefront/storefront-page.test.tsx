import { render, screen } from "@testing-library/react";
import { createDefaultStoreDesign } from "@jelly/storefront-schema";
import { PublishedStorefront } from "./storefront-page";

function documentWithHeading(heading: string) { const document = createDefaultStoreDesign(); document.pages.home.sections[0].blocks[0].settings.text = heading; return document; }

it("renders only the supplied published document", () => {
  const live = documentWithHeading("LIVE");
  const draft = documentWithHeading("DRAFT");
  render(<PublishedStorefront document={live} storeSlug="sweet-bakes" currency="INR" products={[]} />);

  expect(screen.getByRole("heading", { name: "LIVE" })).toBeVisible();
  expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
});
