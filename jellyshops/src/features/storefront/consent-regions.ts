/**
 * Countries whose privacy laws expect consent before non-essential cookies: the EU and EEA (GDPR + ePrivacy), the UK
 * (UK GDPR + PECR), Switzerland, and a few others with similar rules. Unknown countries count as "needs consent".
 */
export const CONSENT_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH", "BR", "ZA", "KR", "TR", "IL",
]);

export function consentRequiredFor(country: string | null | undefined): boolean {
  const code = country?.trim().toUpperCase();
  if (!code || code === "XX" || code === "T1") return true;
  return CONSENT_COUNTRIES.has(code);
}
