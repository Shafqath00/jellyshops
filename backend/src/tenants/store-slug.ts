import { z } from "zod";
import { SYSTEM_STORE_ADDRESSES, checkStoreAddress } from "@jelly/storefront-schema";

/**
 * Names the platform uses itself (app pages, subdomains, mail names). The shared list in storefront-schema is the
 * source; a test checks it covers every top-level page folder of the storefront app.
 */
export const RESERVED_STORE_SLUGS: readonly string[] = SYSTEM_STORE_ADDRESSES;

/** A new web address: the shared rules (3 to 40 characters, no reserved, brand or offensive names). */
export const storeSlugSchema = z.string().superRefine((slug, context) => {
  const result = checkStoreAddress(slug);
  if (!result.ok) context.addIssue({ code: "custom", message: result.message });
});

/**
 * The shape of an address a store may already have (older rules allowed up to 63 characters). Used where a request
 * repeats the store's current address; a changed address must also pass `storeSlugSchema`.
 */
export const existingStoreSlugSchema = z.string()
  .min(3).max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");
