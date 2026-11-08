// Generates the machine-derived reference docs (file maps, function reference,
// API endpoints, dead-code report) from the real source with the TypeScript
// compiler API. Run from the repo root: node scripts/generate-docs.mjs
// Narrative docs (architecture, features, development) are written by hand.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ts = createRequire(path.join(root, "jellyshops", "package.json"))("typescript");
const norm = (p) => p.split(path.sep).join("/");
const rel = (p) => norm(path.relative(root, p));

const TARGETS = {
  backend: [path.join(root, "backend", "src")],
  frontend: [
    path.join(root, "jellyshops", "src"),
    ...["storefront-schema", "storefront-registry", "storefront-renderer", "storefront-themes", "storefront-ui"].map(
      (name) => path.join(root, "jellyshops", "packages", name, "src"),
    ),
  ],
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

const isTest = (file) => /\.test\.(ts|tsx)$/.test(file) || /[\\/](test|e2e)[\\/]/.test(file);

function resolveImport(from, spec, allFiles) {
  let base;
  if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else if (spec.startsWith("@/")) base = path.join(root, "jellyshops", "src", spec.slice(2));
  else if (spec.startsWith("@jelly/")) {
    const name = spec.slice("@jelly/".length).split("/")[0];
    base = path.join(root, "jellyshops", "packages", name, "src", "index");
  } else return null;
  const stripped = base.replace(/\.(js|jsx)$/, "");
  for (const candidate of [stripped, `${stripped}.ts`, `${stripped}.tsx`, path.join(stripped, "index.ts"), path.join(stripped, "index.tsx")]) {
    if (allFiles.has(candidate)) return candidate;
  }
  return null;
}

function leadingComment(source) {
  const match = source.match(/^\s*(?:\/\*\*?([\s\S]*?)\*\/|((?:\/\/[^\n]*\n)+))/);
  if (!match) return "";
  const text = (match[1] ?? match[2] ?? "").replace(/^\s*\*\s?/gm, "").replace(/^\/\/ ?/gm, "").trim();
  return text.split(/\n\s*\n/)[0].replace(/\s+/g, " ").trim();
}

function jsDoc(node, sourceFile) {
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) ?? [];
  const last = ranges[ranges.length - 1];
  if (!last) return "";
  const text = sourceFile.text.slice(last.pos, last.end);
  return text.replace(/^\/\*+|\*+\/$/g, "").replace(/^\s*\*\s?/gm, "").replace(/^\/\/ ?/gm, "").replace(/\s+/g, " ").trim();
}

