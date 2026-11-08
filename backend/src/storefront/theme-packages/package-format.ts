import { createHash } from "node:crypto";
import { customCssProblem, scopeCustomCss } from "@jelly/storefront-schema";
import { compareThemeVersions, isPlatformThemeId, validateThemeProject } from "@jelly/storefront-themes";
import { z } from "zod";
import { ApiError, type ApiIssue } from "../../http/errors.js";

/** Limits for one uploaded theme package (the whole request body stays under 8 MB). */
export const PACKAGE_LIMITS = {
  cssBytes: 150_000,
  assetBytes: 1_000_000,
  totalAssetBytes: 5_000_000,
  assetCount: 60,
} as const;

const ASSET_TYPES: Record<string, { extension: string; magic?: (data: Buffer) => boolean }> = {
  "image/png": { extension: "png", magic: (data) => data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { extension: "jpg", magic: (data) => data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff },
  "image/webp": { extension: "webp", magic: (data) => data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP" },
  "image/gif": { extension: "gif", magic: (data) => ["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString("latin1")) },
  "image/svg+xml": { extension: "svg" },
  "font/woff2": { extension: "woff2", magic: (data) => data.subarray(0, 4).toString("latin1") === "wOF2" },
};

const assetPath = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/;

const packageSchema = z.object({
  format: z.literal(1),
  manifest: z.record(z.string(), z.unknown()),
  starter: z.record(z.string(), z.unknown()).optional(),
  css: z.string().default(""),
  assets: z.array(z.object({ path: z.string(), contentType: z.string(), base64: z.string() }).strict()).default([]),
}).strict();

export interface PackageAsset { path: string; contentType: string; extension: string; size: number; sha256: string; data: Buffer }

export interface ParsedThemePackage {
  themeId: string;
  name: string;
  version: string;
  manifest: Record<string, unknown>;
  starter: Record<string, unknown> | null;
  /** The stylesheet with every selector scoped to the theme (what stores load). */
  css: string;
  assets: PackageAsset[];
  /** Hash of everything the package contains, used to recognise an identical re-upload. */
  contentHash: string;
}

function invalid(message: string, issues?: ApiIssue[]): never {
  throw new ApiError(400, "INVALID_PACKAGE", message, issues);
}

const SVG_UNSAFE = /<\s*(script|foreignObject|iframe|object|embed)\b|\bon[a-z]{3,}\s*=|javascript\s*:|(?:href|src)\s*=\s*["'](?!#)/i;

function checkAsset(entry: { path: string; contentType: string; base64: string }): PackageAsset {
  const type = ASSET_TYPES[entry.contentType];
  if (!type) invalid(`${entry.path}: ${entry.contentType} files are not allowed. Use png, jpeg, webp, gif, svg or woff2.`);
  if (!assetPath.test(entry.path) || entry.path.includes("..")) invalid(`${entry.path}: file names use lowercase letters, numbers, dots, dashes and folders only.`);
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(entry.base64) || entry.base64.length % 4 === 1) invalid(`${entry.path}: the file content is not valid base64.`);
  const data = Buffer.from(entry.base64, "base64");
  if (!data.length) invalid(`${entry.path}: the file is empty.`);
  if (data.length > PACKAGE_LIMITS.assetBytes) invalid(`${entry.path}: files can be up to ${Math.round(PACKAGE_LIMITS.assetBytes / 1000)} KB.`);
  if (type.magic && !type.magic(data)) invalid(`${entry.path}: the content does not match ${entry.contentType}.`);
  if (entry.contentType === "image/svg+xml" && SVG_UNSAFE.test(data.toString("utf8"))) invalid(`${entry.path}: SVG files cannot contain scripts, event handlers or links to other files.`);
  return { path: entry.path, contentType: entry.contentType, extension: type.extension, size: data.length, sha256: createHash("sha256").update(data).digest("hex"), data };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(",")}}`;
  return JSON.stringify(value);
}

/**
 * Checks an uploaded package with the same rules as `jelly-theme validate` and turns it into what
 * gets stored. Throws ApiError(400, "INVALID_PACKAGE") with a plain message for the first problems.
 */
export function parseThemePackage(raw: unknown): ParsedThemePackage {
  const shape = packageSchema.safeParse(raw);
  if (!shape.success) invalid("This is not a theme package. Make one with `jelly-theme package`.", shape.error.issues.map((issue) => ({ path: issue.path.join(".") || "package", message: issue.message })));

  const { manifest, starter, css, assets: entries } = shape.data;
  if (entries.length > PACKAGE_LIMITS.assetCount) invalid(`A package can hold up to ${PACKAGE_LIMITS.assetCount} files.`);
  const seen = new Set<string>();
  const assets = entries.map((entry) => {
    if (seen.has(entry.path)) invalid(`${entry.path}: the file is listed twice.`);
    seen.add(entry.path);
    return checkAsset(entry);
  });
  if (assets.reduce((sum, asset) => sum + asset.size, 0) > PACKAGE_LIMITS.totalAssetBytes) invalid(`The files in a package can total up to ${Math.round(PACKAGE_LIMITS.totalAssetBytes / 1_000_000)} MB.`);

  const themeId = typeof manifest.id === "string" ? manifest.id : "";
  const prefix = `/themes/${themeId}/`;
  const issues = validateThemeProject({
    manifest,
    starter,
    assetExists: (path) => seen.has(path.startsWith(prefix) ? path.slice(prefix.length) : path.replace(/^\/+/, "")),
  });
  const errors = issues.filter((issue) => issue.level === "error");
  if (errors.length) invalid(`${errors.length} problem${errors.length === 1 ? "" : "s"} in the theme: ${errors.slice(0, 5).map((issue) => `${issue.path}: ${issue.message}`).join(" ")}`, errors.map(({ path, message }) => ({ path, message })));
  if (isPlatformThemeId(themeId)) invalid(`"${themeId}" is a theme that ships with the platform. Choose another id.`);
  if (typeof manifest.version !== "string" || typeof manifest.name !== "string") invalid("theme.json needs a name and a version.");

  if (css.length > PACKAGE_LIMITS.cssBytes) invalid(`The stylesheet can be up to ${Math.round(PACKAGE_LIMITS.cssBytes / 1000)} KB.`);
  const scoped = css.trim() ? scopeCustomCss(css, `[data-jelly-theme="${themeId}"]`, PACKAGE_LIMITS.cssBytes) : "";
  if (scoped === null) invalid(`theme.css: ${customCssProblem(css, PACKAGE_LIMITS.cssBytes) ?? "this stylesheet cannot be used."}`);

  const contentHash = createHash("sha256").update(canonical({ manifest, starter: starter ?? null, css, assets: assets.map((asset) => [asset.path, asset.sha256]) })).digest("hex");
  return { themeId, name: manifest.name as string, version: manifest.version as string, manifest, starter: starter ?? null, css: scoped, assets, contentHash };
}

/** Backwards-compatible name for the shared SemVer comparator. */
export const compareVersions = compareThemeVersions;
