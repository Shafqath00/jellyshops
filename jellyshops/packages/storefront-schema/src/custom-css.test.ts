import { describe, expect, it } from "vitest";
import { customCssProblem, MAX_SECTION_CSS_LENGTH, rescopeCustomCss, scopeCustomCss } from "./custom-css";

const scope = '[data-section-css="hero-1"]';

describe("section custom CSS", () => {
  it("limits every selector to the section, including selector lists and :is()", () => {
    expect(scopeCustomCss("h2, .jelly-button:is(a, button) { color: red; }", scope))
      .toBe(`${scope} h2,${scope} .jelly-button:is(a, button){color: red;}`);
  });

  it("treats & and :scope as the section itself", () => {
    expect(scopeCustomCss("& { padding: 4px } :scope:hover img { opacity: .5 }", scope))
      .toBe(`${scope}{padding: 4px}\n${scope}:hover img{opacity: .5}`);
  });

  it("keeps @media, @supports and @keyframes, and drops comments", () => {
    const css = "/* phones */ @media (max-width: 767px) { p { font-size: 14px } } @keyframes pulse { from { opacity: 0 } to { opacity: 1 } }";
    expect(scopeCustomCss(css, scope)).toBe(`@media (max-width: 767px){${scope} p{font-size: 14px}}\n@keyframes pulse-data-section-css-hero-1{from{ opacity: 0 }\nto{ opacity: 1 }}`);
  });

  it.each([
    ["@import url(https://evil.test/a.css);", "Only @media"],
    ["@font-face { font-family: x; src: url(https://a.test/x.woff) }", "Only @media"],
    ["p { background: url(http://tracker.test/x.png) }", "https://"],
    ["p { background: url(javascript:alert(1)) }", "isn't allowed"],
    ["p { width: expression(alert(1)) }", "isn't allowed"],
    ["p { color: red } </style><script>alert(1)</script>", "<"],
    ["p { color: red", "matching { }"],
    ["color: red;", "matching { }"],
    ["p { a { color: red } }", "matching { }"],
    ["@media print { @media screen { @media all { p { color: red } } } }", "matching { }"],
  ])("rejects %s", (css, message) => {
    expect(customCssProblem(css)).toContain(message);
    expect(scopeCustomCss(css, scope)).toBeNull();
  });

  it("allows https images and rejects CSS over the length limit", () => {
    expect(customCssProblem("div { background: url('https://cdn.test/a.png') }")).toBeNull();
    expect(customCssProblem(`p{color:red}${" ".repeat(MAX_SECTION_CSS_LENGTH)}`)).toContain("at most");
  });

  it("returns null for empty or missing CSS", () => {
    expect(scopeCustomCss("   ", scope)).toBeNull();
    expect(scopeCustomCss(undefined, scope)).toBeNull();
  });

  it("resolves a previously scoped theme selector wherever it appears", () => {
    const oldScope = '[data-jelly-theme="demo"]';
    const newScope = `${oldScope}[data-jelly-theme-version="1.0.0"]`;
    const platformCss = scopeCustomCss(`.dark &{color:red}:is(&,.card){--selector:'${oldScope}'}`, oldScope)!;
    expect(rescopeCustomCss(platformCss, oldScope, newScope))
      .toBe(`.dark ${newScope}{color:red}\n:is(${newScope},.card){--selector:'${oldScope}'}`);
  });

  it("rejects a selector when it has no previous theme scope", () => {
    expect(rescopeCustomCss("body{color:red}", '[data-jelly-theme="demo"]', '[data-jelly-theme="demo"][data-jelly-theme-version="1"]')).toBeNull();
  });

  it("namespaces keyframes and their animation references per theme scope", () => {
    const css = "@keyframes pulse{to{opacity:1}} .card{animation:pulse 1s ease;animation-name:pulse}";
    expect(scopeCustomCss(css, '[data-jelly-theme="demo"][data-jelly-theme-version="1.0.0"]'))
      .toContain("@keyframes pulse-data-jelly-theme-demo-data-jelly-theme-version-1-0-0");
    expect(scopeCustomCss(css, '[data-jelly-theme="demo"][data-jelly-theme-version="1.0.0"]'))
      .toContain("animation:pulse-data-jelly-theme-demo-data-jelly-theme-version-1-0-0 1s ease");
  });
});
