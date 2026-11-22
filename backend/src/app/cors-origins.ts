/**
 * Turns the CORS_ORIGINS list into what the `cors` package accepts. Besides exact origins, an entry may start its
 * host with one `*.` label, e.g. `https://*.jellyshop.io` or `http://*.localhost:3000`, which allows exactly one
 * shop-shaped label in its place (lowercase letters, digits and single hyphens, 3 to 63 characters), so every shop
 * subdomain can call the API without listing it. The request origin is never reflected otherwise.
 */
export type CorsOriginMatcher = string | RegExp;

const LABEL = String.raw`(?=[a-z0-9-]{3,63}\.)[a-z0-9]+(?:-[a-z0-9]+)*`;

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function corsOriginMatchers(origins: string[]): CorsOriginMatcher[] {
  return origins.map((origin) => {
    const match = /^(https?):\/\/\*\.([a-z0-9.-]+(?::\d+)?)$/i.exec(origin);
    if (!match) {
      if (origin.includes("*")) throw new Error(`CORS_ORIGINS entry "${origin}" may only use "*." at the start of its host`);
      return origin;
    }
    const [, scheme, rest] = match;
    return new RegExp(`^${scheme!.toLowerCase()}://${LABEL}\\.${escape(rest!.toLowerCase())}$`);
  });
}
