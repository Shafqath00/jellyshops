/// <reference types="vite/client" />
import type { DiscoveredTheme } from "@jelly/storefront-themes";

/** theme.json: the keys the preview reads, plus anything else the file holds. */
export type Manifest = Record<string, unknown> & { id: string; name: string; settingsDefaults?: Record<string, unknown>; settingsSchema?: Array<Record<string, unknown>> };

/** What the dev server reads from the theme folder. */
export interface Project {
  manifest: Manifest;
  starter: NonNullable<DiscoveredTheme["starter"]> | null;
  css: string;
}

export async function fetchProject(): Promise<Project> {
  const response = await fetch("/__jelly/project");
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "Could not read the theme folder.");
  return body as Project;
}

export function toTheme(project: Project): DiscoveredTheme {
  return { manifest: project.manifest, ...(project.starter ? { starter: project.starter } : {}) };
}

/** Calls `handler` whenever the theme files change on disk (for example from a text editor). */
export function onProjectChanged(handler: () => void): void {
  import.meta.hot?.on("jelly:project-changed", handler);
}

export function getAtPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => (value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined), source);
}

export function setAtPath<T extends Record<string, unknown>>(source: T, path: string, value: unknown): T {
  const copy = structuredClone(source) as Record<string, unknown>;
  const keys = path.split(".");
  let cursor: Record<string, unknown> = copy;
  keys.slice(0, -1).forEach((key) => { cursor = (cursor[key] && typeof cursor[key] === "object" ? cursor[key] : (cursor[key] = {})) as Record<string, unknown>; });
  cursor[keys[keys.length - 1]] = value;
  return copy as T;
}

/** A plain picture for the n-th sample product, drawn as an SVG so the preview works offline. */
export function placeholderImage(n: number): string {
  const hues = [200, 28, 150, 330, 260, 48];
  const hue = hues[(n - 1) % hues.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="hsl(${hue} 35% 88%)"/><circle cx="400" cy="440" r="170" fill="hsl(${hue} 35% 74%)"/><rect x="250" y="640" width="300" height="26" rx="13" fill="hsl(${hue} 30% 66%)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
