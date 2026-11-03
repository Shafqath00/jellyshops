import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { getBlockDefinition, getSectionDefinition, listSectionDefinitionsForPage, sectionLabel } from "@jelly/storefront-registry";
import type { BlockNode, PageType, SectionNode } from "@jelly/storefront-schema";
import { Fields, GroupedFields, fieldsFromControls, type Field } from "./controls";
import { registerThemeProject } from "@jelly/storefront-themes";
import { fetchProject, getAtPath, onProjectChanged, setAtPath, toTheme, type Project } from "./project";

type Starter = NonNullable<Project["starter"]>;
type Selection = { scope: "template"; index: number } | { scope: "global"; key: string };
const DEVICES = { Desktop: 1280, Tablet: 820, Phone: 390 } as const;
type Device = keyof typeof DEVICES;

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
const panel: React.CSSProperties = { font: "13px/1.4 system-ui, sans-serif", color: "#1c1b19" };
const button: React.CSSProperties = { padding: "4px 9px", border: "1px solid #cbd1d8", borderRadius: 6, background: "#fff", font: "inherit", fontSize: 12, cursor: "pointer" };

function settingFields(manifest: Project["manifest"]): Field[] {
  return (manifest.settingsSchema ?? []).map((setting) => ({ key: String(setting.id), label: String(setting.label), type: String(setting.type), description: setting.description as string | undefined, group: setting.group as string | undefined, options: setting.options as Field["options"], min: setting.min as number | undefined, max: setting.max as number | undefined, step: setting.step as number | undefined }));
}

