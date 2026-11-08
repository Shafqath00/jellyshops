#!/usr/bin/env node
/**
 * Compare a Jelly theme preview with a reference store, page by page, at the same screen widths.
 *
 *   node scripts/compare-reference.mjs --theme jelly-forma --reference https://example-store.com \
 *     [--preview http://localhost:3200] [--pages home=/,collection=/collections/all,product=/products/x]
 *     [--widths 1280,820,390] [--out test-results/reference-compare] [--delay 4000]
 *
 * For each page and width it saves a screenshot of both sides and measures the things that make a theme
 * look finished: header height and wrapped menu items, the main title (size and how far down it starts),
 * the hero (top and height), product cards per row and their width, the product page's buying column
 * (gaps between details, options and Add to cart), footer heading sizes and sideways scrolling.
 * It writes `report.md` (a side-by-side table with the differences that matter) and `measurements.json`.
 * The numbers are found by common class names, so on another platform's markup some rows can pick the wrong
 * element (a product carousel counted as "products per row"); read them next to the screenshots.
 *
 * Be a good guest on the reference site: pages load one at a time with a pause between them (--delay).
 * If the site answers with a bot check ("verify you are human", HTTP 429/403), the page is reported as
 * blocked and the tool moves on; it never tries to get past such checks. Measure that page by hand in a
 * normal browser instead, or pass the numbers in with --reference-json (same shape as measurements.json).
 *
 * Uses the installed Google Chrome through Playwright (`--browser-path` for another Chromium).
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const require = createRequire(resolve("jellyshops/package.json"));
const { chromium } = require("playwright");

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => {
  if (arg.startsWith("--")) pairs.push([arg.slice(2), all[index + 1]?.startsWith("--") || all[index + 1] === undefined ? "true" : all[index + 1]]);
  return pairs;
}, []));
if (!args.theme || (!args.reference && !args["reference-json"])) {
  console.error("Usage: node scripts/compare-reference.mjs --theme <theme-preview-path> --reference <https://store> [options]");
  process.exit(1);
}
const preview = (args.preview ?? "http://localhost:3200").replace(/\/$/, "");
const reference = args.reference?.replace(/\/$/, "");
const widths = (args.widths ?? "1280,820,390").split(",").map(Number);
// Git Bash turns an argument like "/" into a Windows folder path; keep only the site path in that case.
const sitePath = (value = "") => { const path = value.replace(/^[A-Za-z]:\/.*?\/Git(?=\/|$)/, ""); return path.startsWith("/") ? path : `/${path}`; };
const pages = Object.fromEntries((args.pages ?? "home=/,collection=/collections/all,search=/search?q=a").split(",").map((pair) => { const [name, ...rest] = pair.split("="); return [name, sitePath(rest.join("="))]; }));
const previewTabs = { home: "Home", collection: "Collection", product: "Product", cart: "Cart", search: "Search", page: "Page", "404": "404" };
const out = resolve(args.out ?? "jellyshops/test-results/reference-compare");
const delay = Number(args.delay ?? 4000);
mkdirSync(out, { recursive: true });

/** Runs inside the page (or the preview frame); must stay self-contained. */
function measure() {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none"; };
  const px = (v) => Math.round(v);
  const lines = (el) => { const range = document.createRange(); range.selectNodeContents(el); const tops = []; for (const b of range.getClientRects()) { if (b.width < 2 || b.height < 4) continue; if (!tops.some((t) => Math.abs(t - b.top) < b.height / 2)) tops.push(b.top); } return tops.length; };
  const header = [...document.querySelectorAll("header, .jelly-header, [id*=header i]")].find(vis);
  const headerRect = header?.getBoundingClientRect();
  const navLinks = header ? [...header.querySelectorAll("nav a, nav summary, nav button")].filter((el) => vis(el) && !el.closest(".jelly-header-tools, .jelly-mobile-navigation, [class*=drawer i], [class*=icons i], [class*=tools i], [aria-hidden=true]") && el.textContent.trim()) : [];
  const title = [...document.querySelectorAll("main h1, h1")].find(vis);
  const hero = [...document.querySelectorAll(".jelly-hero, [class*=hero i], [class*=slideshow i], [class*=banner i]")].find((el) => vis(el) && el.getBoundingClientRect().height > 200 && el.getBoundingClientRect().height < innerHeight * 1.2);
  const cards = [...document.querySelectorAll(".jelly-product-card, [class*=product-card i], .card-product, product-card, .product-item")].filter((el) => vis(el) && !el.parentElement.closest(".jelly-product-card, [class*=product-card i]"));
  const firstRowTop = cards.length ? Math.round(cards[0].getBoundingClientRect().top) : null;
  const row = cards.filter((card) => Math.abs(card.getBoundingClientRect().top - firstRowTop) < 4);
  const buying = [".jelly-product-information", ".jelly-product-options", ".jelly-product-purchase"].map((s) => document.querySelector(s)).filter(Boolean).map((el) => el.getBoundingClientRect());
  const footer = [...document.querySelectorAll("footer, .jelly-footer")].find(vis);
  const footerHeadings = footer ? [...footer.querySelectorAll("h2, h3, h4, [class*=heading i]")].filter(vis).map((h) => px(parseFloat(getComputedStyle(h).fontSize))) : [];
  const blocked = /verify|just a moment|are you (a )?human|captcha/i.test(document.title + " " + (document.body?.innerText ?? "").slice(0, 300));
  return {
    width: innerWidth,
    blocked,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    headerHeight: headerRect ? px(headerRect.height) : null,
    wrappedNav: navLinks.filter((el) => lines(el) > 1).length,
    titleSize: title ? px(parseFloat(getComputedStyle(title).fontSize)) : null,
    titleTop: title ? px(title.getBoundingClientRect().top + scrollY) : null,
    heroTop: hero ? px(hero.getBoundingClientRect().top + scrollY) : null,
    heroHeight: hero ? px(hero.getBoundingClientRect().height) : null,
    cardsPerRow: row.length || null,
    cardWidth: row.length ? px(row[0].getBoundingClientRect().width) : null,
    buyingGaps: buying.slice(1).map((r, i) => px(r.top - buying[i].bottom)),
    footerHeadingMax: footerHeadings.length ? Math.max(...footerHeadings) : null,
  };
}

