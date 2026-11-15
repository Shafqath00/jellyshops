import { z } from "zod";

/** Top-level app routes cannot also be public store addresses. */
export const RESERVED_STORE_SLUGS = ["admin", "api", "auth", "login", "signup", "onboarding", "theme-preview", "themes"];

export const storeSlugSchema = z.string()
  .min(3).max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.")
  .refine((slug) => !RESERVED_STORE_SLUGS.includes(slug), {
    message: "That web address is used by Jellyshop itself. Choose another.",
  });
