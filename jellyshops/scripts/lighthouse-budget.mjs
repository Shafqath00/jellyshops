#!/usr/bin/env node
/**
 * Lighthouse budgets for a storefront (Phase 6 quality gate; Shopify's Theme Store asks for performance >= 60 and
 * accessibility >= 90, our roadmap asks for 80 and 95). Runs Lighthouse on a store's home, a collection and a product
 * page, on a phone and a desktop, and fails when the average of a category is under its budget.
 *
 *   node scripts/lighthouse-budget.mjs --base http://localhost:3000 --store resthaven-redesign-check \
 *     --collection beds --product harbour-upholstered-bed [--perf 80] [--a11y 95] [--out test-results]
 *
 * Measure speed on a production build (`next build && next start`) or a deployed store: `next dev` is unminified and
 * compiles on first visit, so its performance scores mean nothing (`--skip-perf` checks the other categories only).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : fallback; };
const base = option("base", "http://localhost:3000").replace(/\/$/, "");
const store = option("store");
const collection = option("collection");
const product = option("product");
const budgets = { performance: Number(option("perf", "80")), accessibility: Number(option("a11y", "95")) };
const skipPerf = args.includes("--skip-perf");
const out = option("out", "test-results");
if (!store) { console.error("Usage: node scripts/lighthouse-budget.mjs --store <slug> [--base URL] [--collection <slug>] [--product <slug>]"); process.exit(2); }

const pages = [["Home", `/${store}`], ...(collection ? [["Collection", `/${store}/collections/${collection}`]] : []), ...(product ? [["Product", `/${store}/products/${product}`]] : [])];
const categories = skipPerf ? ["accessibility", "best-practices", "seo"] : ["performance", "accessibility", "best-practices", "seo"];
const chrome = await chromeLauncher.launch({ chromeFlags: ["--headless=new", "--no-first-run"] });
const rows = [];
try {
  for (const formFactor of ["mobile", "desktop"]) {
    for (const [name, path] of pages) {
      // Warm the page once so a cold server compile is not measured.
      await fetch(base + path).catch(() => undefined);
      const result = await lighthouse(base + path, { port: chrome.port, output: "json", logLevel: "error", onlyCategories: categories }, {
        extends: "lighthouse:default",
        settings: formFactor === "desktop"
          ? { formFactor: "desktop", screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }, throttlingMethod: "simulate" }
          : { formFactor: "mobile", throttlingMethod: "simulate" },
      });
      const lhr = result.lhr;
      const score = (id) => lhr.categories[id] ? Math.round(lhr.categories[id].score * 100) : null;
      const failing = Object.values(lhr.audits).filter((audit) => audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode === "binary" && lhr.categories.accessibility?.auditRefs.some((ref) => ref.id === audit.id)).map((audit) => audit.id);
      rows.push({ page: name, formFactor, performance: score("performance"), accessibility: score("accessibility"), bestPractices: score("best-practices"), seo: score("seo"), lcp: lhr.audits["largest-contentful-paint"]?.displayValue ?? "", cls: lhr.audits["cumulative-layout-shift"]?.displayValue ?? "", failing });
      console.log(`${formFactor.padEnd(7)} ${name.padEnd(10)} perf ${score("performance") ?? "-"}  a11y ${score("accessibility")}  bp ${score("best-practices")}  seo ${score("seo")}  ${failing.length ? `a11y issues: ${failing.join(", ")}` : ""}`);
    }
  }
} finally {
  await chrome.kill();
}

const average = (key) => { const values = rows.map((row) => row[key]).filter((value) => typeof value === "number"); return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null; };
const results = { performance: skipPerf ? null : average("performance"), accessibility: average("accessibility") };
const misses = Object.entries(results).filter(([key, value]) => value !== null && value < budgets[key]).map(([key, value]) => `${key} ${value} < ${budgets[key]}`);
mkdirSync(out, { recursive: true });
const table = ["| Page | Device | Performance | Accessibility | Best practices | SEO | LCP | CLS | Accessibility issues |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.page} | ${row.formFactor} | ${row.performance ?? "-"} | ${row.accessibility} | ${row.bestPractices} | ${row.seo} | ${row.lcp} | ${row.cls} | ${row.failing.join(", ") || "none"} |`)];
writeFileSync(join(out, "lighthouse-report.md"), `# Lighthouse budgets: ${base}/${store}\n\nAverages: performance ${results.performance ?? "not measured"} (budget ${budgets.performance}), accessibility ${results.accessibility} (budget ${budgets.accessibility}).\n${misses.length ? `\n**Over budget:** ${misses.join("; ")}\n` : "\nAll budgets met.\n"}\n${table.join("\n")}\n`);
writeFileSync(join(out, "lighthouse-report.json"), JSON.stringify({ base, store, budgets, results, rows }, null, 2));
console.log(`\nAverages: performance ${results.performance ?? "not measured"}, accessibility ${results.accessibility}. ${misses.length ? `Over budget: ${misses.join("; ")}` : "All budgets met."}`);
process.exit(misses.length ? 1 : 0);
