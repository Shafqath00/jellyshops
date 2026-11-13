import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  MediaStorage,
  PutMediaInput,
} from "./storage.js";

function isNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const statusCode =
    (error as { statusCode?: string | number }).statusCode;

  return Number(statusCode) === 404;
}

export class SupabaseMediaStorage
  implements MediaStorage
{
  private readonly client: SupabaseClient;

  constructor(
    supabaseUrl: string,
    secretKey: string,
    private readonly bucket: string,
  ) {
    this.client = createClient(
      supabaseUrl,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        realtime: {
          // The backend never uses Supabase Realtime.
          // Disabling it avoids the native WebSocket requirement
          // on Node.js 20 and below.
          timeout: 0,
          params: {},
          log_level: "disable",
        },
      },
    );
  }

  async put({
    storeId,
    mediaId,
    extension,
    contents,
    mimeType,
  }: PutMediaInput): Promise<string> {
    const storageKey =
      `${storeId}/${mediaId}.${extension}`;

    const { error } =
      await this.client.storage
        .from(this.bucket)
        .upload(
          storageKey,
          contents,
          {
            upsert: false,
            ...(mimeType ? { contentType: mimeType } : {}),
          },
        );

    if (error) {
      throw error;
    }

    return storageKey;
  }

  async open(
    storageKey: string,
  ): Promise<Buffer | null> {
    // One more try when the download fails for a reason other than a missing file: storage occasionally drops a
    // request under load (StorageUnknownError), which showed shoppers a broken photo.
    for (let attempt = 1; ; attempt += 1) {
      const { data, error } =
        await this.client.storage
          .from(this.bucket)
          .download(storageKey);

      if (!error) {
        return Buffer.from(
          await data.arrayBuffer(),
        );
      }
      if (isNotFound(error)) {
        return null;
      }
      if (attempt >= 2) {
        throw error;
      }
    }
  }

  async remove(
    storageKey: string,
  ): Promise<void> {
    const { error } =
      await this.client.storage
        .from(this.bucket)
        .remove([storageKey]);

    if (error) {
      throw error;
    }
  }
}