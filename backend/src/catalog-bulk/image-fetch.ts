import { lookup as dnsLookup } from "node:dns/promises";
import https from "node:https";
import net from "node:net";

/**
 * Fetches a product photo from a web address given in an import file.
 *
 * The address comes from a merchant's spreadsheet, so it is treated as hostile: only https on the
 * usual port, no sign-in details, and never an address inside a private or local network (which
 * would let a file reach internal services through our server). The host name is looked up once,
 * every address it gives is checked, and the connection is made to exactly that checked address,
 * so a name that changes its answer between the check and the fetch cannot slip through. Redirects
 * are followed by hand, a few at most, with the same checks each time. Size and time are capped.
 */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const IMAGE_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_URL_LENGTH = 2000;

export type ImageUrlCheck = { ok: true; url: URL } | { ok: false; reason: string };
export interface ResolvedAddress { address: string; family: number }
export interface DownloadResult { status: number; location?: string; body?: Buffer; tooLarge?: boolean }
export interface ImageFetchDeps {
  resolve(host: string): Promise<ResolvedAddress[]>;
  download(url: URL, address: ResolvedAddress, limit: number, timeoutMs: number): Promise<DownloadResult>;
}
export class ImageFetchError extends Error {}

function ipv4Parts(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return null;
  return parts.map(Number);
}

function publicIpv4(address: string): boolean {
  const parts = ipv4Parts(address);
  if (!parts) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false; // this network, private, loopback, multicast and reserved
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false; // protocol assignments, documentation
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51 && c === 100) return false; // documentation
  if (a === 203 && b === 0 && c === 113) return false; // documentation
  return true;
}

/** True only for addresses on the public internet. Anything unrecognised counts as not public. */
export function isPublicAddress(address: string): boolean {
  const kind = net.isIP(address);
  if (kind === 4) return publicIpv4(address);
  if (kind !== 6) return false;
  const text = address.toLowerCase().split("%")[0];
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (mapped) return publicIpv4(mapped[1]);
  if (text === "::" || text === "::1") return false;
  const first = parseInt(text.split(":")[0] || "0", 16);
  if (text.startsWith("::")) return false; // IPv4-compatible and other low ranges
  if ((first & 0xfe00) === 0xfc00) return false; // unique local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return false; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (text.startsWith("64:ff9b:")) return false; // NAT64 can point at private IPv4
  if (text.startsWith("2001:db8:")) return false; // documentation
  if (text.startsWith("2002:")) return false; // 6to4 wraps an IPv4 address
  return true;
}

/** What can be told from the text alone, before any lookup. Used when checking an import file. */
export function checkImageUrl(text: string): ImageUrlCheck {
  const value = text.trim();
  if (value.length > MAX_URL_LENGTH) return { ok: false, reason: "is too long to be a web address" };
  let url: URL;
  try { url = new URL(value); } catch { return { ok: false, reason: "is not a web address. Use a full address starting with https://" }; }
  if (url.protocol !== "https:") return { ok: false, reason: "must start with https://" };
  if (url.username || url.password) return { ok: false, reason: "must not contain a user name or password" };
  if (url.port && url.port !== "443") return { ok: false, reason: "must not name a port" };
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || /\.(localhost|local|internal|lan|home|corp|intranet)$/.test(host) || !host.includes(".") && !host.includes(":")) return { ok: false, reason: "must be an address on the public internet" };
  if (net.isIP(host) && !isPublicAddress(host)) return { ok: false, reason: "must be an address on the public internet" };
  return { ok: true, url };
}

const defaultDeps: ImageFetchDeps = {
  resolve: async (host) => (await dnsLookup(host, { all: true, verbatim: true })).map(({ address, family }) => ({ address, family })),
  download: (url, address, limit, timeoutMs) => new Promise<DownloadResult>((resolve, reject) => {
    let settled = false;
    const finish = (work: () => void) => { if (!settled) { settled = true; clearTimeout(timer); work(); } };
    const request = https.get({
      host: url.hostname, servername: url.hostname, port: 443, path: `${url.pathname}${url.search}`, agent: false,
      headers: { Accept: "image/*", "User-Agent": "JellyShops-ImageImport/1.0", Host: url.host },
      // Connect to the address that was checked, whatever the name resolves to now.
      lookup: ((_host: string, options: { all?: boolean }, callback: (error: Error | null, address: unknown, family?: number) => void) => {
        if (options?.all) callback(null, [{ address: address.address, family: address.family }]);
        else callback(null, address.address, address.family);
      }) as never,
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400) { response.resume(); finish(() => resolve({ status, location: String(response.headers.location ?? "") })); return; }
      if (status !== 200) { response.resume(); finish(() => resolve({ status })); return; }
      if (Number(response.headers["content-length"] ?? 0) > limit) { request.destroy(); finish(() => resolve({ status, tooLarge: true })); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) { request.destroy(); finish(() => resolve({ status, tooLarge: true })); return; }
        chunks.push(chunk);
      });
      response.on("end", () => finish(() => resolve({ status, body: Buffer.concat(chunks) })));
      response.on("error", (error) => finish(() => reject(error)));
    });
    const timer = setTimeout(() => { request.destroy(); finish(() => reject(new ImageFetchError("took too long to answer"))); }, timeoutMs);
    request.on("error", (error) => finish(() => reject(error)));
  }),
};

/**
 * Downloads one image. Throws `ImageFetchError` with a plain reason the merchant can act on.
 * The bytes are not trusted either: the caller validates them as an image before storing them.
 */
export async function fetchImage(text: string, deps: ImageFetchDeps = defaultDeps): Promise<{ buffer: Buffer; fileName: string }> {
  let checked = checkImageUrl(text);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!checked.ok) throw new ImageFetchError(checked.reason);
    const url = checked.url;
    const host = url.hostname.replace(/^\[|\]$/g, "");
    let addresses: ResolvedAddress[];
    try { addresses = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await deps.resolve(host); }
    catch { throw new ImageFetchError("could not be found. Check the address"); }
    // If a name answers with even one private address, it is refused outright.
    if (!addresses.length || !addresses.every((entry) => isPublicAddress(entry.address))) throw new ImageFetchError("must be an address on the public internet");
    let result: DownloadResult;
    try { result = await deps.download(url, addresses[0], MAX_IMAGE_BYTES, IMAGE_TIMEOUT_MS); }
    catch (failure) { throw failure instanceof ImageFetchError ? failure : new ImageFetchError("could not be downloaded. Check the address opens in a browser"); }
    if (result.tooLarge) throw new ImageFetchError("is larger than 8 MB");
    if (result.status >= 300 && result.status < 400) {
      if (!result.location) throw new ImageFetchError("could not be downloaded");
      let next: string;
      try { next = new URL(result.location, url).toString(); } catch { throw new ImageFetchError("could not be downloaded"); }
      checked = checkImageUrl(next);
      continue;
    }
    if (result.status !== 200 || !result.body?.length) throw new ImageFetchError(result.status === 404 ? "was not found (404)" : result.status === 401 || result.status === 403 ? "is not public. Open it in a private browser window to check" : "could not be downloaded");
    const name = decodeURIComponent(url.pathname.split("/").pop() ?? "").replace(/[^\w.\- ]+/g, "").slice(0, 120) || "photo";
    return { buffer: result.body, fileName: name };
  }
  throw new ImageFetchError("redirects too many times");
}
