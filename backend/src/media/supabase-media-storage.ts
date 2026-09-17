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
      },
    );
  }

  async put({
    storeId,
    mediaId,
    extension,
    contents,
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
    const { data, error } =
      await this.client.storage
        .from(this.bucket)
        .download(storageKey);

    if (error) {
      if (isNotFound(error)) {
        return null;
      }

      throw error;
    }

    return Buffer.from(
      await data.arrayBuffer(),
    );
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