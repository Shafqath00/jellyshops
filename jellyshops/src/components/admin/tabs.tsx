"use client";
import type { KeyboardEvent } from "react";

export type TabItem = { id: string; label: string; count?: number };

/**
 * A row of views to switch between. Tab reaches the chosen view; Left/Right, Home and End move
 * between views, and Enter or Space chooses the one in focus (so arrowing along does not reload a list each step).
 */
export function Tabs({ label, tabs, active, onChange }: { label: string; tabs: TabItem[]; active?: string; onChange?: (id: string) => void }) {
  const current = tabs.some((tab) => tab.id === active) ? active : tabs[0]?.id;
  function move(event: KeyboardEvent<HTMLDivElement>) {
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const target = event.key === "ArrowRight" ? (index + 1) % buttons.length
      : event.key === "ArrowLeft" ? (index - 1 + buttons.length) % buttons.length
      : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
    if (target < 0) return;
    event.preventDefault();
    buttons[target].focus();
  }
  return <div className="jk-tabs" role="tablist" aria-label={label} onKeyDown={move}>
    {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={tab.id === current} tabIndex={tab.id === current ? 0 : -1} className="jk-tab" onClick={() => onChange?.(tab.id)}>
      {tab.label}{tab.count !== undefined && <span className="jk-tab-count">{tab.count}</span>}
    </button>)}
  </div>;
}
