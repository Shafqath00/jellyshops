import { z } from "zod";
import { comparators, enginePattern, parseVersion, versionPattern } from "./theme-version-compare.js";

export { JELLY_THEME_API_VERSION, compareThemeVersions, supportsJellyVersion } from "./theme-version-compare.js";

export const themeVersionSchema = z.string().max(128).regex(versionPattern, "Use a semantic version such as 1.2.0 or 2.0.0-beta.1 (no leading zeroes).").refine((value) => value.length > 128 || !versionPattern.test(value) || parseVersion(value) !== null, "Version numbers must be safe integers.");

export const jellyEngineRangeSchema = z.string().max(200).regex(enginePattern, 'Use space-separated version comparisons such as ">=1 <2". Wildcards, ^, ~ and || are not supported.').refine((value) => value.length > 200 || !enginePattern.test(value) || comparators(value) !== null, "Range version numbers must be safe integers.");
