import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { loadProject } from "./project.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const previewRoot = join(root, "preview");
// The preview reads the platform's own storefront stylesheets (the same files the app loads).
const repositoryRoot = resolve(root, "..", "..");

const MIME = { ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".woff2": "font/woff2", ".woff": "font/woff", ".ico": "image/x-icon", ".css": "text/css" };

function json(response, status, body) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolveBody(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

/**
 * Starts the preview server for a theme folder.
 *
 *   GET  /__jelly/project   the current theme.json, starter.json and theme.css
 *   POST /__jelly/save      writes edited theme.json / starter.json back to the folder
 *   GET  /themes/<id>/...   files from the folder's assets/
 *
 * Edits made by hand in an editor are pushed to open pages as "jelly:project-changed".
 */
export async function dev(folder, flags = {}) {
  let project;
  try { project = loadProject(folder); } catch (error) { process.stderr.write(`${error.message}\n`); return 2; }
  const themeFiles = ["theme.json", "starter.json", "theme.css"].map((name) => join(project.directory, name));
  let ignoreChangesUntil = 0;

  const projectPlugin = {
    name: "jelly-theme-project",
    configureServer(server) {
      server.watcher.add(themeFiles);
      const announce = () => server.ws.send({ type: "custom", event: "jelly:project-changed" });
      server.watcher.on("change", (file) => {
        if (!themeFiles.includes(resolve(file)) || Date.now() < ignoreChangesUntil) return;
        announce();
      });
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://localhost");
        if (url.pathname === "/__jelly/project" && request.method === "GET") {
          try {
            const current = loadProject(project.directory);
            return json(response, 200, { manifest: current.manifest, starter: current.starter ?? null, css: current.css });
          } catch (error) { return json(response, 500, { error: error.message }); }
        }
        if (url.pathname === "/__jelly/save" && request.method === "POST") {
          try {
            const body = JSON.parse(await readBody(request));
            // Our own writes should not bounce back to the page as outside edits.
            ignoreChangesUntil = Date.now() + 1500;
            if (body.manifest) writeFileSync(join(project.directory, "theme.json"), `${JSON.stringify(body.manifest, null, 2)}\n`);
            if (body.starter) writeFileSync(join(project.directory, "starter.json"), `${JSON.stringify(body.starter, null, 2)}\n`);
            return json(response, 200, { ok: true });
          } catch (error) { return json(response, 400, { error: error.message }); }
        }
        const prefix = `/themes/${project.manifest.id}/`;
        if (url.pathname.startsWith(prefix)) {
          const relative = normalize(decodeURIComponent(url.pathname.slice(prefix.length)));
          const file = join(project.directory, "assets", relative);
          if (relative.startsWith("..") || !file.startsWith(join(project.directory, "assets")) || !existsSync(file) || !statSync(file).isFile()) { response.statusCode = 404; return response.end("Not found"); }
          response.setHeader("content-type", MIME[extname(file).toLowerCase()] ?? "application/octet-stream");
          return response.end(readFileSync(file));
        }
        next();
      });
    },
  };

  const port = Number.isFinite(flags.port) ? flags.port : 5273;
  const server = await createServer({
    root: previewRoot,
    configFile: false,
    logLevel: "warn",
    plugins: [projectPlugin],
    server: { port, strictPort: false, open: !flags["no-open"], fs: { allow: [repositoryRoot, root, resolve(root, "../../node_modules")] } },
    resolve: { alias: { "@theme-styles": join(repositoryRoot, "src", "app", "themes") } },
    define: { __JELLY_THEME_DIR__: JSON.stringify(project.directory.replaceAll("\\", "/")) },
  });
  await server.listen();
  server.printUrls();
  process.stdout.write(`\nPreviewing ${project.manifest.name} from ${project.directory}\nPress Ctrl+C to stop.\n`);
  await new Promise((done) => { process.on("SIGINT", done); process.on("SIGTERM", done); });
  await server.close();
  return 0;
}
