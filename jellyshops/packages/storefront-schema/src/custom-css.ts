/**
 * Merchant-written CSS for one section, limited to that section.
 *
 * Every selector is prefixed with the section's scope (`h2` becomes
 * `[data-section-css="abc"] h2`; `&` or `:scope` is the section itself), so a
 * rule can never restyle the rest of the store. `@media`, `@supports` and
 * `@container` may wrap rules, `@keyframes` is namespaced to the section; anything that
 * could load or run something else (`@import`, `@font-face`, non-https `url()`,
 * `expression()`, `<`) makes the whole stylesheet invalid.
 */
export const MAX_SECTION_CSS_LENGTH = 2000;

const forbidden: Array<[RegExp, string]> = [
  [/</, "CSS can't contain the < character."],
  [/@(import|charset|namespace|font-face|page|layer|property)\b/i, "Only @media, @supports, @container and @keyframes rules are allowed."],
  [/expression\s*\(|javascript:|behavior\s*:|-moz-binding/i, "This CSS contains something that isn't allowed."],
  [/url\(\s*(?!['"]?https:\/\/)/i, "Images in url() must be https:// links."],
];
const wrappers = /^@(media|supports|container)\b/i;

type Parsed = { prelude: string; body: string };

/** Splits CSS into top-level `prelude { body }` pairs; null when braces don't match. */
function parseRules(css: string): Parsed[] | null {
  const rules: Parsed[] = [];
  let index = 0;
  while (index < css.length) {
    const open = css.indexOf("{", index);
    if (open === -1) return css.slice(index).trim() ? null : rules;
    if (css.slice(index, open).includes("}")) return null;
    let depth = 1;
    let cursor = open + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth++;
      else if (css[cursor] === "}") depth--;
      cursor++;
    }
    if (depth !== 0) return null;
    rules.push({ prelude: css.slice(index, open).trim(), body: css.slice(open + 1, cursor - 1) });
    index = cursor;
  }
  return rules;
}

/** Splits a selector list on commas that are not inside brackets, e.g. `:is(a, b)`. */
function splitSelectors(prelude: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < prelude.length; index++) {
    const char = prelude[index];
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) { parts.push(prelude.slice(start, index)); start = index + 1; }
  }
  parts.push(prelude.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

function scopeSelector(selector: string, scope: string): string {
  const own = selector.replace(/:scope\b/g, "&");
  return own.includes("&") ? own.replace(/&/g, scope) : `${scope} ${own}`;
}

/** Replace a selector scope wherever it occurs, while leaving quoted attribute values alone. */
function replaceSelectorScope(selector: string, previousScope: string, scope: string): string | null {
  let result = "";
  let quote: string | null = null;
  let found = false;
  for (let index = 0; index < selector.length;) {
    const char = selector[index];
    if (quote) {
      result += char;
      if (char === "\\") { result += selector[index + 1] ?? ""; index += 2; continue; }
      if (char === quote) quote = null;
      index++;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; result += char; index++; continue; }
    if (selector.startsWith(previousScope, index)) {
      result += scope;
      index += previousScope.length;
      found = true;
      continue;
    }
    result += char;
    index++;
  }
  return found ? result : null;
}

function scopeRules(css: string, scope: string, depth: number, previousScope?: string): string | null {
  const rules = parseRules(css);
  if (!rules) return null;
  const output: string[] = [];
  for (const { prelude, body } of rules) {
    if (!prelude) return null;
    if (wrappers.test(prelude)) {
      if (depth >= 2) return null;
      const inner = scopeRules(body, scope, depth + 1, previousScope);
      if (inner === null) return null;
      output.push(`${prelude}{${inner}}`);
    } else if (/^@keyframes\s+[\w-]+$/i.test(prelude)) {
      if (!parseRules(body)) return null;
      output.push(`${prelude}{${body.trim()}}`);
    } else if (prelude.startsWith("@") || body.includes("{")) {
      return null;
    } else {
      const selectors = splitSelectors(prelude).map((selector) => previousScope ? replaceSelectorScope(selector, previousScope, scope) : scopeSelector(selector, scope));
      if (selectors.some((selector) => selector === null)) return null;
      output.push(`${selectors.join(",")}{${body.trim()}}`);
    }
  }
  return output.join("\n");
}

function rewriteAnimationNames(body: string, names: Map<string, string>): string {
  return body.split(/(;)(?=(?:[^'"\\]|\\.|'[^']*'|"[^"]*")*$)/).map((part) => {
    if (part === ";") return part;
    const colon = part.indexOf(":");
    if (colon < 0 || !/^\s*animation(?:-name)?\s*$/i.test(part.slice(0, colon))) return part;
    const value = part.slice(colon + 1);
    let output = "";
    let quote: string | null = null;
    for (let offset = 0; offset < value.length;) {
      const char = value[offset];
      if (quote) {
        output += char;
        if (char === "\\") { output += value[offset + 1] ?? ""; offset += 2; continue; }
        if (char === quote) quote = null;
        offset++;
      } else if (char === "'" || char === '"') { quote = char; output += char; offset++; }
      else {
        const word = value.slice(offset).match(/^[\w-]+/)?.[0];
        if (word) { output += names.get(word) ?? word; offset += word.length; }
        else { output += char; offset++; }
      }
    }
    return part.slice(0, colon + 1) + output;
  }).join("");
}

function namespaceKeyframes(css: string, namespace: string): string {
  const rules = parseRules(css);
  if (!rules) return css;
  const names = new Map<string, string>();
  const collect = (items: Parsed[]) => items.forEach(({ prelude, body }) => {
    const keyframe = prelude.match(/^@keyframes\s+([\w-]+)$/i);
    if (keyframe) names.set(keyframe[1], `${keyframe[1]}-${namespace}`);
    else if (wrappers.test(prelude)) { const nested = parseRules(body); if (nested) collect(nested); }
  });
  collect(rules);
  if (!names.size) return css;
  const transform = (items: Parsed[]): string => items.map(({ prelude, body }) => {
    const keyframe = prelude.match(/^@keyframes\s+([\w-]+)$/i);
    const nested = parseRules(body);
    if (keyframe && nested) return `@keyframes ${names.get(keyframe[1])}{${transform(nested)}}`;
    if (wrappers.test(prelude) && nested) return `${prelude}{${transform(nested)}}`;
    if (nested) return `${prelude}{${transform(nested)}}`;
    return `${prelude}{${rewriteAnimationNames(body, names)}}`;
  }).join("\n");
  return transform(rules);
}

const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Why this CSS can't be used, in plain words, or null when it can. */
export function customCssProblem(css: string, maxLength = MAX_SECTION_CSS_LENGTH): string | null {
  if (css.length > maxLength) return `Custom CSS can be at most ${maxLength} characters.`;
  const clean = withoutComments(css);
  for (const [pattern, message] of forbidden) if (pattern.test(clean)) return message;
  return scopeRules(clean, "&", 0) === null ? "Check the CSS: every rule needs a selector and matching { }." : null;
}

/** The CSS limited to elements inside `scope` (a CSS selector), or null when it is empty or not allowed. */
export function scopeCustomCss(css: unknown, scope: string, maxLength = MAX_SECTION_CSS_LENGTH): string | null {
  if (typeof css !== "string" || !css.trim() || customCssProblem(css, maxLength)) return null;
  const scoped = scopeRules(withoutComments(css), scope, 0);
  return scoped ? namespaceKeyframes(scoped, scope.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "theme") : null;
}

/** Tighten a stylesheet already scoped by the platform, updating selectors and versioned keyframe names. */
export function rescopeCustomCss(css: string, previousScope: string, scope: string, maxLength = MAX_SECTION_CSS_LENGTH): string | null {
  if (!css.trim() || customCssProblem(css, maxLength)) return null;
  const rescoped = scopeRules(withoutComments(css), scope, 0, previousScope);
  return rescoped ? namespaceKeyframes(rescoped, scope.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "theme") : null;
}
