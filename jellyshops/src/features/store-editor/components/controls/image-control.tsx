import {
  useId,
  useState,
} from "react";
import {
  ImagePlus,
  RefreshCcw,
  Trash2,
  Upload,
} from "lucide-react";

import type { MediaReference } from "@jelly/storefront-schema";
import type { MediaRecord } from "../../api/types";

export type UploadState =
  | {
      status: "idle";
    }
  | {
      status: "uploading";
      percent: number;
    }
  | {
      status: "error";
      message: string;
      file: File;
    };

export function ImageControl({
  label,
  value,
  onChange,
  upload,
}: {
  label: string;
  value: MediaReference | undefined;
  onChange(
    value: MediaReference | undefined
  ): void;
  upload(
    file: File,
    onProgress?: (
      percent: number
    ) => void
  ): Promise<MediaRecord>;
}) {
  const inputId = useId();

  const [state, setState] =
    useState<UploadState>({
      status: "idle",
    });

  const runUpload = async (
    file: File
  ) => {
    setState({
      status: "uploading",
      percent: 0,
    });

    try {
      const media = await upload(
        file,
        (percent) => {
          setState({
            status: "uploading",
            percent,
          });
        }
      );

      onChange({
        id: media.id,
        url: media.url,
        alt: "",
        focalPoint: {
          x: 50,
          y: 50,
        },
        fit: "cover",
      });

      setState({
        status: "idle",
      });
    } catch (error) {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Upload failed",
        file,
      });
    }
  };

  const handleFile = (
    file?: File
  ) => {
    if (!file) return;

    void runUpload(file);
  };

  const uploading =
    state.status === "uploading";

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-[11px] font-medium text-muted-foreground">
          {label}
        </span>

        <input
          id={inputId}
          aria-label={label}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          disabled={uploading}
          onChange={(event) => {
            handleFile(
              event.target.files?.[0]
            );

            /*
             * Reset so selecting the same
             * image again still triggers
             * onChange.
             */
            event.target.value = "";
          }}
          className="sr-only"
        />

        {!value ? (
          <label
            htmlFor={inputId}
            className={`group flex min-h-[140px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 px-5 text-center transition ${
              uploading
                ? "cursor-wait opacity-70"
                : "cursor-pointer hover:border-border hover:bg-muted/50"
            }`}
          >
            <span className="grid size-9 place-items-center rounded-lg bg-card text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.07)]">
              <Upload
                size={16}
                strokeWidth={1.8}
              />
            </span>

            <span className="mt-3 text-[12px] font-semibold text-foreground">
              {uploading
                ? "Uploading image…"
                : "Upload image"}
            </span>

            <span className="mt-1 text-[10px] leading-4 text-muted-foreground">
              PNG, JPEG, WebP, GIF
              or AVIF
            </span>
          </label>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-muted/50">
            <div className="relative aspect-[4/3] overflow-hidden bg-muted">
              {/* Local uploads can use object/API URLs that Next Image cannot optimize. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value.url}
                alt=""
                className="size-full object-cover"
              />

              <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1.5 bg-gradient-to-t from-black/35 to-transparent p-2.5 pt-8">
                <label
                  htmlFor={inputId}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg bg-card px-2.5 text-[11px] font-semibold text-foreground shadow-sm transition ${
                    uploading
                      ? "cursor-wait opacity-60"
                      : "cursor-pointer hover:bg-muted/50"
                  }`}
                >
                  <ImagePlus
                    size={13}
                  />

                  Replace
                </label>

                <button
                  type="button"
                  aria-label="Remove image"
                  disabled={uploading}
                  onClick={() =>
                    onChange(
                      undefined
                    )
                  }
                  className="grid size-8 place-items-center rounded-lg bg-card text-muted-foreground shadow-sm transition hover:bg-muted/50 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2
                    size={13}
                  />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload progress */}
        {state.status ===
          "uploading" && (
          <div className="mt-2">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium text-muted-foreground">
                Uploading…
              </span>

              <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                {Math.round(
                  state.percent
                )}
                %
              </span>
            </div>

            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                state.percent
              }
              className="h-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      0,
                      state.percent
                    )
                  )}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Upload error */}
        {state.status ===
          "error" && (
          <div
            role="alert"
            className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
          >
            <span className="min-w-0 text-[11px] leading-4 text-destructive">
              {state.message}
            </span>

            <button
              type="button"
              onClick={() =>
                void runUpload(
                  state.file
                )
              }
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-destructive hover:underline"
            >
              <RefreshCcw
                size={11}
              />
              Retry
            </button>
          </div>
        )}
      </div>

      {value && (
        <>
          {/* Alternative text */}
          <div>
            <label
              htmlFor={`${inputId}-alt`}
              className="mb-1.5 block text-[11px] font-medium text-muted-foreground"
            >
              Alternative text
            </label>

            <input
              id={`${inputId}-alt`}
              value={value.alt}
              disabled={
                value.alt === ""
              }
              placeholder={
                value.alt === ""
                  ? "Decorative image"
                  : "Describe this image"
              }
              onChange={(event) =>
                onChange({
                  ...value,
                  alt:
                    event.target
                      .value,
                })
              }
              className="h-9 w-full rounded-lg border border-border bg-card px-3 text-[12px] font-medium text-foreground outline-none transition placeholder:text-muted-foreground hover:border-border focus:border-border focus:ring-2 focus:ring-black/[0.06] disabled:bg-muted/50 disabled:text-muted-foreground"
            />

            <p className="mt-1.5 text-[10px] leading-4 text-muted-foreground">
              Describe the image for
              customers using screen
              readers.
            </p>
          </div>

          {/* Decorative */}
          <label className="flex min-h-8 cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-[12px] font-medium text-muted-foreground">
                Decorative image
              </span>

              <span className="mt-0.5 block text-[10px] text-muted-foreground">
                Ignore this image for
                screen readers
              </span>
            </div>

            <span className="relative shrink-0">
              <input
                type="checkbox"
                aria-label="Decorative image"
                checked={
                  value.alt === ""
                }
                onChange={(
                  event
                ) =>
                  onChange({
                    ...value,
                    alt: event
                      .target
                      .checked
                      ? ""
                      : "Image description",
                  })
                }
                className="peer sr-only"
              />

              <span className="block h-5 w-9 rounded-full bg-muted transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-black/20 peer-focus-visible:ring-offset-2" />

              <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-card shadow-sm transition-transform peer-checked:translate-x-4" />
            </span>
          </label>

          {/* Focal point */}
          <section className="border-t border-border pt-4">
            <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
              Focal point
            </h3>

            <div className="space-y-4">
              <FocalPointControl
                label="Horizontal"
                value={
                  value.focalPoint?.x ?? 50
                }
                onChange={(x) =>
                  onChange({
                    ...value,
                    focalPoint: {
                      x,
                      y: value.focalPoint?.y ?? 50,
                    },
                  })
                }
              />

              <FocalPointControl
                label="Vertical"
                value={
                  value.focalPoint?.y ?? 50
                }
                onChange={(y) =>
                  onChange({
                    ...value,
                    focalPoint: {
                      x: value.focalPoint?.x ?? 50,
                      y,
                    },
                  })
                }
              />
            </div>
          </section>

          {/* Image fit */}
          <section className="border-t border-border pt-4">
            <span className="mb-2 block text-[11px] font-medium text-muted-foreground">
              Image fit
            </span>

            <div
              role="group"
              aria-label="Image fit"
              className="flex rounded-lg bg-muted p-1"
            >
              {(
                [
                  "cover",
                  "contain",
                ] as const
              ).map((fit) => {
                const active =
                  (value.fit ?? "cover") ===
                  fit;

                return (
                  <button
                    key={fit}
                    type="button"
                    aria-pressed={
                      active
                    }
                    onClick={() =>
                      onChange({
                        ...value,
                        fit,
                      })
                    }
                    className={`min-h-7 flex-1 rounded-md px-3 text-[11px] font-medium capitalize transition ${
                      active
                        ? "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {fit}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Destructive action */}
          <div className="border-t border-border pt-4">
            <button
              type="button"
              onClick={() =>
                onChange(undefined)
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-destructive transition hover:bg-muted/50"
            >
              <Trash2
                size={13}
              />

              Remove image
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FocalPointControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between gap-4">
        <span className="text-[11px] font-medium text-muted-foreground">
          {label}
        </span>

        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {value}
        </span>
      </span>

      <input
        type="range"
        aria-label={`${label} focal point`}
        min={0}
        max={100}
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value
            )
          )
        }
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </label>
  );
}