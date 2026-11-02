import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing and access tokens for a password-protected storefront.
 * The password is stored only as a salted scrypt hash. A shopper who enters it
 * gets an access token: an HMAC of the store id keyed by that hash, so changing
 * the password (or turning protection off and on with a new one) signs every
 * shopper out, and no extra secret has to be configured.
 */
export const MIN_PASSWORD_LENGTH = 4;
export const MAX_PASSWORD_LENGTH = 100;

const KEY_LENGTH = 32;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { N: 16384, r: 8, p: 1 }, (error, key) => error ? reject(error) : resolve(key)));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("base64url")}$${(await derive(password, salt)).toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function accessToken(storeId: string, passwordHash: string): string {
  return createHmac("sha256", passwordHash).update(`storefront-access:${storeId}`).digest("base64url");
}

export function tokenMatches(storeId: string, passwordHash: string, token: unknown): boolean {
  if (typeof token !== "string" || token.length > 200) return false;
  const expected = Buffer.from(accessToken(storeId, passwordHash));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}
