/**
 * App blocks: third-party tools a merchant places like any other block. Each
 * provider declares which https embed links it accepts; the storefront only ever
 * loads those links, in a sandboxed frame, so an app can't run code in the store
 * page itself. Built-in providers are listed here; an integration adds its own
 * with `registerAppBlockProvider()` (before the registry and renderer are used).
 */
export interface AppBlockProvider {
  id: string;
  name: string;
  /** Where the merchant finds the embed link, in plain words. */
  help: string;
  /** Accepted embed links (must be https). */
  pattern: RegExp;
  /** Frame height in px when the merchant hasn't set one. */
  defaultHeight: number;
  /** Extra sandbox permissions the app needs, e.g. "allow-forms". */
  sandbox?: string[];
}

const providers = new Map<string, AppBlockProvider>();

export function registerAppBlockProvider(provider: AppBlockProvider): void {
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(provider.id)) throw new Error(`App block provider id "${provider.id}" must be lowercase letters, numbers and dashes`);
  providers.set(provider.id, provider);
}

export function listAppBlockProviders(): AppBlockProvider[] { return [...providers.values()]; }
export function getAppBlockProvider(id: unknown): AppBlockProvider | undefined { return typeof id === "string" ? providers.get(id) : undefined; }

for (const provider of [
  { id: "google-maps", name: "Google Maps", help: "In Google Maps choose Share > Embed a map and copy the link inside src=\"…\".", pattern: /^https:\/\/www\.google\.com\/maps\/embed\?[^\s"'<>]+$/, defaultHeight: 400 },
  { id: "calendly", name: "Calendly", help: "Your booking page link, for example https://calendly.com/your-shop/visit.", pattern: /^https:\/\/calendly\.com\/[\w-]+(\/[\w-]+)?\/?(\?[^\s"'<>]*)?$/, defaultHeight: 660, sandbox: ["allow-forms", "allow-popups"] },
  { id: "typeform", name: "Typeform", help: "The form's share link, for example https://yourshop.typeform.com/to/abc123.", pattern: /^https:\/\/[\w-]+\.typeform\.com\/to\/[\w-]+\/?(\?[^\s"'<>]*)?$/, defaultHeight: 520, sandbox: ["allow-forms", "allow-popups"] },
  { id: "google-forms", name: "Google Forms", help: "In Google Forms choose Send > Embed and copy the link inside src=\"…\".", pattern: /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/viewform\?[^\s"'<>]*embedded=true[^\s"'<>]*$/, defaultHeight: 720, sandbox: ["allow-forms", "allow-popups"] },
  { id: "spotify", name: "Spotify", help: "In Spotify choose Share > Embed and copy the link inside src=\"…\".", pattern: /^https:\/\/open\.spotify\.com\/embed\/(track|album|playlist|show|episode|artist)\/[\w]+(\?[^\s"'<>]*)?$/, defaultHeight: 352 },
  { id: "soundcloud", name: "SoundCloud", help: "In SoundCloud choose Share > Embed and copy the link inside src=\"…\".", pattern: /^https:\/\/w\.soundcloud\.com\/player\/\?[^\s"'<>]+$/, defaultHeight: 166 },
  { id: "airtable", name: "Airtable", help: "In Airtable choose Share > Embed this view and copy the link inside src=\"…\".", pattern: /^https:\/\/airtable\.com\/embed\/[\w/-]+(\?[^\s"'<>]*)?$/, defaultHeight: 533 },
] satisfies AppBlockProvider[]) registerAppBlockProvider(provider);

/** The embed link to load for this provider, or null when it isn't one the provider accepts. */
export function appEmbedSource(providerId: unknown, url: unknown): string | null {
  const provider = getAppBlockProvider(providerId);
  if (!provider || typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed.length <= 2000 && provider.pattern.test(trimmed) ? trimmed : null;
}