function analyse(group) {
  const files = TARGETS[group].flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
  const all = new Set(files);
  const info = new Map();
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const rec = { file, lines: text.split("\n").length, imports: [], external: new Set(), exports: [], routes: [], purpose: leadingComment(text), sf, text, mounts: [] };
    const isExported = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const sig = (fn) => {
      const params = fn.parameters.map((p) => p.getText(sf).replace(/\s+/g, " ")).join(", ");
      const ret = fn.type ? `: ${fn.type.getText(sf).replace(/\s+/g, " ")}` : "";
      return `(${params})${ret}`;
    };
    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt) || (ts.isExportDeclaration(stmt) && stmt.moduleSpecifier)) {
        const spec = stmt.moduleSpecifier?.text;
        if (!spec) continue;
        const resolved = resolveImport(file, spec, all);
        if (resolved) rec.imports.push(resolved);
        else if (!spec.startsWith(".") && !spec.startsWith("@/")) rec.external.add(spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]);
        continue;
      }
      if (ts.isFunctionDeclaration(stmt) && stmt.name) {
        const isDefault = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
        if (isExported(stmt)) rec.exports.push({ kind: "function", name: isDefault ? `${stmt.name.text} (default)` : stmt.name.text, sig: sig(stmt), doc: jsDoc(stmt, sf), async: !!stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) });
      } else if (ts.isClassDeclaration(stmt) && stmt.name && isExported(stmt)) {
        const methods = stmt.members.filter((m) => ts.isMethodDeclaration(m) && m.name && !m.modifiers?.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword)).map((m) => `${m.name.getText(sf)}${sig(m)}`);
        rec.exports.push({ kind: "class", name: stmt.name.text, sig: "", doc: jsDoc(stmt, sf), methods });
      } else if (ts.isVariableStatement(stmt) && isExported(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          const name = decl.name.getText(sf);
          const init = decl.initializer;
          if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            rec.exports.push({ kind: /^[A-Z]/.test(name) && file.endsWith("x") ? "component" : "function", name, sig: sig(init), doc: jsDoc(stmt, sf), async: !!init.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) });
          } else rec.exports.push({ kind: "const", name, sig: decl.type ? `: ${decl.type.getText(sf)}` : "", doc: jsDoc(stmt, sf) });
        }
      } else if ((ts.isTypeAliasDeclaration(stmt) || ts.isInterfaceDeclaration(stmt)) && isExported(stmt)) {
        rec.exports.push({ kind: "type", name: stmt.name.text, sig: "", doc: "" });
      } else if (ts.isExportAssignment(stmt)) {
        rec.exports.push({ kind: "default", name: "default", sig: "", doc: "" });
      }
    }
    // Route registrations: <router|app>.<verb>("/path", ...handlers)
    const enclosing = (node) => {
      for (let n = node.parent; n; n = n.parent) {
        if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
        if (ts.isVariableDeclaration(n) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) return n.name.getText(sf);
      }
      return "";
    };
    rec.fnGuards = new Map();
    const visit = (node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "use" && node.expression.expression.getText(sf) === "router" && node.arguments.length === 1) {
        const fn = enclosing(node);
        const text = node.arguments[0].getText(sf).replace(/\s+/g, " ");
        if (/^(require|verify|rate|limit|auth)|Merchant|Customer|Limiter/.test(text)) {
          rec.fnGuards.set(fn, [...(rec.fnGuards.get(fn) ?? []), text.length > 70 ? text.slice(0, 67) + "..." : text]);
        }
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.arguments.length >= 3 && ts.isStringLiteral(node.arguments[0]) && /^(get|post|put|patch|delete)$/.test(node.arguments[0].text) && ts.isStringLiteral(node.arguments[1]) && node.arguments[1].text.startsWith("/")) {
        // Wrapper helper such as route('get', '/path', 'permission', handler) in merchant-order-routes.ts.
        const perm = node.arguments[2];
        rec.routes.push({ verb: node.arguments[0].text.toUpperCase(), path: node.arguments[1].text, middleware: ts.isStringLiteral(perm) ? [`requireStorePermission("${perm.text}")`] : [], line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1, fn: enclosing(node) });
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const verb = node.expression.name.text;
        const target = node.expression.expression.getText(sf);
        const firstArg = node.arguments[0];
        if (["get", "post", "put", "patch", "delete"].includes(verb) && /^(router|app)$/.test(target) && firstArg && (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg))) {
          const middleware = node.arguments.slice(1).map((a) => a.getText(sf).replace(/\s+/g, " ")).filter((t) => /^(require|verify|rate|limit|auth|raw|json|upload)/i.test(t) || /Permission|Merchant|Customer|Limiter/.test(t)).map((t) => t.length > 70 ? t.slice(0, 67) + "..." : t);
          const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          rec.routes.push({ verb: verb.toUpperCase(), path: firstArg.text, middleware, line, fn: enclosing(node) });
        }
        if (verb === "use" && target === "app" && node.arguments.length >= 2 && ts.isStringLiteral(node.arguments[0])) {
          const factory = node.arguments[1].getText(sf).match(/^(\w+)\(/);
          if (factory) rec.mounts.push({ prefix: node.arguments[0].text, factory: factory[1], line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    info.set(file, rec);
  }
  const importers = new Map(files.map((f) => [f, new Set()]));
  for (const rec of info.values()) for (const imp of rec.imports) importers.get(imp)?.add(rec.file);
  return { files, info, importers };
}

function tablesIn(text) {
  const found = new Set();
  for (const match of text.matchAll(/(?:FROM|JOIN|INTO|UPDATE|TABLE)\s+(?:public\.)?"([A-Z][A-Za-z]+)"/g)) found.add(match[1]);
  return [...found].sort();
}

const dirPurpose = {
  "backend/src/admin": "Platform-admin routes and bootstrap.",
  "backend/src/app": "Application dependency composition, shared defaults and middleware setup.",
  "backend/src/app/routes": "Ordered application route mounting for domain routers and direct endpoints.",
  "backend/src/audit": "Audit-event recording.",
  "backend/src/auth": "Authentication providers (Supabase/Firebase), session middleware, roles and store permissions.",
  "backend/src/catalog": "Products, variants, collections: types, validation, Postgres/memory repositories, merchant routes.",
  "backend/src/commerce": "Checkout, orders, payments intents, inventory, fulfilment, order management, notifications, digital delivery.",
  "backend/src/content": "Information pages and navigation menus.",
  "backend/src/custom-data": "Merchant-defined custom data definitions and values.",
  "backend/src/customers": "Customer accounts, addresses and engagement.",
  "backend/src/database": "Postgres pool and transaction helpers.",
  "backend/src/dynamic-sources": "Data sources for dynamic storefront content.",
  "backend/src/http": "HTTP helpers (errors, validation).",
  "backend/src/media": "Media upload, storage providers and asset records.",
  "backend/src/storefront": "Theme documents: draft workspace, compiler, publication, runtime snapshots, starter install.",
  "backend/src/stripe": "Stripe Connect accounts, payment client and webhook processing.",
  "backend/src/tenants": "Stores (tenants), memberships and onboarding.",
  "backend/src/commerce": "Checkout, orders, payment intents, inventory, fulfilment, order management, notifications, digital delivery.",
  "backend/src/stripe/accounts": "Stripe Connect connected-account lifecycle (create, onboarding link, status sync).",
  "backend/src/stripe/webhooks": "Stripe webhook routes (signature check) and the event processor.",
  "backend/src/storefront/compiler": "Compiles a draft workspace into a validated runtime snapshot (registry, binding, reference and context validation).",
  "backend/src/storefront/context": "Public page-context routes (page, blog, article, search data for the storefront).",
  "backend/src/storefront/publication": "Immutable publications and the active-publication pointer.",
  "backend/src/storefront/runtime": "Serves the published snapshot (with a process-local cache).",
  "backend/src/storefront/starter": "Installs starter packs into a store's draft.",
  "backend/src/storefront/workspace": "Mutable draft workspace: templates, global sections, menus, theme settings, assignments, optimistic concurrency.",
  "backend/src/storefront/workspace/repositories": "Workspace repository interfaces/adapters.",
  "jellyshops/src/app": "Next.js App Router: root layout, home, fonts, global CSS.",
  "jellyshops/src/app/admin": "Merchant admin pages.",
  "jellyshops/src/app/[storeSlug]": "Public storefront routes for one store.",
  "jellyshops/src/components": "Shared UI primitives and the deferred admin shell.",
  "jellyshops/src/components/ui": "shadcn-style UI primitives.",
  "jellyshops/src/components/jelly": "Storefront primitives used by theme markup.",
  "jellyshops/src/contexts": "React contexts (legacy shop state).",
  "jellyshops/src/lib": "Domain types/helpers, legacy local repository, product variant helpers, utilities.",
  "jellyshops/src/features/auth": "Merchant authentication (Supabase session, merchant/store loading) and auth components.",
  "jellyshops/src/features/admin": "Authenticated admin fetch helper, query hook and merchant shell components.",
  "jellyshops/src/features/commerce": "Order/payment API client and merchant/shopper commerce components.",
  "jellyshops/src/features/content": "Pages/blogs/metaobjects API and form components.",
  "jellyshops/src/features/customers": "Storefront customer session, wishlist, contact and newsletter UI.",
  "jellyshops/src/features/navigation": "Menu API and editor.",
  "jellyshops/src/features/store-editor": "Visual theme editor: model, state, API client, preview and inspector components.",
  "jellyshops/src/features/storefront": "Loading published storefront documents and page contexts; storefront page rendering and shell/cart components.",
  "jellyshops/src/features/theme-preview": "Store-less theme preview pages and sample data.",
  "jellyshops/packages/storefront-schema/src": "Zod schemas and types for storefront documents and snapshots.",
  "jellyshops/packages/storefront-registry/src": "Section/block registry, editor controls, starter packs, labels.",
  "jellyshops/packages/storefront-renderer/src": "Single storefront renderer for preview and live.",
  "jellyshops/packages/storefront-themes/src": "Theme definitions, token resolvers, fonts.",
  "jellyshops/packages/storefront-ui/src": "Small shared storefront components.",
};

const cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const header = (title, note) => `# ${title}\n\n> Generated by \`scripts/generate-docs.mjs\` from the source. Do not edit by hand; re-run the script.\n${note ? `\n${note}\n` : ""}\n`;
const write = (file, body) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), body.replace(/\r\n/g, "\n")); };

