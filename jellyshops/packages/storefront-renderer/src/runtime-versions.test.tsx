import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { registerThemeProject } from "@jelly/storefront-themes";
import { RegistrySectionRenderer } from "./registry-section-renderer";

it("renders old published and new draft recipes together without selecting the last registered version", () => {
  const id = "render-versions";
  for (const version of ["2.0.0", "1.0.0"]) registerThemeProject({ manifest: {
    id, name: id, version, description: "x", assetPrefix: `/themes/${id}/`, enabled: true, layout: "standard", settingsDefaults: {},
    sections: [{ type: `${id}/promo`, name: version, supportedPages: ["home"], elements: [{ kind: "heading", text: `Recipe ${version}` }] }],
  } });
  const section = { id: "promo", type: `${id}/promo`, enabled: true, settings: {}, blocks: [] };
  const commerce = { getProducts: async () => [] };
  const view = render(<><div data-version="old"><RegistrySectionRenderer section={section} mode="published" commerce={commerce} themeId={id} themeVersion="1.0.0" /></div><div data-version="new"><RegistrySectionRenderer section={section} mode="editor" commerce={commerce} themeId={id} themeVersion="2.0.0" /></div></>);
  expect(view.container.querySelector('[data-version="old"]')?.textContent).toContain("Recipe 1.0.0");
  expect(view.container.querySelector('[data-version="new"]')?.textContent).toContain("Recipe 2.0.0");
});
