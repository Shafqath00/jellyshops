"use client";
import { useId, useState } from "react";

export type DailySales = { date: string; revenueMinor: number; paidOrders: number };

/** "8 Nov" from "2026-11-08" without time-zone surprises. */
export function shortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(year, month - 1, day));
}

/** A round top value for the scale (1, 2, 4 or 5 times a power of ten, each halving cleanly), so gridlines read cleanly. */
export function niceMax(value: number) {
  if (value <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 4, 5, 10].find((factor) => factor * power >= value) ?? 10;
  return step * power;
}

/**
 * Daily sales as bars from a zero baseline, at a fixed height whatever the card width.
 * The bars are drawn in an SVG stretched to the card; labels are HTML, so text never scales.
 * Hover a day for its figures; a hidden table gives screen readers the same numbers.
 */
export function SalesChart({ daily, money, axisMoney = money, label }: { daily: DailySales[]; money: (minor: number) => string; axisMoney?: (minor: number) => string; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const total = daily.reduce((sum, day) => sum + day.revenueMinor, 0);
  if (!total) return <p className="jk-chart-empty">No paid orders in this period yet. Sales will show here day by day.</p>;
  const top = niceMax(Math.max(...daily.map((day) => day.revenueMinor)));
  const count = daily.length;
  const gap = count > 40 ? 0.2 : 0.3;
  const shown = active === null ? null : daily[active];
  const ticks = [0, Math.floor((count - 1) / 2), count - 1].filter((value, index, all) => all.indexOf(value) === index);
  return <figure className="jk-chart">
    <figcaption className="sr-only">{label}</figcaption>
    <div className="jk-chart-readout" aria-hidden="true">
      {shown ? <><strong>{money(shown.revenueMinor)}</strong><span className="jk-muted"> on {shortDate(shown.date)} · {shown.paidOrders} {shown.paidOrders === 1 ? "order" : "orders"}</span></> : <span className="jk-muted">Point at a day to see its sales.</span>}
    </div>
    <div className="jk-chart-body" aria-hidden="true">
      <div className="jk-chart-scale"><span>{axisMoney(top)}</span><span>{axisMoney(top / 2)}</span><span>{axisMoney(0)}</span></div>
      <div className="jk-chart-plot" onMouseLeave={() => setActive(null)}>
        <div className="jk-chart-grid"><span /><span /><span /></div>
        <svg viewBox={`0 0 ${count} 100`} preserveAspectRatio="none" className="jk-chart-svg">
          {daily.map((day, index) => {
            const h = (day.revenueMinor / top) * 100;
            return <g key={day.date} onMouseEnter={() => setActive(index)}>
              <rect x={index} y={0} width={1} height={100} className="jk-chart-hit" />
              {h > 0 && <rect x={index + gap / 2} y={100 - h} width={1 - gap} height={h} className={`jk-chart-bar ${active === index ? "is-active" : ""}`} />}
            </g>;
          })}
        </svg>
      </div>
      <div className="jk-chart-ticks">{ticks.map((index) => <span key={index} style={{ left: `${((index + 0.5) / count) * 100}%` }} data-edge={index === 0 ? "start" : index === count - 1 ? "end" : undefined}>{shortDate(daily[index].date)}</span>)}</div>
    </div>
    <div className="sr-only"><table id={tableId}><caption>{label}</caption><thead><tr><th>Day</th><th>Sales</th><th>Orders</th></tr></thead>
      <tbody>{daily.map((day) => <tr key={day.date}><td>{shortDate(day.date)}</td><td>{money(day.revenueMinor)}</td><td>{day.paidOrders}</td></tr>)}</tbody></table></div>
  </figure>;
}