function inferPurpose(file, rec) {
  const name = path.basename(file);
  const names = rec.exports.filter((e) => e.kind !== "type").map((e) => e.name).slice(0, 4).join(", ");
  const tag = "(inferred from file name; no header comment)";
  const routeOf = norm(file).match(/src\/app\/(.*)\/(page|layout|route)\.tsx?$/);
  if (routeOf) return `Next.js ${routeOf[2]} for route "/${routeOf[1]}" ${tag}`;
  if (/^(page|layout|route|loading|error|not-found)\.tsx?$/.test(name)) return `Next.js ${name.split(".")[0]} for the root route ${tag}`;
  if (/routes?\.ts$/.test(name)) return `Express router factory${rec.routes.length ? ` registering ${rec.routes.length} route(s)` : ""}: ${names || "see routes"} ${tag}`;
  if (/service\.ts$/.test(name)) return `Application service (business rules): ${names} ${tag}`;
  if (/repository\.ts$|repositories?\.ts$/.test(name)) return `Data access layer${names ? `: ${names}` : " (interfaces/types only)"} ${tag}`;
  if (/^types?\.ts$|-types\.ts$/.test(name)) return `Type definitions ${tag}`;
  if (/^index\.ts$/.test(name)) return `Package/barrel entry point re-exporting its folder ${tag}`;
  if (/^use-|hook/.test(name)) return `React hook(s): ${names} ${tag}`;
  if (/\.tsx$/.test(name) && rec.exports.length) return `React component(s): ${names} ${tag}`;
  if (/api\.ts$|client\.ts$/.test(name)) return `API client / request helpers: ${names} ${tag}`;
  if (rec.exports.length) return `Exports ${names} ${tag}`;
  return "Module without exports (side-effect, config or entry point).";
}

