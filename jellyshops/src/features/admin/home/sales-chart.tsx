"use client";
import { useId, useState } from "react";

export type DailySales = { date: string; revenueMinor: number; paidOrders: number };

/** "8 Nov" from "2026-11-08" without time-zone surprises. */
export function shortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(Date.UTC(year, month - 1, day));
}

/**
 * One series of daily sales as thin bars from a zero baseline. Hover a day for its figures;
 * a hidden table gives screen readers the same numbers, so the drawing itself is hidden from them.
 */
export function SalesChart({ daily, money, label }: { daily: DailySales[]; money: (minor: number) => string; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const width = 640, height = 160, top = 12, bottom = 24, left = 4;
  const max = Math.max(...daily.map((day) => day.revenueMinor), 0);
  const step = (width - left) / Math.max(daily.length, 1);
  const barWidth = Math.max(2, Math.min(24, step - 2));
  const plot = height - top - bottom;
  const y = (value: number) => top + plot - (max ? (value / max) * plot : 0);
  const ticks = [0, Math.floor((daily.length - 1) / 2), daily.length - 1].filter((value, index, all) => value >= 0 && all.indexOf(value) === index);
  const shown = active === null ? null : daily[active];
  const total = daily.reduce((sum, day) => sum + day.revenueMinor, 0);
  if (!total) return <p className="jk-chart-empty">No paid orders in this period yet. Sales will show here day by day.</p>;
  return <figure className="jk-chart" aria-describedby={tableId}>
    <figcaption className="sr-only">{label}</figcaption>
    <div className="jk-chart-readout" aria-hidden="true">
      {shown ? <><strong>{money(shown.revenueMinor)}</strong> on {shortDate(shown.date)} · {shown.paidOrders} {shown.paidOrders === 1 ? "order" : "orders"}</> : <span className="jk-muted">Point at a day to see its sales.</span>}
    </div>
    <svg viewBox={`0 0 ${width} ${height}`} className="jk-chart-svg" aria-hidden="true" onMouseLeave={() => setActive(null)}>
      <line x1={left} x2={width} y1={top + plot} y2={top + plot} className="jk-chart-axis" />
      {daily.map((day, index) => {
        const x = left + index * step + (step - barWidth) / 2;
        const barTop = y(day.revenueMinor);
        const h = top + plot - barTop;
        return <g key={day.date} onMouseEnter={() => setActive(index)}>
          <rect x={left + index * step} y={top} width={step} height={plot} className="jk-chart-hit" />
          {h > 0 && <path className={`jk-chart-bar ${active === index ? "is-active" : ""}`} d={`M${x},${top + plot} V${barTop + Math.min(4, h)} Q${x},${barTop} ${x + Math.min(4, barWidth / 2)},${barTop} H${x + barWidth - Math.min(4, barWidth / 2)} Q${x + barWidth},${barTop} ${x + barWidth},${barTop + Math.min(4, h)} V${top + plot} Z`} />}
        </g>;
      })}
      {ticks.map((index) => <text key={index} x={left + index * step + step / 2} y={height - 6} textAnchor={index === 0 ? "start" : index === daily.length - 1 ? "end" : "middle"} className="jk-chart-tick">{shortDate(daily[index].date)}</text>)}
    </svg>
    <table id={tableId} className="sr-only"><caption>{label}</caption><thead><tr><th>Day</th><th>Sales</th><th>Orders</th></tr></thead>
      <tbody>{daily.map((day) => <tr key={day.date}><td>{shortDate(day.date)}</td><td>{money(day.revenueMinor)}</td><td>{day.paidOrders}</td></tr>)}</tbody></table>
  </figure>;
}
