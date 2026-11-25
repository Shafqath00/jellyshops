/**
 * The store design a visitor picked on the home page ("Use this template"). It travels as ?template= to sign-up,
 * is kept in this browser (sign-up may continue in another tab after the email link), and onboarding starts with it.
 */
const KEY = "jellyshop-chosen-template";
const VALID = /^[a-z0-9][a-z0-9-]{1,62}$/;

export function chooseTemplateHref(themeId: string): string {
  return `/signup?template=${encodeURIComponent(themeId)}`;
}

export function rememberChosenTemplate(themeId: string | null | undefined): void {
  if (!themeId || !VALID.test(themeId)) return;
  try { localStorage.setItem(KEY, themeId); } catch { /* private mode: onboarding falls back to its suggestion */ }
}

export function readChosenTemplate(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    return value && VALID.test(value) ? value : null;
  } catch { return null; }
}

export function forgetChosenTemplate(): void {
  try { localStorage.removeItem(KEY); } catch { /* nothing kept */ }
}
