// The live store loads these same files in this order, so spacing and sizes match.
import "@app-styles/globals.css";
import "@theme-styles/storefront-base.css";
import "./frame.css";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { RegistrySectionRenderer, type CommerceDataProvider } from "@jelly/storefront-renderer";
import type { RuntimeMenuV4, SectionNode } from "@jelly/storefront-schema";
import { scopeCustomCss } from "@jelly/storefront-schema";
import { cardLayoutAttribute, getStarterPack, registerThemeProject, resolveStorefrontThemeTokens, resolveTheme, legacyStylesAttribute, themeStyleId } from "@jelly/storefront-themes";
import { samplePageContext, sampleProducts } from "@jelly/theme-sdk/sample-data";
import { fetchProject, onProjectChanged, placeholderImage, toTheme, type Project } from "./project";

type Region = "header" | "template" | "footer";
type Entry = { region: Region; section: SectionNode };

const image = placeholderImage;
const products = sampleProducts({ image });
const commerce: CommerceDataProvider = { initialProducts: products, async getProducts(input) { return products.slice(0, input?.limit ?? products.length); } };

/** One storefront page, drawn by the same renderer as a live store. The shell sends the project and the selection. */
function Frame() {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const templateType = new URLSearchParams(location.search).get("template") ?? "home";

  useEffect(() => {
    const load = () => fetchProject().then(setProject, (problem: Error) => setError(problem.message));
    load();
    onProjectChanged(load);
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return;
      if (event.data?.type === "jelly-project") setProject(event.data.project);
      if (event.data?.type === "jelly-select") setSelected(event.data.sectionId ?? null);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);

  const view = useMemo(() => {
    if (!project) return null;
    try {
      registerThemeProject(toTheme(project));
      const id = project.manifest.id as string;
      const version = project.manifest.version as string;
      const pack = getStarterPack(id, version);
      const theme = resolveTheme(id, {}, version);
      const menus = Object.fromEntries(pack.menus.map((menu) => [menu.handle, { id: menu.key, handle: menu.handle, items: menu.items }])) as Record<string, RuntimeMenuV4>;
      const layout = pack.templates.find((template) => template.key === templateType)?.layout.sections ?? [];
      const entries = layout.flatMap((placement): Entry[] => {
        if (placement.kind === "inline") return [{ region: "template", section: placement.section }];
        const global = pack.globalSections.find((candidate) => candidate.section.id === placement.globalSectionId);
        if (!global) return [];
        const section = global.key === "header" || global.key === "footer" ? { ...global.section, settings: { storeName: project.manifest.name, ...global.section.settings } } as SectionNode : global.section;
        return [{ region: global.key === "footer" ? "footer" : "header", section }];
      });
      const type = pack.templates.find((template) => template.key === templateType)?.type ?? "home";
      return { id, version, menus, entries, type, style: resolveStorefrontThemeTokens(id, theme.settings, {}, version) };
    } catch (problem) {
      return { failure: (problem as Error).message };
    }
  }, [project, templateType]);

  if (error) return <p className="jelly-frame-message">{error}</p>;
  if (!project || !view) return <p className="jelly-frame-message">Loading…</p>;
  if ("failure" in view) return <p className="jelly-frame-message" role="alert">{view.failure}</p>;

  const page = samplePageContext(view.type, { image });
  const draw = ({ region, section }: Entry) => (
    <RegistrySectionRenderer
      key={section.id} section={section} mode="editor" commerce={commerce} region={region} themeId={view.id} themeVersion={view.version}
      page={page} menus={view.menus} storeSlug="preview"
      selected={selected === section.id ? { kind: "section", region, sectionId: section.id } : null}
      onSelect={(selection) => { setSelected(selection.sectionId ?? null); parent.postMessage({ type: "jelly-select", sectionId: selection.sectionId, blockId: selection.blockId }, location.origin); }}
    />
  );
  return <div className="theme-preview-viewport" data-jelly-theme={themeStyleId(view.id, view.version)} data-jelly-legacy-styles={legacyStylesAttribute(view.id, view.version)} data-jelly-theme-version={view.version} data-card-layout={cardLayoutAttribute(view.style)} style={view.style}>
    <style>{scopeCustomCss(project.css, `[data-jelly-theme="${view.id}"]`, 150_000) ?? ""}</style>
    <div className="jelly-storefront">
      {view.entries.filter((entry) => entry.region === "header").map(draw)}
      <main>{view.entries.filter((entry) => entry.region === "template").map(draw)}</main>
      {view.entries.filter((entry) => entry.region === "footer").map(draw)}
    </div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Frame /></StrictMode>);
