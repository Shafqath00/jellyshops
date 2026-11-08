import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { RegistrySectionRenderer } from "./registry-section-renderer";
import { MetaobjectEntryContent } from "./sections/metaobject-list";
import type { PublicMetaobjectList } from "./types";

const list: PublicMetaobjectList = {
  definition: { handle: "designers", name: "Designers", fields: [{ handle: "photo", name: "Photo", type: "image" }, { handle: "city", name: "City", type: "string" }, { handle: "site", name: "Website", type: "url" }] },
  entries: [
    { handle: "ana", displayName: "Ana Ruiz", values: { photo: "https://cdn.test/ana.jpg", city: "Leeds", site: "https://ana.test" } },
    { handle: "bo", displayName: "Bo Chen", values: { city: "York" } },
  ],
};
const section = (settings: Record<string, unknown>): SectionNode => ({ id: "m", type: "metaobject-list", enabled: true, settings: { heading: "Makers", ...settings }, blocks: [] });
const commerce = (result: PublicMetaobjectList | null) => ({ getProducts: async () => [], getMetaobjects: async (handle: string) => handle === "designers" ? result : null });

it("lists the entries with their details and links to each entry's page", async () => {
  render(<RegistrySectionRenderer section={section({ metaobject: "designers" })} mode="published" commerce={commerce(list)} storeSlug="shop" />);
  expect(await screen.findByRole("link", { name: "Ana Ruiz" })).toHaveAttribute("href", "/shop/pages/designers/ana");
  expect(screen.getByText("Leeds")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "ana.test" })).toHaveAttribute("href", "https://ana.test");
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
});

it("respects the entry limit and the link and details settings", async () => {
  render(<RegistrySectionRenderer section={section({ metaobject: "designers", limit: 1, linkToPages: false, showFields: false })} mode="published" commerce={commerce(list)} />);
  expect(await screen.findByText("Ana Ruiz")).toBeInTheDocument();
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.queryByText("Leeds")).toBeNull();
  expect(screen.queryByText("Bo Chen")).toBeNull();
});

it("is hidden on the live store without entries and explains why in the editor", async () => {
  const live = render(<RegistrySectionRenderer section={section({ metaobject: "missing" })} mode="published" commerce={commerce(list)} />);
  expect(live.container.querySelector(".jelly-metaobject-list")).toBeNull();
  live.unmount();
  render(<RegistrySectionRenderer section={section({ metaobject: "missing" })} mode="editor" commerce={commerce(list)} />);
  expect(await screen.findByText(/No metaobject "missing" is visible/)).toBeInTheDocument();
});

it("validates the handle and draws an entry's own page", () => {
  expect(validateSectionAgainstRegistry(section({ metaobject: "designers" }), "home")).toEqual([]);
  expect(validateSectionAgainstRegistry(section({ metaobject: "Bad Handle" }), "home").map(({ code }) => code)).toEqual(["SETTINGS_INVALID"]);
  render(<MetaobjectEntryContent definition={list.definition} entry={list.entries[0]} storeSlug="shop" />);
  expect(screen.getByRole("heading", { level: 1, name: "Ana Ruiz" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Ana Ruiz" })).toHaveAttribute("src", "https://cdn.test/ana.jpg");
  expect(screen.getByText("City")).toBeInTheDocument();
});