function fileMap(group,{ files, info, importers }, title) {
  const groups = new Map();
  for (const f of files.sort()) {
    const dir = path.dirname(rel(f));
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir).push(f);
  }
  let out = header(title, "Tests are listed but only summarised (they have no exports). “Used by” lists non-test importers; “Tests” lists test files importing the file.");
  out += `${files.filter((f) => !isTest(f)).length} source files, ${files.filter(isTest).length} test files.\n\n`;
  for (const [dir, list] of groups) {
    out += `## \`${dir}/\`\n\n`;
    if (dirPurpose[dir]) out += `${dirPurpose[dir]}\n\n`;
    for (const f of list) {
      const rec = info.get(f);
      if (isTest(f)) { out += `- \`${path.basename(f)}\` — test (${rec.lines} lines)\n`; continue; }
      const users = [...importers.get(f)].filter((u) => !isTest(u)).map(rel).sort();
      const tests = [...importers.get(f)].filter(isTest).map((t) => path.basename(t));
      const tables = tablesIn(rec.text);
      out += `### \`${rel(f)}\`\n\n`;
      out += `- **Purpose:** ${rec.purpose || inferPurpose(f, rec)}\n`;
      out += `- **Size:** ${rec.lines} lines\n`;
      if (rec.exports.length) out += `- **Exports:** ${rec.exports.map((e) => `\`${e.name}\`${e.kind === "type" ? " (type)" : ""}`).join(", ")}\n`;
      const deps = [...new Set(rec.imports.filter((i) => !isTest(i)).map(rel))].sort();
      if (deps.length) out += `- **Imports (project):** ${deps.map((d) => `\`${d}\``).join(", ")}\n`;
      if (rec.external.size) out += `- **Imports (packages):** ${[...rec.external].sort().map((d) => `\`${d}\``).join(", ")}\n`;
      if (rec.routes.length) out += `- **Routes:** ${rec.routes.map((r) => `\`${r.verb} ${r.path}\``).join(", ")}\n`;
      if (tables.length) out += `- **Database tables referenced:** ${tables.map((t) => `\`${t}\``).join(", ")}\n`;
      out += `- **Used by:** ${users.length ? users.map((u) => `\`${u}\``).join(", ") : "nothing (entry point or unused)"}\n`;
      if (tests.length) out += `- **Tests:** ${tests.map((t) => `\`${t}\``).join(", ")}\n`;
      out += "\n";
    }
  }
  return out;
}

function functionRef(group, { files, info, importers }, title) {
  let out = header(title, "Signatures are taken from the TypeScript source; descriptions come from the JSDoc/comment directly above the declaration (blank when none exists). “Called from” lists non-test files that import the declaring file.");
  for (const f of files.sort()) {
    if (isTest(f)) continue;
    const rec = info.get(f);
    const callable = rec.exports.filter((e) => ["function", "component", "class"].includes(e.kind));
    if (!callable.length) continue;
    const users = [...importers.get(f)].filter((u) => !isTest(u)).map(rel).sort();
    out += `## \`${rel(f)}\`\n\n`;
    out += `Called from: ${users.length ? users.map((u) => `\`${u}\``).join(", ") : "—"}\n\n`;
    out += "| Name | Kind | Signature | Description |\n| --- | --- | --- | --- |\n";
    for (const e of callable) {
      if (e.kind === "class") {
        out += `| \`${e.name}\` | class | ${cell(e.methods.map((m) => `\`${m}\``).join("<br>"))} | ${cell(e.doc)} |\n`;
      } else out += `| \`${e.name}\` | ${e.kind}${e.async ? " (async)" : ""} | \`${cell(e.sig)}\` | ${cell(e.doc)} |\n`;
    }
    out += "\n";
  }
  return out;
}