function Shell() {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateKey, setTemplateKey] = useState("home");
  const [device, setDevice] = useState<Device>("Desktop");
  const [tab, setTab] = useState<"sections" | "theme">("sections");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [status, setStatus] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const load = () => fetchProject().then((next) => { setProject(next); setError(null); }, (problem: Error) => setError(problem.message));
    load();
    onProjectChanged(load);
  }, []);

  const send = useCallback((message: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(message, location.origin), []);
  useEffect(() => { if (project) send({ type: "jelly-project", project }); }, [project, send]);

  // Clicking a section in the preview selects it here.
  const starter = project?.starter ?? null;
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.data?.type !== "jelly-select" || !starter) return;
      const id = event.data.sectionId as string | undefined;
      const layout = starter.templates[templateKey]?.sections ?? [];
      const index = layout.findIndex((placement) => placement.kind === "inline" && placement.section.id === id);
      if (index !== -1) { setTab("sections"); setSelection({ scope: "template", index }); return; }
      const key = Object.keys(starter.globalSections).find((candidate) => starter.globalSections[candidate].id === id);
      if (key) { setTab("sections"); setSelection({ scope: "global", key }); }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [starter, templateKey]);

  // Tell the preview which section is selected so it can outline it.
  const placement = selection?.scope === "template" ? starter?.templates[templateKey]?.sections[selection.index] : undefined;
  const selectedId = selection?.scope === "global" ? starter?.globalSections[selection.key]?.id : placement?.kind === "inline" ? placement.section.id : undefined;
  useEffect(() => { send({ type: "jelly-select", sectionId: selectedId ?? null }); }, [selectedId, send]);

  const commit = useCallback((next: Project) => {
    setProject(next);
    setStatus("Saving…");
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      const response = await fetch("/__jelly/save", { method: "POST", body: JSON.stringify({ manifest: next.manifest, starter: next.starter }) });
      setStatus(response.ok ? "Saved to your theme folder" : "Could not save");
    }, 400);
  }, []);

  if (error) return <p style={{ ...panel, margin: 24 }} role="alert">{error}</p>;
  if (!project) return <p style={{ ...panel, margin: 24 }}>Loading…</p>;

  // The theme's own sections (recipes) are known here too, so the panel can offer and edit them.
  registerThemeProject(toTheme(project));
  const templates = Object.entries(project.starter?.templates ?? {});
  const template = project.starter?.templates[templateKey];
  const pageType = (template?.type ?? "home") as PageType;

  const editStarter = (change: (draft: Starter) => void) => {
    if (!project.starter) return;
    const draft = structuredClone(project.starter);
    change(draft);
    commit({ ...project, starter: draft });
  };
  const sectionFor = (draft: Starter, sel: Selection): SectionNode | undefined => {
    if (sel.scope === "global") return draft.globalSections[sel.key];
    const placement = draft.templates[templateKey]?.sections[sel.index];
    return placement?.kind === "inline" ? placement.section : undefined;
  };
  const selected = selection && project.starter ? sectionFor(project.starter, selection) : undefined;

  const move = (index: number, by: -1 | 1) => editStarter((draft) => {
    const list = draft.templates[templateKey].sections;
    const target = index + by;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setSelection({ scope: "template", index: target });
  });
  const remove = (index: number) => editStarter((draft) => { draft.templates[templateKey].sections.splice(index, 1); setSelection(null); });
  const add = (type: string) => {
    const definition = getSectionDefinition(type, project.manifest.version);
    if (!definition) return;
    editStarter((draft) => {
      const section: SectionNode = { id: uid(type), type, enabled: true, settings: structuredClone(definition.defaultSettings), blocks: structuredClone(definition.defaultBlocks).map((block) => ({ ...block, id: uid(block.type) })) };
      const list = draft.templates[templateKey].sections;
      // New sections go before the shared footer when the page ends with one.
      const last = list[list.length - 1];
      const at = last?.kind === "global" && /footer/i.test(last.globalSectionId) ? list.length - 1 : list.length;
      list.splice(at, 0, { kind: "inline", section });
      setSelection({ scope: "template", index: at });
    });
  };
  const patchSection = (change: (section: SectionNode) => void) => selection && editStarter((draft) => { const section = sectionFor(draft, selection); if (section) change(section); });

  const rows = (template?.sections ?? []).map((placement, index) => {
    if (placement.kind === "inline") return { index, section: placement.section, shared: false as const, selection: { scope: "template", index } as Selection };
    const key = Object.keys(project.starter?.globalSections ?? {}).find((candidate) => project.starter!.globalSections[candidate].id === placement.globalSectionId || candidate === placement.globalSectionId);
    return { index, section: key ? project.starter!.globalSections[key] : undefined, shared: true as const, selection: key ? ({ scope: "global", key } as Selection) : null };
  });
  const allowed = listSectionDefinitionsForPage(pageType, "template", project.manifest.id, project.manifest.version).filter((definition) => !["header", "footer", "announcement-bar"].includes(definition.type));

  return <div style={{ ...panel, display: "grid", gridTemplateColumns: "340px 1fr", height: "100vh", background: "#eef0f2" }}>
    <aside style={{ display: "flex", flexDirection: "column", background: "#fff", borderRight: "1px solid #dde1e5", minHeight: 0 }}>
      <header style={{ padding: 12, borderBottom: "1px solid #dde1e5" }}>
        <strong style={{ fontSize: 15 }}>{project.manifest.name}</strong>
        <div style={{ color: "#6b7580", fontSize: 12 }}>{status || "Edits are saved to theme.json and starter.json"}</div>
        <div role="tablist" style={{ display: "flex", gap: 4, marginTop: 10 }}>
          {(["sections", "theme"] as const).map((name) => <button key={name} role="tab" aria-selected={tab === name} onClick={() => setTab(name)} style={{ ...button, background: tab === name ? "#1c1b19" : "#fff", color: tab === name ? "#fff" : "#1c1b19" }}>{name === "sections" ? "Page sections" : "Theme settings"}</button>)}
        </div>
      </header>
      <div style={{ overflow: "auto", padding: 12, flex: 1 }}>
        {tab === "theme" && <GroupedFields fields={settingFields(project.manifest)} read={(key) => getAtPath(project.manifest.settingsDefaults ?? {}, key)} onChange={(key, value) => commit({ ...project, manifest: setAtPath(project.manifest, `settingsDefaults.${key}`, value) })} />}
        {tab === "sections" && !project.starter && <p>This theme has no starter.json yet, so there are no pages to edit.</p>}
        {tab === "sections" && project.starter && <>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 4 }} aria-label="Sections on this page">
            {rows.map((row) => <li key={row.index} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button disabled={!row.selection} onClick={() => row.selection && setSelection(row.selection)} aria-current={Boolean(selection) && JSON.stringify(selection) === JSON.stringify(row.selection)} style={{ ...button, flex: 1, textAlign: "left", opacity: row.section?.enabled === false ? 0.5 : 1, background: selection && JSON.stringify(selection) === JSON.stringify(row.selection) ? "#e8f0fe" : "#fff" }}>
                {row.section ? sectionLabel(row.section.type) : "Missing section"}{row.shared ? " (shared)" : ""}
              </button>
              {!row.shared && <>
                <button style={button} aria-label={`Move ${row.section?.type} up`} onClick={() => move(row.index, -1)}>↑</button>
                <button style={button} aria-label={`Move ${row.section?.type} down`} onClick={() => move(row.index, 1)}>↓</button>
                <button style={button} aria-label={`Remove ${row.section?.type}`} onClick={() => remove(row.index)}>✕</button>
              </>}
            </li>)}
          </ul>
          <select aria-label="Add a section" value="" onChange={(event) => event.target.value && add(event.target.value)} style={{ ...button, marginTop: 10, width: "100%" }}>
            <option value="">+ Add a section</option>
            {allowed.map((definition) => <option key={definition.type} value={definition.type}>{sectionLabel(definition.type)}</option>)}
          </select>
          {selected && selection && <section aria-label={`${sectionLabel(selected.type)} settings`} style={{ marginTop: 16, borderTop: "1px solid #dde1e5", paddingTop: 12 }}>
            <h2 style={{ fontSize: 14, margin: "0 0 8px" }}>{sectionLabel(selected.type)}</h2>
            <label style={{ display: "flex", gap: 6, marginBottom: 8 }}><input type="checkbox" checked={selected.enabled} onChange={(event) => patchSection((section) => { section.enabled = event.target.checked; })} /> Show this section</label>
            <GroupedFields
              fields={fieldsFromControls(getSectionDefinition(selected.type, project.manifest.version)?.controls ?? [])}
              read={(key) => selected.settings[key]}
              onChange={(key, value) => patchSection((section) => { if (value === undefined || value === "") delete section.settings[key]; else section.settings[key] = value; })}
            />
            {selected.blocks.map((block, blockIndex) => <details key={block.id} style={{ margin: "8px 0", border: "1px solid #dde1e5", borderRadius: 6, padding: "6px 8px" }}>
              <summary style={{ cursor: "pointer" }}>{block.type}{block.enabled === false ? " (hidden)" : ""}</summary>
              <div style={{ paddingTop: 8 }}>
                <label style={{ display: "flex", gap: 6, marginBottom: 8 }}><input type="checkbox" checked={block.enabled !== false} onChange={(event) => patchSection((section) => { section.blocks[blockIndex].enabled = event.target.checked; })} /> Show this block</label>
                <Fields
                  fields={fieldsFromControls(getBlockDefinition(block.type)?.controls ?? []).filter((field) => field.group === "content" || !field.group)}
                  read={(key) => block.settings[key]}
                  onChange={(key, value) => patchSection((section) => { const target = section.blocks[blockIndex] as BlockNode; if (value === undefined || value === "") delete target.settings[key]; else target.settings[key] = value; })}
                />
                <button style={{ ...button, marginTop: 8 }} onClick={() => patchSection((section) => { section.blocks.splice(blockIndex, 1); })}>Remove block</button>
              </div>
            </details>)}
          </section>}
        </>}
      </div>
    </aside>
    <main style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "8px 12px", background: "#fff", borderBottom: "1px solid #dde1e5", flexWrap: "wrap" }}>
        <label>Page <select aria-label="Page" value={templateKey} onChange={(event) => { setTemplateKey(event.target.value); setSelection(null); }} style={button}>
          {templates.map(([key, entry]) => <option key={key} value={key}>{key} ({entry.type})</option>)}
        </select></label>
        <div role="group" aria-label="Preview width" style={{ display: "flex", gap: 4 }}>
          {(Object.keys(DEVICES) as Device[]).map((name) => <button key={name} aria-pressed={device === name} onClick={() => setDevice(name)} style={{ ...button, background: device === name ? "#1c1b19" : "#fff", color: device === name ? "#fff" : "#1c1b19" }}>{name} · {DEVICES[name]}px</button>)}
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", justifyContent: "center" }}>
        <iframe ref={frame} title="Theme preview" src={`/frame.html?template=${encodeURIComponent(templateKey)}`} onLoad={() => send({ type: "jelly-project", project })} style={{ width: DEVICES[device], maxWidth: "100%", height: "100%", minHeight: 600, border: 0, background: "#fff", boxShadow: "0 1px 4px rgb(0 0 0 / 14%)" }} />
      </div>
    </main>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Shell /></StrictMode>);
