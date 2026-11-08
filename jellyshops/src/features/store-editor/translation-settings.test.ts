import { getBlockDefinition } from "@jelly/storefront-registry";
import { expect, it } from "vitest";
import { applyLanguagePatch, controlsForLanguage, settingsForLanguage } from "./translation-settings";

const controls = getBlockDefinition("button")!.controls;
const node = { settings: { label: "Shop now", href: "/shop", translations: { hi: { label: "खरीदें" } } } };

it("shows text settings in the language being edited, labelled, with the main text as a hint", () => {
  const label = controlsForLanguage(controls, "hi", "हिन्दी", node.settings).find((control) => control.key === "label")!;
  expect(label.label).toBe("Button text (हिन्दी)");
  expect(label.description).toContain("“Shop now”");
  expect(controlsForLanguage(controls, "hi", "हिन्दी").find((control) => control.key === "href")!.label).toBe("Link");
  expect(settingsForLanguage(node.settings, controls, "hi")).toMatchObject({ label: "खरीदें", href: "/shop" });
  expect(settingsForLanguage(node.settings, controls, "fr").label).toBe("");
  expect(controlsForLanguage(controls, null, "")).toBe(controls);
});

it("saves text to the language and other settings for every language", () => {
  const next = applyLanguagePatch(node, { label: "अभी खरीदें", href: "/sale" }, controls, "hi")!;
  expect(next.settings).toEqual({ label: "Shop now", href: "/sale", translations: { hi: { label: "अभी खरीदें" } } });
  expect(applyLanguagePatch(node, { label: "" }, controls, "hi")!.settings.translations).toBeUndefined();
  expect(applyLanguagePatch(node, { label: "x" }, controls, null)).toBeNull();
});
