import { z } from "zod";

/** The declarative theme API version, independent of internal npm package versions. */
export const JELLY_THEME_API_VERSION = "1.0.0";

const number = "(?:0|[1-9][0-9]*)";
const identifier = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
const versionPattern = new RegExp(`^(${number})\\.(${number})\\.(${number})(?:-(${identifier}(?:\\.${identifier})*))?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);

function parseVersion(value: string): { core: number[]; prerelease: string[] } | null {
  if (value.length > 128) return null;
  const match = versionPattern.exec(value);
  if (!match) return null;
  const core = match.slice(1, 4).map(Number);
  return core.every(Number.isSafeInteger) ? { core, prerelease: match[4]?.split(".") ?? [] } : null;
}

export const themeVersionSchema = z.string().max(128).regex(versionPattern, "Use a semantic version such as 1.2.0 or 2.0.0-beta.1 (no leading zeroes).").refine((value) => value.length > 128 || !versionPattern.test(value) || parseVersion(value) !== null, "Version numbers must be safe integers.");

/** SemVer precedence: numeric prerelease identifiers sort below words; build metadata is ignored. */
export function compareThemeVersions(a: string, b: string): number {
  const left = parseVersion(a), right = parseVersion(b);
  if (!left || !right) throw new Error("Cannot compare invalid theme versions.");
  for (let index = 0; index < 3; index++) if (left.core[index] !== right.core[index]) return left.core[index] < right.core[index] ? -1 : 1;
  if (!left.prerelease.length || !right.prerelease.length) return left.prerelease.length ? -1 : right.prerelease.length ? 1 : 0;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index++) {
    const l = left.prerelease[index], r = right.prerelease[index];
    if (l === r) continue;
    if (l === undefined || r === undefined) return l === undefined ? -1 : 1;
    const ln = /^\d+$/.test(l), rn = /^\d+$/.test(r);
    if (ln !== rn) return ln ? -1 : 1;
    if (ln && l.length !== r.length) return l.length < r.length ? -1 : 1;
    return l < r ? -1 : 1;
  }
  return 0;
}

type Comparator = { operator: string; version: string; parts: number };
function comparators(range: string): Comparator[] | null {
  if (range.length > 200 || !range.trim()) return null;
  const terms = range.trim().split(/\s+/);
  if (terms.length > 8) return null;
  const result: Comparator[] = [];
  for (const term of terms) {
    const match = /^(>=|<=|>|<|=)?(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?$/.exec(term);
    if (!match) return null;
    const core = match.slice(2).filter((value) => value !== undefined);
    const version = [...core, ...Array(3 - core.length).fill("0")].join(".");
    if (!parseVersion(version)) return null;
    result.push({ operator: match[1] ?? "=", version, parts: core.length });
  }
  return result;
}

const engineTerm = `(?:>=|<=|>|<|=)?${number}(?:\\.${number})?(?:\\.${number})?`;
const enginePattern = new RegExp(`^\\s*${engineTerm}(?:\\s+${engineTerm}){0,7}\\s*$`);
export const jellyEngineRangeSchema = z.string().max(200).regex(enginePattern, 'Use space-separated version comparisons such as ">=1 <2". Wildcards, ^, ~ and || are not supported.').refine((value) => value.length > 200 || !enginePattern.test(value) || comparators(value) !== null, "Range version numbers must be safe integers.");

/** Deliberately small, documented range grammar; invalid ranges fail closed. */
export function supportsJellyVersion(range: string | undefined, platformVersion = JELLY_THEME_API_VERSION): boolean {
  if (range === undefined) return true; // Legacy themes predate the API contract.
  const terms = comparators(range), platform = parseVersion(platformVersion);
  if (!terms || !platform || platform.prerelease.length) return false;
  return terms.every(({ operator, version, parts }) => {
    const comparison = compareThemeVersions(platformVersion, version);
    switch (operator) {
      case ">=": return comparison >= 0;
      case "<=": return comparison <= 0;
      case ">": return comparison > 0;
      case "<": return comparison < 0;
      default: return platform.core.slice(0, parts).join(".") === parseVersion(version)!.core.slice(0, parts).join(".");
    }
  });
}
