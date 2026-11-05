/**
 * `/themes/<theme id>/<file>`: the paths a theme's theme.json uses for its own files (preview
 * image, icons). Built-in themes keep theirs in `public/themes/`, which Next serves before this
 * route; an uploaded theme's files are fetched from the platform and passed through unchanged.
 * `?version=` pins a version of the theme.
 */
const api = () => (process.env.STOREFRONT_API_URL ?? process.env.NEXT_PUBLIC_STORE_EDITOR_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const themeIdPattern = /^[a-z][a-z0-9-]{1,62}$/;
const segmentPattern = /^[a-z0-9][a-z0-9._-]*$/;
const passed = ["content-type", "cache-control", "x-content-type-options", "content-security-policy"];

export async function GET(request: Request, { params }: { params: Promise<{ themeId: string; path: string[] }> }) {
  const { themeId, path } = await params;
  if (!themeIdPattern.test(themeId) || !path.length || path.some((segment) => !segmentPattern.test(segment) || segment.includes(".."))) {
    return new Response("Not found", { status: 404 });
  }
  const version = new URL(request.url).searchParams.get("version");
  const query = version && /^\d+\.\d+\.\d+$/.test(version) ? `?version=${version}` : "";
  try {
    const upstream = await fetch(`${api()}/api/public/themes/${themeId}/assets/${path.map(encodeURIComponent).join("/")}${query}`);
    if (!upstream.ok) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    for (const name of passed) { const value = upstream.headers.get(name); if (value) headers.set(name, value); }
    return new Response(await upstream.arrayBuffer(), { status: 200, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
