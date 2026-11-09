import { titleLength } from "./shared";
import { StorefrontContainer } from "@jelly/storefront-ui";
import { elementProps } from "../element-style";
import { useEffect, useState, type CSSProperties } from "react";
import type { SectionNode } from "@jelly/storefront-schema";
import type { PublicMetaobjectList, RendererMode } from "../types";
import type { StorefrontRuntimeContext } from "../runtime-context";
import { numberValue, sectionData, stringValue } from "./shared";

type Entry = PublicMetaobjectList["entries"][number];
type Field = PublicMetaobjectList["definition"]["fields"][number];

/** The page of one entry: /<store>/pages/<metaobject>/<entry>. */
export function metaobjectEntryHref(storeSlug: string | undefined, definitionHandle: string, entryHandle: string): string {
  const path = `/pages/${encodeURIComponent(definitionHandle)}/${encodeURIComponent(entryHandle)}`;
  return storeSlug ? `/${encodeURIComponent(storeSlug)}${path}` : path;
}

function firstImage(fields: Field[], entry: Entry): string | null {
  const field = fields.find((item) => item.type === "image" && typeof entry.values[item.handle] === "string");
  return field ? String(entry.values[field.handle]) : null;
}

/** One field's value as text, a link or a colour swatch (images are shown separately). */
function FieldValue({ field, value }: { field: Field; value: string | number | boolean }) {
  if (field.type === "url" && typeof value === "string") return <a href={value} rel="noopener noreferrer" target="_blank">{value.replace(/^https?:\/\//, "")}</a>;
  if (field.type === "boolean") return <>{value ? "Yes" : "No"}</>;
  if (field.type === "color" && typeof value === "string") return <span className="jelly-metaobject-swatch" style={{ "--swatch": value } as CSSProperties}>{value}</span>;
  return <>{String(value)}</>;
}

/** The entry's details (every visible field except images) as a definition list. */
export function MetaobjectFields({ fields, entry }: { fields: Field[]; entry: Entry }) {
  const shown = fields.filter((field) => field.type !== "image" && entry.values[field.handle] !== undefined && entry.values[field.handle] !== "");
  if (!shown.length) return null;
  return <dl className="jelly-metaobject-fields">{shown.map((field) => <div key={field.handle}><dt>{field.name}</dt><dd><FieldValue field={field} value={entry.values[field.handle]} /></dd></div>)}</dl>;
}

/**
 * Entries of one metaobject as cards (grid) or rows (list). Hidden on the live
 * store when the metaobject is missing, not visible on the storefront or empty.
 */
export function MetaobjectListSection({ section, context, mode = "published" }: { section: SectionNode; context: StorefrontRuntimeContext; mode?: RendererMode }) {
  const handle = stringValue(section.settings, "metaobject").trim();
  const getMetaobjects = context.commerce.getMetaobjects;
  const [state, setState] = useState<{ handle: string; list: PublicMetaobjectList | null } | null>(null);
  useEffect(() => {
    if (!handle || !getMetaobjects) return;
    let active = true;
    void getMetaobjects(handle).then((list) => { if (active) setState({ handle, list }); }, () => { if (active) setState({ handle, list: null }); });
    return () => { active = false; };
  }, [handle, getMetaobjects]);
  const list = state?.handle === handle ? state.list : null;
  const limit = numberValue(section.settings, "limit", 12, 1, 48);
  const entries = list?.entries.slice(0, limit) ?? [];
  const editor = mode !== "published";
  if (!entries.length && !editor) return null;
  const heading = stringValue(section.settings, "heading").trim();
  const layout = section.settings.layout === "list" ? "list" : "grid";
  const columns = numberValue(section.settings, "columns", 3, 1, 4);
  const showFields = section.settings.showFields !== false;
  const linked = section.settings.linkToPages !== false;
  const hint = !handle ? "Enter the handle of a metaobject from Content > Metaobjects."
    : !state || state.handle !== handle ? "Loading entries…"
    : !list ? `No metaobject "${handle}" is visible on your storefront. Check its handle and turn on "Visible on storefront".`
    : "This metaobject has no entries yet.";
  return <section className="jelly-section jelly-metaobject-list" {...sectionData(section, { "data-layout": layout })} style={{ "--metaobject-columns": columns } as CSSProperties}><StorefrontContainer>
    {heading && <h2 className="jelly-metaobject-list-heading" {...elementProps(section, "heading", mode === "editor")}>{heading}</h2>}
    {entries.length && list
      ? <ul className="jelly-metaobject-items">{entries.map((entry) => {
          const image = firstImage(list.definition.fields, entry);
          const title = linked ? <a href={metaobjectEntryHref(context.storeSlug, list.definition.handle, entry.handle)}>{entry.displayName}</a> : entry.displayName;
          return <li key={entry.handle} className="jelly-metaobject-card">
            {/* Merchant media URLs may be served by the local API and are not Next Image assets. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {image && <img src={image} alt="" loading="lazy" />}
            <div className="jelly-metaobject-card-body"><h3>{title}</h3>{showFields && <MetaobjectFields fields={list.definition.fields} entry={entry} />}</div>
          </li>;
        })}</ul>
      : <p className="jelly-editor-hint">{hint}</p>}
  </StorefrontContainer></section>;
}

/** The main content of an entry's own page. */
export function MetaobjectEntryContent({ definition, entry, storeSlug }: { definition: PublicMetaobjectList["definition"]; entry: Entry; storeSlug?: string }) {
  const image = firstImage(definition.fields, entry);
  return <article className="jelly-section jelly-metaobject-entry"><StorefrontContainer>
    <nav className="jelly-metaobject-entry-trail" aria-label="Breadcrumb"><a href={storeSlug ? `/${encodeURIComponent(storeSlug)}` : "/"}>Home</a><span aria-hidden="true">/</span><span>{definition.name}</span></nav>
    <div className="jelly-metaobject-entry-layout">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {image && <img src={image} alt={entry.displayName} />}
      <div><h1 {...titleLength(entry.displayName)}>{entry.displayName}</h1><MetaobjectFields fields={definition.fields} entry={entry} /></div>
    </div>
  </StorefrontContainer></article>;
}
