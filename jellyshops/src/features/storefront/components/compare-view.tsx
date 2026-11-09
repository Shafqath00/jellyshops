"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { compareRows, type CompareItem } from "../compare-table";

/**
 * The compare tray: the ticked products with a remove button each, and the way to the compare page from two products
 * up. Its height is written to `--jelly-compare-tray-height` so the product page's sticky buy bar sits above it and
 * the page can scroll past it.
 */
export function CompareTrayView({ items, max, compareHref, onRemove, onClear, onOpen }: { items: CompareItem[]; max: number; compareHref: string; onRemove(id: string): void; onClear(): void; /** Opens the compare page in place of following the link (theme preview). */ onOpen?: () => void }) {
  const tray = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = tray.current;
    if (!element) return;
    const root = element.ownerDocument.documentElement;
    const update = () => root.style.setProperty("--jelly-compare-tray-height", `${element.offsetHeight}px`);
    update();
    const View = element.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    const observer = View && "ResizeObserver" in View ? new View.ResizeObserver(update) : null;
    observer?.observe(element);
    return () => { observer?.disconnect(); root.style.removeProperty("--jelly-compare-tray-height"); };
  }, [items.length]);
  if (!items.length) return null;
  return <section ref={tray} className="jelly-compare-tray" aria-label="Products to compare">
    <div className="jelly-compare-tray-inner">
      <p className="jelly-compare-tray-count">Compare <span>{items.length}/{max}</span></p>
      <ul className="jelly-compare-tray-items">
        {items.map((item) => <li key={item.id}>
          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span className="jelly-compare-tray-placeholder" aria-hidden="true" />}
          <span className="jelly-compare-tray-name">{item.name}</span>
          <button type="button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name} from compare`}>×</button>
        </li>)}
      </ul>
      <div className="jelly-compare-tray-actions">
        <button type="button" className="jelly-compare-tray-clear" onClick={onClear}>Clear</button>
        {items.length >= 2
          ? <a className="jelly-button" href={compareHref} onClick={onOpen ? (event) => { event.preventDefault(); onOpen(); } : undefined}>Compare now</a>
          : <span className="jelly-compare-tray-hint">Tick one more to compare</span>}
      </div>
    </div>
  </section>;
}

/**
 * The compare page: products side by side with price, brand, stock and every specification, rows that differ marked,
 * and a switch to show only the differences.
 */
export function ComparePageView({ items, max, shopHref, onRemove }: { items: CompareItem[]; max: number; shopHref: string; onRemove(id: string): void }) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const rows = compareRows(items);
  const shown = onlyDifferences ? rows.filter((row) => row.differs) : rows;
  return <main className="jelly-section jelly-compare-page">
    <div className="jelly-container">
      <header className="jelly-compare-head">
        <h1>Compare products</h1>
        {items.length > 1 && <label className="jelly-compare-differences">
          <input type="checkbox" checked={onlyDifferences} onChange={(event) => setOnlyDifferences(event.target.checked)} />
          <span>Show only differences</span>
        </label>}
      </header>
      {items.length === 0
        ? <div className="jelly-empty-state"><p>Tick Compare on up to {max} products to see them side by side.</p><a className="jelly-button" href={shopHref}>Browse products</a></div>
        : <div className="jelly-compare-scroll" tabIndex={0} role="region" aria-label="Comparison table">
          <table className="jelly-compare-table" style={{ "--jelly-compare-columns": items.length } as CSSProperties}>
            <caption className="jelly-visually-hidden">Comparison of {items.map((item) => item.name).join(", ")}</caption>
            <thead>
              <tr>
                <td />
                {items.map((item) => <th key={item.id} scope="col">
                  <a href={item.href}>
                    {item.imageUrl ? <img src={item.imageUrl} alt="" /> : null}
                    <span>{item.name}</span>
                  </a>
                  <button type="button" className="jelly-compare-remove" onClick={() => onRemove(item.id)}>Remove<span className="jelly-visually-hidden"> {item.name}</span></button>
                </th>)}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => <tr key={row.label} data-differs={row.differs ? "true" : undefined}>
                <th scope="row">{row.label}{row.differs && <span className="jelly-visually-hidden"> (differs)</span>}</th>
                {row.values.map((value, index) => <td key={items[index]!.id}>{value}</td>)}
              </tr>)}
              {!shown.length && <tr><td colSpan={items.length + 1}>These products are the same in every detail we know.</td></tr>}
            </tbody>
          </table>
        </div>}
      {items.length === 1 && <p className="jelly-compare-hint">Tick Compare on another product to see them side by side.</p>}
    </div>
  </main>;
}
