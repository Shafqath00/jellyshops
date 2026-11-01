"use client";
import type { ReactNode } from "react";
import { ArrowLeft, Layers3, Settings2, Monitor, Smartphone, Tablet, MousePointer2, Undo2, Redo2 } from "lucide-react";
import clsx from "clsx";
import type { EditorViewport } from "../state/types";

export function WorkspaceToolbar({ themeName, pagePicker, languagePicker, actions, viewport, inspector, themeSelected, canUndo, canRedo, onBack, onSections, onTheme, onViewport, onInspector, onUndo, onRedo }: {
  themeName: string; pagePicker: ReactNode; languagePicker?: ReactNode; actions: ReactNode; viewport: EditorViewport; inspector: boolean; themeSelected: boolean; canUndo: boolean; canRedo: boolean;
  onBack(): void; onSections(): void; onTheme(): void; onViewport(value: EditorViewport): void; onInspector(): void; onUndo(): void; onRedo(): void;
}) {
  const icon = "grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-35";
  return <header className="relative z-40 flex h-14 shrink-0 items-center gap-1 border-b border-border bg-card px-2 text-foreground" aria-label="Theme editor toolbar">
    <div className="flex shrink-0 items-center gap-1"><button type="button" aria-label="Back to templates" onClick={onBack} className={icon}><ArrowLeft size={17} /></button><span className="mx-1 h-6 w-px bg-border" /><button type="button" aria-label="Sections" aria-pressed={!themeSelected} onClick={onSections} className={clsx(icon,"hidden sm:grid",!themeSelected && "bg-muted text-foreground")}><Layers3 size={17} /></button><button type="button" aria-label="Theme settings" aria-pressed={themeSelected} onClick={onTheme} className={clsx(icon,"hidden sm:grid",themeSelected && "bg-muted text-foreground")}><Settings2 size={17} /></button></div>
    <div className="flex min-w-0 flex-1 items-center justify-center gap-1"><span className="hidden max-w-[150px] truncate text-[13px] font-medium xl:inline">{themeName}</span>{pagePicker}</div>
    <div className="flex shrink-0 items-center gap-0.5">{languagePicker}<button type="button" aria-label="Toggle preview inspector" aria-pressed={inspector} onClick={onInspector} className={clsx(icon,"hidden sm:grid",inspector && "bg-muted text-foreground")}><MousePointer2 size={16} /></button>{([["desktop","Desktop preview",Monitor],["tablet","Tablet preview",Tablet],["mobile","Mobile preview",Smartphone]] as const).map(([value,label,Icon]) => <button key={value} type="button" aria-label={label} title={label} aria-pressed={viewport === value} onClick={() => onViewport(value)} className={clsx(icon,viewport === value && "bg-muted text-foreground", value === "tablet" && "hidden lg:grid",value === "desktop" && "hidden sm:grid")}><Icon size={16} /></button>)}<span className="mx-1 hidden h-6 w-px bg-border sm:block" /><button type="button" aria-label="Undo last editor change" disabled={!canUndo} onClick={onUndo} className={clsx(icon,"hidden sm:grid")}><Undo2 size={16} /></button><button type="button" aria-label="Redo editor change" disabled={!canRedo} onClick={onRedo} className={clsx(icon,"hidden sm:grid")}><Redo2 size={16} /></button>{actions}</div>
  </header>;
}
