"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { authApiOrigin, useAuth } from "../providers/auth-provider";
import { setupRequest, type SetupImageKind } from "../api/onboarding-api";

export function useSetupImage(kind: SetupImageKind, present: boolean) {
  const { getAccessToken } = useAuth();
  const [file, setFile] = useState<{ url: string; imageKey: number } | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [imageKey, setImageKey] = useState(0);

  useEffect(() => {
    if (!present) return;
    const controller = new AbortController();
    let url: string | undefined;
    void getAccessToken().then((token) => setupRequest<Blob>(authApiOrigin(), `/images/${kind}`, token, {
      signal: controller.signal,
      response: "blob",
    })).then((blob) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setFile({ url, imageKey });
    }).catch(() => {
      if (!controller.signal.aborted) setError("Could not preview the saved image.");
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [getAccessToken, imageKey, kind, present]);

  const change = useCallback(async (image?: File) => {
    setError("");
    setPending(true);
    try {
      const token = await getAccessToken();
      if (image) {
        const body = new FormData();
        body.set("file", image);
        await setupRequest(authApiOrigin(), `/images/${kind}`, token, { method: "PUT", body });
      } else {
        await setupRequest(authApiOrigin(), `/images/${kind}`, token, { method: "DELETE" });
      }
      setImageKey((value) => value + 1);
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save the image. Try again.");
      return false;
    } finally {
      setPending(false);
    }
  }, [getAccessToken, kind]);

  return { url: present && file?.imageKey === imageKey ? file.url : null, error, pending, change };
}

export function SetupImageControl({ kind, title, present, disabled, picture, onUpdate }: {
  kind: SetupImageKind;
  title: string;
  present: boolean;
  disabled?: boolean;
  picture: ReturnType<typeof useSetupImage>;
  onUpdate: (present: boolean) => void;
}) {
  async function updateImage(file?: File) {
    if (await picture.change(file)) onUpdate(Boolean(file));
  }

  return (
    <div>
      {picture.url && <Image src={picture.url} alt={`${title} preview`} width={72} height={72} unoptimized style={{ objectFit: "cover", borderRadius: kind === "profile" ? "50%" : 8 }} />}
      <label htmlFor={`setup-image-${kind}`}>{title} (optional)</label>
      <input
        id={`setup-image-${kind}`}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        disabled={disabled || picture.pending}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void updateImage(file);
        }}
      />
      {present && <button type="button" disabled={disabled || picture.pending} onClick={() => void updateImage()}>Remove {title.toLowerCase()}</button>}
      {picture.pending && <p role="status">Saving {title.toLowerCase()}…</p>}
      {picture.error && <p role="alert">{picture.error}</p>}
    </div>
  );
}
