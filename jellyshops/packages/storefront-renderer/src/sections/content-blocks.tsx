import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import type { BlockNode } from "@jelly/storefront-schema";
import { childBlocks } from "@jelly/storefront-schema";
import { blockLabel } from "@jelly/storefront-registry/runtime";
import { resolveStorefrontHref, type StorefrontRuntimeContext } from "../runtime-context";
import { blockStyle } from "../block-style";
import { mediaPhoto } from "../media-photo";
import { blockEditorData, buttonProps } from "./block-content";
import { formattedSetting, inlineSetting, SettingText } from "./setting-text";
import { choice, imageValue, numberValue, stringValue } from "./shared";
import { StoreIcon } from "./store-icon";

/**
 * The shared content blocks, wave 1 (registry content-blocks.ts): subheading, section header, collapsible text,
 * grid, accordion, tabs, divider, spacer, icon, icon list, icon box, card, badge, counter and button group.
 * Markup only uses the documented `.jelly-*` part names; looks come from tokens in storefront-base.css, so every
 * theme gets them. Merchant values are checked before use (links go through the safe-link check).
 */

export interface ContentBlockOptions { context: StorefrontRuntimeContext; editor: boolean; selectedBlockId?: string }
type RenderChildren = (blocks: BlockNode[], options: ContentBlockOptions) => ReactNode[];

const ratios: Record<string, string> = { square: "1 / 1", portrait: "4 / 5", landscape: "4 / 3", wide: "16 / 9" };

/** Editor attributes for a block (empty on the live store). */
function editorData(block: BlockNode, options: ContentBlockOptions, field?: string) {
  return blockEditorData(block, options.editor, blockLabel(block.type), options.selectedBlockId, field);
}

/** Block style props for a block whose own layout (flex or grid) must survive Width "Fill". */
function containerStyle(block: BlockNode, extra: Record<string, string | number | undefined> = {}) {
  const own = blockStyle(block);
  const style = { ...own.style, display: undefined, ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value !== undefined)) } as CSSProperties;
  return { ...own, style };
}

/** A phone or tablet value of a number setting, as a CSS variable, when the merchant set one. */
function deviceNumber(block: BlockNode, key: string, variable: string, fallback: number, min: number, max: number, unit = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [device, suffix] of [["mobile", "m"], ["tablet", "t"]] as const) {
    const values = block.responsive?.[device];
    if (typeof values?.[key] === "number") result[`${variable}-${suffix}`] = `${numberValue(values, key, fallback, min, max)}${unit}`;
  }
  return result;
}

function deviceChoice<T extends string>(block: BlockNode, key: string, allowed: readonly T[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [device, attribute] of [["mobile", "data-layout-mobile"], ["tablet", "data-layout-tablet"]] as const) {
    const value = block.responsive?.[device]?.[key];
    if (typeof value === "string" && (allowed as readonly string[]).includes(value)) result[attribute] = value;
  }
  return result;
}

function linkHref(block: BlockNode, key: string, context: StorefrontRuntimeContext): string | undefined {
  return resolveStorefrontHref(block.settings[key], context.storeSlug) || undefined;
}