const browser = await chromium.launch(args["browser-path"] ? { executablePath: args["browser-path"] } : { channel: "chrome" });
const results = { reference: {}, theme: {} };
if (args["reference-json"]) results.reference = JSON.parse(readFileSync(args["reference-json"], "utf8")).reference ?? {};

// Reference site: one page at a time, real page loads, a pause between them.
if (reference) {
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    for (const [name, path] of Object.entries(pages)) {
      const key = `${name}@${width}`;
      try {
        const response = await page.goto(reference + path, { waitUntil: "load", timeout: 60000 });
        await page.waitForTimeout(1500);
        const data = await page.evaluate(measure);
        if (response && [403, 429].includes(response.status())) data.blocked = true;
        results.reference[key] = data;
        if (!data.blocked) await page.screenshot({ path: join(out, `reference-${name}-${width}.png`), fullPage: true });
        console.log(`reference ${key}${data.blocked ? " BLOCKED (bot check; measure this page by hand)" : ""}`);
      } catch (error) { results.reference[key] = { error: String(error) }; console.log(`reference ${key} failed: ${error}`); }
      await page.waitForTimeout(delay);
    }
  }
  await context.close();
}

// Theme preview: each page tab at each width (the preview frame is set to the width, so media queries match).
{
  const page = await (await browser.newContext({ viewport: { width: Math.max(...widths) + 200, height: 1000 } })).newPage();
  await page.goto(`${preview}/theme-preview/${args.theme}`, { waitUntil: "networkidle", timeout: 120000 });
  for (const width of widths) {
    await page.locator("iframe").evaluate((el, w) => { el.parentElement.style.width = `${w}px`; el.style.width = `${w}px`; }, width);
    for (const name of Object.keys(pages)) {
      const tab = previewTabs[name];
      if (!tab) continue;
      await page.getByRole("button", { name: tab, exact: true }).click();
      await page.waitForTimeout(1200);
      const frame = await (await page.waitForSelector("iframe")).contentFrame();
      results.theme[`${name}@${width}`] = await frame.evaluate(measure);
      const height = results.theme[`${name}@${width}`] ? await frame.evaluate(() => document.documentElement.scrollHeight) : 900;
      const iframe = await page.$("iframe");
      await iframe.evaluate((el, h) => { el.style.height = `${h}px`; }, height);
      await page.waitForTimeout(300);
      await iframe.screenshot({ path: join(out, `theme-${name}-${width}.png`) });
      await iframe.evaluate((el) => { el.style.height = ""; });
    }
  }
}
await browser.close();
writeFileSync(join(out, "measurements.json"), JSON.stringify(results, null, 1));

// Report: one table per page; rows where the two sides differ noticeably are marked.
const labels = { headerHeight: "Header height (px)", wrappedNav: "Menu items on 2+ lines", titleSize: "Main title size (px)", titleTop: "Main title starts at (px)", heroTop: "Hero starts at (px)", heroHeight: "Hero height (px)", cardsPerRow: "Products per row", cardWidth: "Product card width (px)", buyingGaps: "Product details → options → Add to cart gaps (px)", footerHeadingMax: "Largest footer heading (px)", overflow: "Sideways scroll (px)" };
const differs = (a, b) => {
  if (a == null || b == null) return a !== b;
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a) !== JSON.stringify(b) && Math.max(0, ...[].concat(a ?? [])) > Math.max(24, ...[].concat(b ?? [])) + 8;
  return Math.abs(a - b) > Math.max(8, Math.abs(b) * 0.15);
};
const lines = [`# ${args.theme} compared with ${reference ?? "the supplied reference"}`, "", `Widths ${widths.join(", ")}px. Screenshots and measurements.json are in this folder. ⚠ marks a difference of more than 15% (or 8px).`, ""];
for (const name of Object.keys(pages)) {
  lines.push(`## ${name}`, "", `| Measure | ${widths.map((w) => `Reference ${w}`).join(" | ")} | ${widths.map((w) => `Theme ${w}`).join(" | ")} |`, `| --- |${" --- |".repeat(widths.length * 2)}`);
  for (const [key, label] of Object.entries(labels)) {
    const ref = widths.map((w) => results.reference[`${name}@${w}`]);
    const ours = widths.map((w) => results.theme[`${name}@${w}`]);
    const cell = (data) => data?.blocked ? "blocked" : data?.error ? "error" : JSON.stringify(data?.[key] ?? "–");
    const marks = widths.map((w, i) => ours[i] && ref[i] && !ref[i].blocked && !ref[i].error && differs(ours[i][key], ref[i][key]) ? " ⚠" : "");
    lines.push(`| ${label} | ${ref.map(cell).join(" | ")} | ${ours.map((data, i) => cell(data) + marks[i]).join(" | ")} |`);
  }
  lines.push("");
}
writeFileSync(join(out, "report.md"), lines.join("\n"));
console.log(`Wrote ${join(out, "report.md")}`);
