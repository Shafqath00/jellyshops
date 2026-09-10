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
        <span className="mb-1.5 block text-[11px] font-medium text-[#454f5b]">
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
            className={`group flex min-h-[140px] w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#c9c9c9] bg-[#fafafa] px-5 text-center transition ${
              uploading
                ? "cursor-wait opacity-70"
                : "cursor-pointer hover:border-[#a3a3a3] hover:bg-[#f7f7f7]"
            }`}
          >
            <span className="grid size-9 place-items-center rounded-lg bg-white text-[#6d7175] shadow-[0_0_0_1px_rgba(0,0,0,0.07)]">
              <Upload
                size={16}
                strokeWidth={1.8}
              />
            </span>

            <span className="mt-3 text-[12px] font-semibold text-[#303030]">
              {uploading
                ? "Uploading image…"
                : "Upload image"}
            </span>

            <span className="mt-1 text-[10px] leading-4 text-[#8c9196]">
              PNG, JPEG, WebP, GIF
              or AVIF
            </span>
          </label>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[#dedede] bg-[#f6f6f7]">
            <div className="relative aspect-[4/3] overflow-hidden bg-[#eeeeee]">
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
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-[#303030] shadow-sm transition ${
                    uploading
                      ? "cursor-wait opacity-60"
                      : "cursor-pointer hover:bg-[#f6f6f7]"
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
                  className="grid size-8 place-items-center rounded-lg bg-white text-[#616161] shadow-sm transition hover:bg-[#fff1f0] hover:text-[#b42318] disabled:opacity-50"
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
              <span className="text-[10px] font-medium text-[#6d7175]">
                Uploading…
              </span>

              <span className="text-[10px] font-semibold tabular-nums text-[#6d7175]">
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
              className="h-1 overflow-hidden rounded-full bg-[#e3e3e3]"
            >
              <div
                className="h-full rounded-full bg-[#303030] transition-[width]"
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
            className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-[#fff4f2] px-3 py-2.5"
          >
            <span className="min-w-0 text-[11px] leading-4 text-[#b42318]">
              {state.message}
            </span>

            <button
              type="button"
              onClick={() =>
                void runUpload(
                  state.file
                )
              }
              className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-[#b42318] hover:underline"
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
              className="mb-1.5 block text-[11px] font-medium text-[#454f5b]"
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
              className="h-9 w-full rounded-lg border border-[#d7d7d7] bg-white px-3 text-[12px] font-medium text-[#303030] outline-none transition placeholder:text-[#a3a3a3] hover:border-[#bdbdbd] focus:border-[#8c8c8c] focus:ring-2 focus:ring-black/[0.06] disabled:bg-[#f6f6f7] disabled:text-[#8c9196]"
            />

            <p className="mt-1.5 text-[10px] leading-4 text-[#8c9196]">
              Describe the image for
              customers using screen
              readers.
            </p>
          </div>

          {/* Decorative */}
          <label className="flex min-h-8 cursor-pointer items-center justify-between gap-4">
            <div>
              <span className="block text-[12px] font-medium text-[#454f5b]">
                Decorative image
              </span>

              <span className="mt-0.5 block text-[10px] text-[#8c9196]">
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

              <span className="block h-5 w-9 rounded-full bg-[#d7d7d7] transition peer-checked:bg-[#303030] peer-focus-visible:ring-2 peer-focus-visible:ring-black/20 peer-focus-visible:ring-offset-2" />

              <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </span>
          </label>

          {/* Focal point */}
          <section className="border-t border-[#eeeeee] pt-4">
            <h3 className="mb-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8c9196]">
              Focal point
            </h3>

            <div className="space-y-4">
              <FocalPointControl
                label="Horizontal"
                value={
                  value.focalPoint.x
                }
                onChange={(x) =>
                  onChange({
                    ...value,
                    focalPoint: {
                      ...value.focalPoint,
                      x,
                    },
                  })
                }
              />

              <FocalPointControl
                label="Vertical"
                value={
                  value.focalPoint.y
                }
                onChange={(y) =>
                  onChange({
                    ...value,
                    focalPoint: {
                      ...value.focalPoint,
                      y,
                    },
                  })
                }
              />
            </div>
          </section>

          {/* Image fit */}
          <section className="border-t border-[#eeeeee] pt-4">
            <span className="mb-2 block text-[11px] font-medium text-[#454f5b]">
              Image fit
            </span>

            <div
              role="group"
              aria-label="Image fit"
              className="flex rounded-lg bg-[#f1f1f1] p-1"
            >
              {(
                [
                  "cover",
                  "contain",
                ] as const
              ).map((fit) => {
                const active =
                  value.fit ===
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
                        ? "bg-white text-[#202223] shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                        : "text-[#6d7175] hover:text-[#303030]"
                    }`}
                  >
                    {fit}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Destructive action */}
          <div className="border-t border-[#eeeeee] pt-4">
            <button
              type="button"
              onClick={() =>
                onChange(undefined)
              }
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-[#b42318] transition hover:bg-[#fff1f0]"
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
        <span className="text-[11px] font-medium text-[#454f5b]">
          {label}
        </span>

        <span className="rounded-md bg-[#f1f1f1] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[#616161]">
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
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#dedede] accent-[#303030]"
      />
    </label>
  );
}