function Subheading({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const text = stringValue(block.settings, "text");
  if (!text) return null;
  return <p className="jelly-subheading" {...blockStyle(block)} {...editorData(block, options, "text")}>{text}</p>;
}

function SectionHeader({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const settings = block.settings;
  const heading = stringValue(settings, "heading");
  const eyebrow = stringValue(settings, "eyebrow");
  const text = stringValue(settings, "text");
  const label = stringValue(settings, "linkLabel");
  const href = linkHref(block, "link", options.context);
  const layout = choice(settings, "layout", ["vertical", "horizontal"] as const, "vertical");
  if (!heading && !text && !options.editor) return null;
  const aside = (text || (label && href)) ? <div className="jelly-header-block-aside">
    {text && <SettingText className="jelly-header-block-text" text={text} document={formattedSetting(settings, "text")} />}
    {label && href && <a className="jelly-header-block-link" href={href}>{label}</a>}
  </div> : null;
  return <div className="jelly-header-block" data-layout={layout} {...deviceChoice(block, "layout", ["vertical", "horizontal"] as const)} {...blockStyle(block)} {...editorData(block, options, "heading")}>
    <div className="jelly-header-block-main">
      {eyebrow && <p className="jelly-subheading">{eyebrow}</p>}
      {heading && <h2 className="jelly-header-block-heading">{inlineSetting(settings, "heading", heading)}</h2>}
    </div>
    {aside}
  </div>;
}

function CollapsibleText({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const title = stringValue(block.settings, "title");
  if (!title) return null;
  const text = stringValue(block.settings, "text");
  return <details className="jelly-collapsible" open={block.settings.startOpen === true || undefined} {...blockStyle(block)} {...editorData(block, options, "title")}>
    <summary className="jelly-collapsible-summary">{title}</summary>
    <div className="jelly-collapsible-body"><SettingText text={text} document={formattedSetting(block.settings, "text")} /></div>
  </details>;
}

function Grid({ block, options, renderChildren }: { block: BlockNode; options: ContentBlockOptions; renderChildren: RenderChildren }) {
  const items = renderChildren(childBlocks(block), options).filter(Boolean);
  if (items.length === 0 && !options.editor) return null;
  const columns = numberValue(block.settings, "columns", 3, 1, 6);
  const props = containerStyle(block, {
    "--grid-columns": columns,
    "--grid-gap": `${numberValue(block.settings, "gap", 24, 0, 80)}px`,
    ...deviceNumber(block, "columns", "--grid-columns", columns, 1, 6),
    ...deviceNumber(block, "gap", "--grid-gap", 24, 0, 80, "px"),
  });
  const align = choice(block.settings, "alignItems", ["start", "center", "stretch"] as const, "stretch");
  return <div className="jelly-block-grid" data-align-items={align} {...props} {...editorData(block, options)}>
    {items.length > 0 ? items : <span className="jelly-block-group-empty">Add blocks to this grid</span>}
  </div>;
}

function Accordion({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const name = useId();
  const rows = childBlocks(block).filter((row) => row.enabled && row.type === "accordion-row" && stringValue(row.settings, "title"));
  if (rows.length === 0 && !options.editor) return null;
  const exclusive = block.settings.oneAtATime === true;
  return <div className="jelly-accordion" {...blockStyle(block)} {...editorData(block, options)}>
    {rows.map((row, index) => <details key={row.id} className="jelly-accordion-row" open={(block.settings.openFirst !== false && index === 0) || undefined} {...(exclusive ? { name } : {})} {...editorData(row, options, "title")}>
      <summary className="jelly-accordion-summary">{stringValue(row.settings, "title")}</summary>
      <div className="jelly-accordion-body"><SettingText text={stringValue(row.settings, "text")} document={formattedSetting(row.settings, "text")} /></div>
    </details>)}
    {rows.length === 0 && <span className="jelly-block-group-empty">Add rows to this accordion</span>}
  </div>;
}

/** Tabs with the keyboard pattern screen readers expect: arrow keys, Home and End move between tabs. */
function Tabs({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const baseId = useId();
  const tabs = childBlocks(block).filter((item) => item.enabled && item.type === "tab" && stringValue(item.settings, "title"));
  const selectedIndex = Math.max(0, tabs.findIndex((item) => item.id === options.selectedBlockId));
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  if (tabs.length === 0) return options.editor ? <div className="jelly-tabs" {...editorData(block, options)}><span className="jelly-block-group-empty">Add tabs</span></div> : null;
  // In the editor the tab being edited is shown.
  const current = Math.min(options.editor && options.selectedBlockId && tabs.some((item) => item.id === options.selectedBlockId) ? selectedIndex : active, tabs.length - 1);
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = tabs.length - 1;
    const next = event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    setActive(next);
    buttons.current[next]?.focus();
  };
  const align = choice(block.settings, "tabAlign", ["start", "center"] as const, "start");
  return <div className="jelly-tabs" data-align={align} {...blockStyle(block)} {...editorData(block, options)}>
    <div className="jelly-tabs-list" role="tablist">
      {tabs.map((item, index) => <button
        key={item.id} type="button" role="tab" id={`${baseId}-tab-${index}`} aria-selected={index === current} aria-controls={`${baseId}-panel-${index}`}
        tabIndex={index === current ? 0 : -1} className="jelly-tabs-tab" ref={(element) => { buttons.current[index] = element; }}
        onClick={() => setActive(index)} onKeyDown={(event) => move(event, index)} {...editorData(item, options, "title")}
      >{stringValue(item.settings, "title")}</button>)}
    </div>
    {tabs.map((item, index) => <div key={item.id} role="tabpanel" id={`${baseId}-panel-${index}`} aria-labelledby={`${baseId}-tab-${index}`} hidden={index !== current} tabIndex={0} className="jelly-tabs-panel">
      <SettingText text={stringValue(item.settings, "text")} document={formattedSetting(item.settings, "text")} />
    </div>)}
  </div>;
}

function Divider({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const own = blockStyle(block);
  return <hr
    className="jelly-block-divider"
    data-line={choice(block.settings, "lineStyle", ["solid", "dashed", "dotted"] as const, "solid")}
    data-length={choice(block.settings, "length", ["full", "short"] as const, "full")}
    {...own}
    style={{ ...own.style, "--divider-thickness": `${numberValue(block.settings, "thickness", 1, 1, 8)}px` } as CSSProperties}
    {...editorData(block, options)}
  />;
}

function Spacer({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const own = blockStyle(block);
  const height = numberValue(block.settings, "height", 32, 0, 200);
  return <div className="jelly-block-spacer" aria-hidden="true" {...own} style={{ ...own.style, "--spacer-height": `${height}px`, ...deviceNumber(block, "height", "--spacer-height", height, 0, 200, "px") } as CSSProperties} {...editorData(block, options)} />;
}

function IconBlock({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const label = stringValue(block.settings, "label");
  const size = numberValue(block.settings, "size", 32, 16, 96);
  return <span className="jelly-block-icon" {...(label ? { role: "img", "aria-label": label } : {})} {...blockStyle(block)} {...editorData(block, options)}>
    <StoreIcon name={block.settings.icon} size={size} />
  </span>;
}

function IconList({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const items = childBlocks(block).filter((item) => item.enabled && item.type === "icon-list-item" && stringValue(item.settings, "text"));
  if (items.length === 0 && !options.editor) return null;
  const size = numberValue(block.settings, "iconSize", 20, 12, 48);
  return <ul className="jelly-icon-list" data-layout={choice(block.settings, "listLayout", ["vertical", "horizontal"] as const, "vertical")} {...deviceChoice(block, "listLayout", ["vertical", "horizontal"] as const)} {...blockStyle(block)} {...editorData(block, options)}>
    {items.map((item) => {
      const href = linkHref(item, "link", options.context);
      const content = <><StoreIcon name={item.settings.icon} size={size} /><span>{stringValue(item.settings, "text")}</span></>;
      return <li key={item.id} className="jelly-icon-list-item" {...editorData(item, options, "text")}>{href && !options.editor ? <a href={href}>{content}</a> : content}</li>;
    })}
    {items.length === 0 && <li className="jelly-block-group-empty">Add items to this list</li>}
  </ul>;
}

function IconBox({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const settings = block.settings;
  const heading = stringValue(settings, "heading");
  const text = stringValue(settings, "text");
  if (!heading && !text && !options.editor) return null;
  const label = stringValue(settings, "linkLabel");
  const href = linkHref(block, "link", options.context);
  return <div className="jelly-icon-box" data-layout={choice(settings, "boxLayout", ["stacked", "inline"] as const, "stacked")} data-style={choice(settings, "boxStyle", ["standard", "card"] as const, "standard")} {...blockStyle(block)} {...editorData(block, options, "heading")}>
    <span className="jelly-icon-box-icon"><StoreIcon name={settings.icon} size={28} /></span>
    <div className="jelly-icon-box-body">
      {heading && <h3 className="jelly-icon-box-heading">{heading}</h3>}
      {text && <SettingText className="jelly-icon-box-text" text={text} document={formattedSetting(settings, "text")} />}
      {label && href && <a className="jelly-icon-box-link" href={href}>{label}</a>}
    </div>
  </div>;
}

function Card({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const settings = block.settings;
  const image = imageValue(settings);
  const heading = stringValue(settings, "heading");
  const text = stringValue(settings, "text");
  const label = stringValue(settings, "linkLabel");
  const href = linkHref(block, "link", options.context);
  if (!heading && !text && !image && !options.editor) return null;
  const ratio = ratios[choice(settings, "imageRatio", ["square", "portrait", "landscape", "wide"] as const, "landscape")];
  return <article className="jelly-content-card" data-image-position={choice(settings, "imagePosition", ["top", "left"] as const, "top")} {...deviceChoice(block, "imagePosition", ["top", "left"] as const)} {...blockStyle(block)} {...editorData(block, options, "heading")}>
    {image
      // Merchant media is served by the store API, not as Next Image assets.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img className="jelly-content-card-media" src={image.url} alt={typeof image.alt === "string" ? image.alt : ""} loading="lazy" style={{ aspectRatio: ratio, objectPosition: `${image.focalPoint?.x ?? 50}% ${image.focalPoint?.y ?? 50}%` }} {...mediaPhoto(image.url, "(min-width: 768px) 33vw, 100vw")} />
      : options.editor ? <span className="jelly-content-card-media is-empty" style={{ aspectRatio: ratio }}>Choose an image</span> : null}
    <div className="jelly-content-card-body">
      {heading && <h3 className="jelly-content-card-heading">{href && !label ? <a href={href}>{heading}</a> : heading}</h3>}
      {text && <SettingText className="jelly-content-card-text" text={text} document={formattedSetting(settings, "text")} />}
      {label && href && <a className="jelly-content-card-link" href={href}>{label}</a>}
    </div>
  </article>;
}

function Badge({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const text = stringValue(block.settings, "text");
  if (!text) return null;
  return <span className="jelly-badge-block" data-shape={choice(block.settings, "shape", ["pill", "circle", "tag"] as const, "pill")} {...(block.settings.spin === true ? { "data-spin": "" } : {})} {...blockStyle(block)} {...editorData(block, options, "text")}>{text}</span>;
}

/** Up to two decimals (4.9); thousands are grouped from 10,000 so years (2016) stay as written. */
function formatCount(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2, useGrouping: value >= 10_000 }).format(value);
}
function Counter({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const raw = block.settings.value;
  const value = typeof raw === "number" && Number.isFinite(raw) ? Math.min(999_999_999, Math.max(0, raw)) : 0;
  const label = stringValue(block.settings, "label");
  return <div className="jelly-counter" {...blockStyle(block)} {...editorData(block, options, "label")}>
    <span className="jelly-counter-value">{stringValue(block.settings, "prefix")}{formatCount(value)}{stringValue(block.settings, "suffix")}</span>
    {label && <span className="jelly-counter-label">{label}</span>}
  </div>;
}

function ButtonGroup({ block, options }: { block: BlockNode; options: ContentBlockOptions }) {
  const buttons = childBlocks(block).filter((item) => item.enabled && item.type === "button" && stringValue(item.settings, "label"));
  if (buttons.length === 0 && !options.editor) return null;
  const align = choice(block.settings, "buttonAlign", ["", "start", "center", "end"] as const, "");
  return <div className="jelly-button-group" {...(align ? { "data-align": align } : {})} {...(block.settings.stackOnPhones === false ? {} : { "data-stack": "" })} {...containerStyle(block)} {...editorData(block, options)}>
    {buttons.map((item, index) => {
      const href = linkHref(item, "href", options.context);
      const props = buttonProps(item.settings, index, item.responsive?.mobile, item.responsive?.tablet);
      const text = stringValue(item.settings, "label");
      return href ? <a key={item.id} href={href} {...props} {...editorData(item, options, "label")}>{text}</a> : <span key={item.id} {...props} {...editorData(item, options, "label")}>{text}</span>;
    })}
    {buttons.length === 0 && <span className="jelly-block-group-empty">Add buttons</span>}
  </div>;
}

/** Draws a shared content block, or returns undefined when the type is not one of them. */
export function renderContentBlock(block: BlockNode, options: ContentBlockOptions, renderChildren: RenderChildren): ReactNode | undefined {
  const props = { block, options };
  switch (block.type) {
    case "subheading": return <Subheading key={block.id} {...props} />;
    case "section-header": return <SectionHeader key={block.id} {...props} />;
    case "collapsible-text": return <CollapsibleText key={block.id} {...props} />;
    case "grid": return <Grid key={block.id} {...props} renderChildren={renderChildren} />;
    case "accordion": return <Accordion key={block.id} {...props} />;
    case "tabs": return <Tabs key={block.id} {...props} />;
    case "divider": return <Divider key={block.id} {...props} />;
    case "spacer": return <Spacer key={block.id} {...props} />;
    case "icon": return <IconBlock key={block.id} {...props} />;
    case "icon-list": return <IconList key={block.id} {...props} />;
    case "icon-box": return <IconBox key={block.id} {...props} />;
    case "card": return <Card key={block.id} {...props} />;
    case "badge": return <Badge key={block.id} {...props} />;
    case "counter": return <Counter key={block.id} {...props} />;
    case "button-group": return <ButtonGroup key={block.id} {...props} />;
    default: return undefined;
  }
}
