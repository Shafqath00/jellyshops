import { readFileSync } from "node:fs";
import { buildPackage } from "./package.mjs";

/**
 * `jelly-theme upload [folder|package file] --store <id> --token <token> [--api <url>]`
 *
 * Sends the theme to the platform, which validates it again with the same rules. The token is the
 * access token of a signed-in merchant session (the same bearer token the admin uses); it can also
 * come from JELLY_TOKEN, the store from JELLY_STORE_ID and the address from JELLY_API_URL.
 * Long-lived developer tokens do not exist yet, so tokens expire with the session.
 */
export async function upload(target, flags = {}) {
  const token = typeof flags.token === "string" ? flags.token : process.env.JELLY_TOKEN;
  const store = typeof flags.store === "string" ? flags.store : process.env.JELLY_STORE_ID;
  const api = (typeof flags.api === "string" ? flags.api : process.env.JELLY_API_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
  if (!token || !store) {
    process.stderr.write("Upload needs a store and a token: --store <id> --token <token> (or JELLY_STORE_ID and JELLY_TOKEN).\n");
    return 2;
  }

  let body;
  let label;
  try {
    if (target.endsWith(".json") && !target.endsWith("theme.json")) { body = readFileSync(target, "utf8"); label = target; }
    else { const built = buildPackage(target); body = JSON.stringify(built.content); label = built.name; }
  } catch (error) { process.stderr.write(`${error.message}\n`); return 1; }

  let response;
  try {
    response = await fetch(`${api}/api/stores/${encodeURIComponent(store)}/theme-packages`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body });
  } catch (error) {
    process.stderr.write(`Could not reach ${api}: ${error.message}\n`);
    return 1;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = result?.error?.message ?? result?.message ?? `The platform answered ${response.status}.`;
    process.stderr.write(`${message}\n`);
    for (const issue of result?.error?.issues ?? result?.issues ?? []) process.stderr.write(`  ${issue.path}: ${issue.message}\n`);
    return 1;
  }
  const created = response.status === 201;
  process.stdout.write(`${created ? "Uploaded" : "Already uploaded"} ${label}\n  theme ${result.package?.themeId}  version ${result.version?.version}  id ${result.version?.id}\n`);
  return 0;
}
