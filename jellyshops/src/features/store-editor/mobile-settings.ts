import type { ControlDefinition } from "@jelly/storefront-registry";

/**
 * Phone values in the editor, like Shopify's mobile view: while the preview is on
 * Mobile, settings with a phone value (controls marked `mobile`) show and save
 * `responsive.mobile[key]` instead of the desktop value. Clearing a phone value
 * ("Same as desktop", or the reset button) removes it, so the desktop value applies again.
 */

export interface SettingsNode {
  settings: Record<string, unknown>;
  responsive?: { mobile?: Record<string, unknown> };
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
export function controlsForView(controls: ControlDefinition[], mobile: boolean, settings: Record<string, unknown> = {}): ControlDefinition[] {
  if (!mobile) return controls;
  return controls.map((control): ControlDefinition => {
    if (!control.mobile) return control;
    const phone: ControlDefinition = { ...control, label: `${control.label} (phone)`, description: `Phones only. Desktop: ${describe(control, settings[control.key])}.` };
    if (phone.type === "select" || phone.type === "segmented") {
      phone.options = [sameAsDesktop, ...phone.options.filter((option) => option.value !== "")];
    }
    return phone;
  });
}

/** Values the panel shows: on Mobile, phone settings show their phone value (empty when they follow desktop). */
export function settingsForView(node: SettingsNode, controls: ControlDefinition[], mobile: boolean): Record<string, unknown> {
  if (!mobile) return node.settings;
  const phone = node.responsive?.mobile ?? {};
  const result = { ...node.settings };
  for (const key of mobileKeys(controls)) {
    if (key in phone) result[key] = phone[key];
    else delete result[key];
  }
  return result;
}

/** Applies a settings change: on Mobile, phone settings go to `responsive.mobile`; everything else changes the desktop value. */
export function applySettingsPatch<T extends SettingsNode>(node: T, patch: Record<string, unknown>, controls: ControlDefinition[], mobile: boolean): T {
  const phoneKeys = mobile ? mobileKeys(controls) : new Set<string>();
  const settings = { ...node.settings };
  const phone = { ...(node.responsive?.mobile ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (!phoneKeys.has(key)) settings[key] = value;
    else if (value === undefined || value === null || value === "") delete phone[key];
    else phone[key] = value;
  }
  const { responsive, ...rest } = node;
  const otherResponsive = { ...(responsive ?? {}) };
  delete otherResponsive.mobile;
  const nextResponsive = Object.keys(phone).length ? { ...otherResponsive, mobile: phone } : otherResponsive;
  return { ...rest, settings, ...(Object.keys(nextResponsive).length ? { responsive: nextResponsive } : {}) } as T;
}
