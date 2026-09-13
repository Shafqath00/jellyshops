import { render, screen } from "@testing-library/react";
import { createDefaultStoreDesign, type RuntimeStorefrontSnapshotV4 } from "@jelly/storefront-schema";
import type { ResolvedStorefrontRoute } from "./resource-loader";
import { PublishedRuntimeStorefront, PublishedStorefront } from "./storefront-page";

function documentWithHeading(heading: string) { const document = createDefaultStoreDesign(); document.pages.home.sections[0].blocks[0].settings.text = heading; return document; }

it("renders only the supplied published document", () => {
  const live = documentWithHeading("LIVE");
  const draft = documentWithHeading("DRAFT");
  render(<PublishedStorefront document={live} storeSlug="sweet-bakes" currency="INR" products={[]} />);

  expect(screen.getByRole("heading", { name: "LIVE" })).toBeVisible();
  expect(screen.queryByText("DRAFT")).not.toBeInTheDocument();
});

it("renders a resolved compiled route without rebuilding a V3 document", () => {
  const snapshot: RuntimeStorefrontSnapshotV4 = {
    schemaVersion: 4,
    storeId: "store-demo",
    sourceGeneration: 5,
    compilerVersion: "2026-09",
    registryManifestHash: "registry-hash",
    theme: { presetId: "minimal", settings: {}, artifactId: null },
    templates: {
      home: { id: "home", type: "home", handle: "default", layout: { sections: [] } },
    },
    globalSections: {},
    menus: {},
    templateDefaults: { home: "home" },
    assignments: [],
    dependencies: { edges: [] },
  };
  const route: ResolvedStorefrontRoute = {
    status: "ready",
    resource: null,
    template: snapshot.templates.home,
    sections: [{
      id: "copy",
      type: "rich-text",
      enabled: true,
      settings: {},
      blocks: [{ id: "copy-text", type: "text", enabled: true, settings: { text: "COMPILED LIVE" } }],
    }],
  };

  render(<PublishedRuntimeStorefront snapshot={snapshot} route={route} storeSlug="sweet-bakes" currency="INR" products={[]} />);

  expect(screen.getByText("COMPILED LIVE")).toBeVisible();
});
