import { expect, it } from "vitest";
import type { ControlDefinition } from "@jelly/storefront-registry";
import { applySettingsPatch, controlsForView, mobileKeys, settingsForView } from "./mobile-settings";

const controls: ControlDefinition[] = [
  { type: "range", key: "pad", mobile: true, label: "Top", group: "style", min: 0, max: 200, step: 4, unit: "px" },
  { type: "select", key: "align", mobile: true, label: "Alignment", group: "layout", options: [{ label: "Theme default", value: "" }, { label: "Centre", value: "center" }] },
  { type: "text", key: "title", label: "Title", group: "content", maxLength: 80 },
];
const node = { settings: { pad: 64, align: "center", title: "Hi" }, responsive: { mobile: { pad: 16 } } };

it("shows desktop values on desktop and phone values on Mobile", () => {
  expect(mobileKeys(controls)).toEqual(new Set(["pad", "align"]));
  expect(settingsForView(node, controls, false)).toBe(node.settings);
  // Phone settings without a phone value show empty ("Same as desktop").
  expect(settingsForView(node, controls, true)).toEqual({ pad: 16, title: "Hi" });
  const phone = controlsForView(controls, true, node.settings);
  expect(phone[0]).toMatchObject({ label: "Top (phone)", description: "Phones only. Desktop: 64px." });
  expect(phone[1]).toMatchObject({ label: "Alignment (phone)", description: "Phones only. Desktop: Centre.", options: [{ label: "Same as desktop", value: "" }, { label: "Centre", value: "center" }] });
  expect(phone[2]).toBe(controls[2]);
  expect(controlsForView(controls, false)).toBe(controls);
});

it("saves phone settings as phone values on Mobile and removes them when cleared", () => {
  const phone = applySettingsPatch(node, { align: "center", pad: 8, title: "New" }, controls, true);
  expect(phone).toEqual({ settings: { pad: 64, align: "center", title: "New" }, responsive: { mobile: { pad: 8, align: "center" } } });
  const cleared = applySettingsPatch(phone, { pad: undefined, align: "" }, controls, true);
  expect(cleared).toEqual({ settings: { pad: 64, align: "center", title: "New" } });
  expect(applySettingsPatch(node, { pad: 0 }, controls, false)).toEqual({ settings: { pad: 0, align: "center", title: "Hi" }, responsive: { mobile: { pad: 16 } } });
  // Other node fields (id, blocks) are kept.
  expect(applySettingsPatch({ id: "b", ...node }, { pad: 4 }, controls, true)).toMatchObject({ id: "b", responsive: { mobile: { pad: 4 } } });
});

it("keeps tablet values apart from phone values", () => {
  const both = { settings: { pad: 64, align: "center", title: "Hi" }, responsive: { mobile: { pad: 16 } } };
  const tablet = applySettingsPatch(both, { pad: 40 }, controls, "tablet");
  expect(tablet).toEqual({ settings: both.settings, responsive: { mobile: { pad: 16 }, tablet: { pad: 40 } } });
  expect(settingsForView(tablet, controls, "tablet")).toMatchObject({ pad: 40 });
  expect(settingsForView(tablet, controls, "mobile")).toMatchObject({ pad: 16 });
  expect(controlsForView(controls, "tablet", both.settings)[0]).toMatchObject({ label: "Top (tablet)", description: "Tablets only. Desktop: 64px." });
  // Clearing the tablet value leaves the phone value alone.
  expect(applySettingsPatch(tablet, { pad: undefined }, controls, "tablet")).toEqual(both);
});

it("replaces the older Background choice when a colour scheme or own colours is picked", () => {
  const legacy = { settings: { colorScheme: "soft", heading: "Hi" } };
  expect(applySettingsPatch(legacy, { styleScheme: "scheme3" }, controls, false).settings).toEqual({ styleScheme: "scheme3", heading: "Hi" });
  expect(applySettingsPatch(legacy, { styleColors: true }, controls, false).settings).toEqual({ styleColors: true, heading: "Hi" });
  expect(applySettingsPatch(legacy, { heading: "New" }, controls, false).settings).toEqual({ colorScheme: "soft", heading: "New" });
});
