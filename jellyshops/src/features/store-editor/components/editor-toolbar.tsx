import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  LoaderCircle,
  Monitor,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
} from "lucide-react";
import clsx from "clsx";

import type {
  EditorViewport,
  SaveStatus,
} from "../state/types";

function getStatus(status: SaveStatus) {
  switch (status) {
    case "dirty":
      return {
        label: "Unsaved",
        tone: "text-[var(--warn-fg)]",
        dot: "bg-[var(--warn-bg)]",
      };

    case "saving":
      return {
        label: "Saving…",
        tone: "text-muted-foreground",
        dot: "bg-secondary",
      };

    case "publishing":
      return {
        label: "Publishing…",
        tone: "text-muted-foreground",
        dot: "bg-secondary",
      };

    case "published":
      return {
        label: "Published",
        tone: "text-success",
        dot: "bg-success/15",
      };

    case "conflict":
      return {
        label: "Conflict detected",
        tone: "text-destructive",
        dot: "bg-primary",
      };

    case "error":
      return {
        label: "Save failed",
        tone: "text-destructive",
        dot: "bg-primary",
      };

    default:
      return {
        label: "Saved",
        tone: "text-muted-foreground",
        dot: "bg-success/15",
      };
  }
}

export function EditorToolbar({
  viewport,
  status,
  canUndo,
  canRedo,
  onViewport,
  onUndo,
  onRedo,
  onSave,
  onPublish,
  onReload,
}: {
  viewport: EditorViewport;
  status: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onViewport(viewport: EditorViewport): void;
  onUndo(): void;
  onRedo(): void;
  onSave(): void;
  onPublish(): void;
  onReload?(): void;
}) {
  const busy =
    status === "saving" ||
    status === "publishing";

  const statusConfig = getStatus(status);

  const viewportButtons = [
    {
      value: "desktop" as const,
      label: "Desktop preview",
      icon: Monitor,
    },
    {
      value: "tablet" as const,
      label: "Tablet preview",
      icon: Tablet,
    },
    {
      value: "mobile" as const,
      label: "Mobile preview",
      icon: Smartphone,
    },
  ];

  return (
    <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-border bg-card px-2.5 sm:px-3">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/admin"
          aria-label="Back to admin"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft
            size={17}
            strokeWidth={1.8}
          />
        </Link>

        <div className="hidden h-5 w-px bg-muted sm:block" />

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="hidden truncate text-[12px] font-semibold text-foreground sm:inline">
              Jelly Shop
            </span>

            <span className="hidden text-muted-foreground sm:inline">
              /
            </span>

            <span className="truncate text-[12px] font-medium text-muted-foreground">
              Home page
            </span>
          </div>
        </div>
      </div>

      {/* Viewport */}
      <div
        className="flex items-center rounded-lg bg-muted p-1"
        aria-label="Preview device"
      >
        {viewportButtons.map(
          ({
            value,
            label,
            icon: Icon,
          }) => {
            const active =
              viewport === value;

            return (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={active}
                onClick={() =>
                  onViewport(value)
                }
                className={clsx(
                  "grid size-7 place-items-center rounded-md transition",
                  active
                    ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                    : "text-muted-foreground hover:text-muted-foreground"
                )}
              >
                <Icon
                  size={15}
                  strokeWidth={
                    active ? 2 : 1.7
                  }
                />
              </button>
            );
          }
        )}
      </div>

      {/* Right */}
      <div className="flex min-w-0 items-center justify-end gap-1">
        <div className="mr-1 hidden items-center gap-0.5 md:flex">
          <button
            type="button"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Undo2
              size={16}
              strokeWidth={1.8}
            />
          </button>

          <button
            type="button"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Redo2
              size={16}
              strokeWidth={1.8}
            />
          </button>
        </div>

        <div
          className={clsx(
            "mr-1 hidden items-center gap-1.5 text-[11px] font-medium lg:flex",
            statusConfig.tone
          )}
          aria-live="polite"
        >
          {busy ? (
            <LoaderCircle
              size={13}
              className="animate-spin"
            />
          ) : status === "error" ||
            status === "conflict" ? (
            <AlertCircle size={13} />
          ) : status === "published" ||
            status === "saved" ? (
            <Check size={13} />
          ) : (
            <span
              className={clsx(
                "size-1.5 rounded-full",
                statusConfig.dot
              )}
            />
          )}

          <span>
            {statusConfig.label}
          </span>
        </div>

        {status === "conflict" &&
          onReload && (
            <button
              type="button"
              onClick={onReload}
              className="hidden h-8 items-center rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground hover:bg-muted/50 xl:inline-flex"
            >
              Reload latest draft
            </button>
          )}

        <button
          type="button"
          aria-label="Save"
          disabled={busy}
          onClick={onSave}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground transition hover:bg-muted disabled:opacity-40"
        >
          <Save
            size={14}
            strokeWidth={1.8}
          />

          <span className="hidden xl:inline">
            Save
          </span>
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onPublish}
          className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground shadow-[0_1px_0_rgba(0,0,0,0.12)] transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50 sm:px-3.5 sm:text-[12px]"
        >
          {status === "publishing"
            ? "Publishing…"
            : "Publish"}
        </button>
      </div>
    </header>
  );
}