function isAppRouteSource(file) {
  const relative = rel(file);
  return relative === "backend/src/app.ts" || /^backend\/src\/app\/routes\/[^/]+\.ts$/.test(relative);
}

function endpoints({ files, info }) {
  const factories = new Map();
  for (const f of files) {
    const rec = info.get(f);
    if (!rec.routes.length) continue;
    for (const e of rec.exports) factories.set(e.name, rec);
  }
  const rows = [];
  const mountedKeys = new Set();
  const seen = new Set();
  for (const f of files) {
    const rec = info.get(f);
    if (isTest(rec.file)) continue;
    for (const m of rec.mounts) {
      const target = factories.get(m.factory);
      if (!target) continue;
      for (const r of target.routes.filter((x) => x.fn === m.factory)) {
        mountedKeys.add(`${rel(target.file)}:${r.line}`);
        const full = (m.prefix + (r.path === "/" ? "" : r.path)).replace(/\/+/g, "/");
        const key = `${r.verb} ${full} ${rel(target.file)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ verb: r.verb, full, middleware: [...(target.fnGuards.get(m.factory) ?? []).map((g) => `router.use(${g})`), ...r.middleware], file: rel(target.file), line: r.line, mount: `${rel(rec.file)}:${m.line}` });
      }
    }
    if (isAppRouteSource(rec.file)) {
      for (const r of rec.routes) {
        const key = `${r.verb} ${r.path} app`;
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ verb: r.verb, full: r.path, middleware: r.middleware, file: rel(rec.file), line: r.line, mount: "direct" });
      }
    }
  }
  rows.sort((a, b) => a.full.localeCompare(b.full) || a.verb.localeCompare(b.verb));
  const unmounted = [...info.values()].map((r) => ({ ...r, routes: r.routes.filter((x) => !mountedKeys.has(`${rel(r.file)}:${x.line}`) && !isAppRouteSource(r.file)) })).filter((r) => r.routes.length && !/.test./.test(r.file));
  let out = header("API endpoints", "Routes are resolved statically: each `router.<verb>(path)` is joined to the prefix of the `app.use(prefix, createXRouter(...))` call that mounts it. Many mounts in the application composition modules are conditional on configuration (database, Stripe, auth provider); an endpoint exists only when its dependencies are configured. Authentication column shows the guard expressions found on the route; routers that apply a guard with `router.use` are noted in `docs/api/authentication.md`.");
  out += `${rows.length} endpoints.\n\n| Method | Path | Guards on route | Handler file | Mounted at |\n| --- | --- | --- | --- | --- |\n`;
  for (const r of rows) out += `| ${r.verb} | \`${r.full}\` | ${r.middleware.length ? r.middleware.map((m) => `\`${cell(m)}\``).join("<br>") : "—"} | \`${r.file}:${r.line}\` | \`${r.mount}\` |\n`;
  if (unmounted.length) {
    out += "\n## Route files whose mount point could not be resolved statically\n\n";
    for (const r of unmounted) out += `- \`${rel(r.file)}\`: ${r.routes.map((x) => `${x.verb} ${x.path}`).join(", ")}\n`;
  }
  return out;
}

function deadCode(be, fe) {
  let out = header("Dead-code and structure report", "Static findings only: nothing has been deleted. Each item needs a human check before removal (dynamic imports, framework conventions and external entry points are not visible to this scan).");
  const entry = /(\/page\.tsx|\/layout\.tsx|\/route\.ts|\/loading\.tsx|\/error\.tsx|\/not-found\.tsx|\/middleware\.ts|\/server\.ts|\/functions\.ts|\/index\.ts|\/instrumentation\.ts|\/global-error\.tsx|\/opengraph-image\.tsx|\/robots\.ts|\/sitemap\.ts)$/;
  for (const [name, data] of [["Backend", be], ["Frontend", fe]]) {
    const orphans = data.files.filter((f) => !isTest(f) && !entry.test(norm(f)) && ![...data.importers.get(f)].some((u) => !isTest(u)));
    out += `## ${name}: source files not imported by any other non-test source file\n\n`;
    out += orphans.length ? orphans.sort().map((f) => `- \`${rel(f)}\`${[...data.importers.get(f)].length ? " (only imported by tests)" : ""}`).join("\n") + "\n\n" : "None.\n\n";
    const usedNames = new Map();
    for (const f of data.files) for (const imp of data.info.get(f).text.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) usedNames.set(imp[1], (usedNames.get(imp[1]) ?? 0) + 1);
    const unusedExports = [];
    for (const f of data.files) {
      if (isTest(f) || entry.test(norm(f))) continue;
      for (const e of data.info.get(f).exports) {
        if (e.kind === "type" || e.name === "default" || e.name.includes("(default)")) continue;
        const nameRe = new RegExp(`\\b${e.name.replace(/\$/g, "\\$")}\\b`);
        const referenced = data.files.some((o) => o !== f && !isTest(o) && nameRe.test(data.info.get(o).text));
        const inOwn = (data.info.get(f).text.match(new RegExp(`\\b${e.name.replace(/\$/g, "\\$")}\\b`, "g")) ?? []).length > 1;
        if (!referenced) unusedExports.push(`${rel(f)} → \`${e.name}\`${inOwn ? " (used inside its own file; the `export` keyword may be unnecessary)" : " (not referenced anywhere else)"}`);
      }
    }
    out += `## ${name}: exported values/functions never referenced by another non-test file\n\n`;
    out += unusedExports.length ? unusedExports.map((u) => `- ${u}`).join("\n") + "\n\n" : "None.\n\n";
    const large = data.files.filter((f) => !isTest(f) && data.info.get(f).lines > 500).sort((a, b) => data.info.get(b).lines - data.info.get(a).lines);
    out += `## ${name}: files over 500 lines\n\n${large.map((f) => `- \`${rel(f)}\` — ${data.info.get(f).lines} lines`).join("\n") || "None."}\n\n`;
  }
  // Import cycles (Tarjan SCC) over non-test files.
  for (const [name, data] of [["Backend", be], ["Frontend", fe]]) {
    const nodes = data.files.filter((f) => !isTest(f));
    let index = 0; const stack = []; const idx = new Map(); const low = new Map(); const on = new Set(); const sccs = [];
    const strong = (v) => {
      idx.set(v, index); low.set(v, index); index++; stack.push(v); on.add(v);
      for (const w of data.info.get(v).imports.filter((i) => !isTest(i))) {
        if (!idx.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
      }
      if (low.get(v) === idx.get(v)) { const comp = []; let w; do { w = stack.pop(); on.delete(w); comp.push(w); } while (w !== v); if (comp.length > 1) sccs.push(comp); }
    };
    for (const v of nodes) if (!idx.has(v)) strong(v);
    out += `## ${name}: circular imports\n\n`;
    out += sccs.length ? sccs.map((c) => `- ${c.map((f) => `\`${rel(f)}\``).join(" ↔ ")}`).join("\n") + "\n\n" : "None found.\n\n";
  }
  // Duplicate exported names across files.
  for (const [name, data] of [["Backend", be], ["Frontend", fe]]) {
    const byName = new Map();
    for (const f of data.files) {
      if (isTest(f)) continue;
      for (const e of data.info.get(f).exports) {
        if (["type", "const", "default"].includes(e.kind) || e.name.includes("(default)")) continue;
        if (!byName.has(e.name)) byName.set(e.name, []);
        byName.get(e.name).push(rel(f));
      }
    }
    const dups = [...byName].filter(([, v]) => v.length > 1);
    out += `## ${name}: same function/component name exported from more than one file\n\n`;
    out += dups.length ? dups.map(([n, v]) => `- \`${n}\`: ${v.map((x) => `\`${x}\``).join(", ")}`).join("\n") + "\n\n" : "None.\n\n";
  }
  return out;
}

const be = analyse("backend");
const fe = analyse("frontend");
write("docs/file-structure/backend-file-map.md", fileMap("backend", be, "Backend file map"));
write("docs/file-structure/frontend-file-map.md", fileMap("frontend", fe, "Frontend file map"));
write("docs/functions/backend-functions.md", functionRef("backend", be, "Backend function reference"));
write("docs/functions/frontend-functions.md", functionRef("frontend", fe, "Frontend function reference"));
write("docs/api/endpoints.md", endpoints(be));
write("docs/reports/dead-code-and-structure.md", deadCode(be, fe));
console.log("backend files", be.files.length, "frontend files", fe.files.length);
