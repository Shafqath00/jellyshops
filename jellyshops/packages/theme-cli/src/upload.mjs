import { readFileSync } from "node:fs";
import { buildPackage } from "./package.mjs";

/**
 * `jelly-theme upload [folder|package file] --store <id> --token <token> [--api <url>]`
 *
 * Sends the theme to the platform, which validates it again with the same rules. The token is a
 * developer token the store owner creates in Settings > Developer tokens (a signed-in session token
 * also works); it can also come from JELLY_TOKEN, the store from JELLY_STORE_ID and the address from
 * JELLY_API_URL.
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

/**
 * `jelly-theme install <version id> --store <id> --token <token> [--api <url>] [--replace <generation>]`
 *
 * Puts an uploaded version on a store: its starter pages go into the store's draft and the draft
 * starts using the version. A store that already has a draft needs `--replace <generation>`, the
 * workspace generation shown by the editor, to confirm the draft is replaced.
 */
export async function install(versionId, flags = {}) {
  const token = typeof flags.token === "string" ? flags.token : process.env.JELLY_TOKEN;
  const store = typeof flags.store === "string" ? flags.store : process.env.JELLY_STORE_ID;
  const api = (typeof flags.api === "string" ? flags.api : process.env.JELLY_API_URL ?? "http://127.0.0.1:3001").replace(/\/+$/, "");
  if (!versionId || !token || !store) {
    process.stderr.write("Usage: jelly-theme install <version id> --store <id> --token <token> [--replace <generation>]\n");
    return 2;
  }
  const replace = typeof flags.replace === "string" ? Number(flags.replace) : undefined;
  if (flags.replace !== undefined && (!Number.isInteger(replace) || replace < 0)) { process.stderr.write("--replace needs the workspace generation, a whole number.\n"); return 2; }
  let response;
  try {
    response = await fetch(`${api}/api/stores/${encodeURIComponent(store)}/theme-packages/versions/${encodeURIComponent(versionId)}/install`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(replace === undefined ? {} : { replaceDraft: true, expectedGeneration: replace }),
    });
  } catch (error) { process.stderr.write(`Could not reach ${api}: ${error.message}\n`); return 1; }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) { process.stderr.write(`${result?.error?.message ?? `The platform answered ${response.status}.`}\n`); return 1; }
  process.stdout.write(`Installed ${result.themeId} ${result.version} on the draft of store ${store} (workspace generation ${result.generation}). Open the editor to review it, then publish.\n`);
  return 0;
}
