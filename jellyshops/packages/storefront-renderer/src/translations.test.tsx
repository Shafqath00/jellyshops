import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { SectionNode } from "@jelly/storefront-schema";
import { readTranslations, translateSection, withTranslation } from "@jelly/storefront-schema";
import { validateSectionAgainstRegistry } from "@jelly/storefront-registry";
import { storeLanguages } from "@jelly/storefront-themes";
import { RegistrySectionRenderer } from "./registry-section-renderer";

const commerce = { getProducts: async () => [] };
const section = (): SectionNode => ({
  id: "c", type: "custom-content", enabled: true, settings: { translations: { hi: { } } }, blocks: [
    { id: "h", type: "heading", enabled: true, settings: { text: "Welcome", textDoc: { type: "doc", content: [] }, translations: { hi: { text: "स्वागत है" }, fr: { text: "Bienvenue" } } } },
    { id: "g", type: "group", enabled: true, settings: {}, blocks: [{ id: "b", type: "button", enabled: true, settings: { label: "Shop now", href: "/shop", translations: { hi: { label: "खरीदें" } } } }] },
  ],
});

it("draws a section's text in the chosen language, falling back to the main text", () => {
  const { unmount } = render(<RegistrySectionRenderer section={section()} mode="published" commerce={commerce} language="hi" />);
  expect(screen.getByRole("heading", { name: "स्वागत है" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "खरीदें" })).toHaveAttribute("href", "/shop");
  unmount();
  render(<RegistrySectionRenderer section={section()} mode="published" commerce={commerce} language="ta" />);
  expect(screen.getByRole("heading", { name: "Welcome" })).toBeInTheDocument();
});

it("replaces the formatted copy and keeps blocks without translations as they are", () => {
  const translated = translateSection(section(), "fr");
  expect(translated.blocks[0].settings).toMatchObject({ text: "Bienvenue" });
  expect(translated.blocks[0].settings.textDoc).toBeUndefined();
  expect((translated.blocks[1].blocks ?? [])[0].settings.label).toBe("Shop now");
  expect(translateSection(section(), null)).toEqual(section());
});

it("writes and removes translations", () => {
  const settings = withTranslation({ text: "Hi" }, "hi", { text: "नमस्ते" });
  expect(readTranslations(settings)).toEqual({ hi: { text: "नमस्ते" } });
  expect(withTranslation(settings, "hi", { text: "" })).toEqual({ text: "Hi" });
});

it("refuses translations of settings that can't be translated or with bad language codes", () => {
  const issues = (settings: Record<string, unknown>) => validateSectionAgainstRegistry({ ...section(), blocks: [{ id: "b", type: "button", enabled: true, settings: { label: "Go", href: "/shop", ...settings } }] }, "home").map(({ message }) => message);
  expect(issues({ translations: { hi: { label: "जाओ" } } })).toEqual([]);
  expect(issues({ translations: { hi: { href: "/hi" } } })).toEqual(["Translations: href can't be translated."]);
  expect(issues({ translations: { Hindi: { label: "x" } } })[0]).toMatch(/isn't a language code/);
  expect(issues({ translations: { hi: { label: 5 } } })[0]).toMatch(/must be text/);
});

it("reads the store's languages from theme settings", () => {
  expect(storeLanguages({ languages: { extra: "hi, FR,  pt-br, hi, not a code" } }).map(({ code }) => code)).toEqual(["hi", "fr", "pt-BR"]);
  expect(storeLanguages({}).length).toBe(0);
});
