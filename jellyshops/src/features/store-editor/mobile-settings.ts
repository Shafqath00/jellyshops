import type { ControlDefinition } from "@jelly/storefront-registry";

/**
 * Phone and tablet values in the editor, like Shopify's mobile view: while the preview is on
 * Mobile (or Tablet), settings with a separate value (controls marked `mobile`) show and save
 * `responsive.mobile[key]` (`responsive.tablet[key]`) instead of the desktop value. Clearing it
 * ("Same as desktop", or the reset button) removes it, so the desktop value applies again.
 * The functions take the device, or a boolean where `true` means phone.
 */

export type EditingDevice = "desktop" | "tablet" | "mobile";
const deviceOf = (view: boolean | EditingDevice): EditingDevice => view === true ? "mobile" : view === false ? "desktop" : view;
const deviceName = { mobile: "phone", tablet: "tablet" } as const;

export interface SettingsNode {
  settings: Record<string, unknown>;
  responsive?: { mobile?: Record<string, unknown>; tablet?: Record<string, unknown> };
}

const sameAsDesktop = { label: "Same as desktop", value: "" };

export function mobileKeys(controls: ControlDefinition[]): Set<string> {
  return new Set(controls.filter((control) => control.mobile).map((control) => control.key));
}

/** The desktop value in words, for the phone control's description. */
function describe(control: ControlDefinition, value: unknown): string {
  if (value === undefined || value === null || value === "") return "theme default";
  if ((control.type === "select" || control.type === "segmented") && typeof value === "string") {
    return control.options.find((option) => option.value === value)?.label ?? value;
  }
  if ((control.type === "range" || control.type === "number") && typeof value === "number") return `${value}${control.unit ?? ""}`;
  return String(value);
}

/** Controls as the panel shows them: on Mobile, phone settings are labelled and can go back to the desktop value. */
export function controlsForView(controls: ControlDefinition[], view: boolean | EditingDevice, settings: Record<string, unknown> = {}): ControlDefinition[] {
  const device = deviceOf(view);
  if (device === "desktop") return controls;
  const name = deviceName[device];
  return controls.map((control): ControlDefinition => {
    if (!control.mobile) return control;
    const phone: ControlDefinition = { ...control, label: `${control.label} (${name})`, description: `${name === "phone" ? "Phones" : "Tablets"} only. Desktop: ${describe(control, settings[control.key])}.` };
    if (phone.type === "select" || phone.type === "segmented") {
      phone.options = [sameAsDesktop, ...phone.options.filter((option) => option.value !== "")];
    }
    return phone;
  });
}

/** Values the panel shows: on Mobile, phone settings show their phone value (empty when they follow desktop). */
export function settingsForView(node: SettingsNode, controls: ControlDefinition[], view: boolean | EditingDevice): Record<string, unknown> {
  const device = deviceOf(view);
  if (device === "desktop") return node.settings;
  const phone = node.responsive?.[device] ?? {};
  const result = { ...node.settings };
  for (const key of mobileKeys(controls)) {
    if (key in phone) result[key] = phone[key];
    else delete result[key];
  }
  return result;
}

const SPACING_KEYS = ["stylePaddingTop", "stylePaddingBottom"];

/** Applies a settings change: on Mobile, phone settings go to `responsive.mobile`; everything else changes the desktop value. */
export function applySettingsPatch<T extends SettingsNode>(node: T, patch: Record<string, unknown>, controls: ControlDefinition[], view: boolean | EditingDevice): T {
  const device = deviceOf(view);
  const phoneKeys = device !== "desktop" ? mobileKeys(controls) : new Set<string>();
  const settings = { ...node.settings };
  const phone = { ...(device !== "desktop" ? node.responsive?.[device] ?? {} : {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (!phoneKeys.has(key)) settings[key] = value;
    else if (value === undefined || value === null || value === "") delete phone[key];
    else phone[key] = value;
  }
  // Choosing a colour scheme or own colours replaces the older Background choice (one colour system).
  if ((typeof patch.styleScheme === "string" && patch.styleScheme) || patch.styleColors === true) delete settings.colorScheme;
  // A preset spacing (None / Small / Medium / Large) replaces exact sizes on every screen; only Custom keeps them.
  const presetSpacing = "styleSpacing" in patch && patch.styleSpacing !== "custom";
  if (presetSpacing) for (const key of SPACING_KEYS) { delete settings[key]; delete phone[key]; }
  const { responsive, ...rest } = node;
  const otherResponsive = { ...(responsive ?? {}) };
  if (device !== "desktop") delete otherResponsive[device];
  if (presetSpacing) {
    for (const [name, values] of Object.entries(otherResponsive)) {
      if (!values) continue;
      const kept = Object.fromEntries(Object.entries(values).filter(([key]) => !SPACING_KEYS.includes(key)));
      if (Object.keys(kept).length) otherResponsive[name as keyof typeof otherResponsive] = kept;
      else delete otherResponsive[name as keyof typeof otherResponsive];
    }
  }
  const nextResponsive = device !== "desktop" && Object.keys(phone).length ? { ...otherResponsive, [device]: phone } : otherResponsive;
  return { ...rest, settings, ...(Object.keys(nextResponsive).length ? { responsive: nextResponsive } : {}) } as T;
}
