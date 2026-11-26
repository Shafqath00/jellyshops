/** Request shapes for the content routes (the service checks the meaning; these check the shape). */
import { z } from "zod";
import { MAX_BULK_IDS, MAX_LIST_LIMIT, MAX_TAGS } from "./rules.js";

const contentDocument = z.record(z.string(), z.unknown());
const nullableText = z.string().max(5000).nullable().optional();
const scheduledAt = z.string().datetime({ offset: true }).nullable().optional();

const seoFields = {
  featuredMediaId: nullableText,
  seoTitle: nullableText,
  seoDescription: nullableText,
  socialMediaId: nullableText,
  noindex: z.boolean().optional(),
  canonicalOverride: nullableText,
};

const publishing = {
  publish: z.boolean().optional(),
  scheduledAt,
};

export const pageCreateSchema = z.object({
  title: z.string(),
  handle: z.string().optional(),
  content: contentDocument.optional(),
  showInNavigation: z.boolean().optional(),
  authorName: nullableText,
  ...seoFields,
  ...publishing,
}).strip();

export const pageUpdateSchema = z.object({
  title: z.string().optional(),
  handle: z.string().optional(),
  content: contentDocument.optional(),
  showInNavigation: z.boolean().optional(),
  authorName: nullableText,
  scheduledAt,
  ...seoFields,
}).strip();

export const blogCreateSchema = z.object({ title: z.string(), handle: z.string().optional() }).strip();
export const blogUpdateSchema = z.object({ title: z.string().optional(), handle: z.string().optional() }).strip();

export const articleCreateSchema = z.object({
  blogId: z.string().min(1),
  title: z.string(),
  handle: z.string().optional(),
  excerpt: z.string().optional(),
  content: contentDocument.optional(),
  tags: z.array(z.string()).max(MAX_TAGS * 2).optional(),
  authorName: nullableText,
  ...seoFields,
  ...publishing,
}).strip();

export const articleUpdateSchema = z.object({
  blogId: z.string().min(1).optional(),
  title: z.string().optional(),
  handle: z.string().optional(),
  excerpt: z.string().optional(),
  content: contentDocument.optional(),
  tags: z.array(z.string()).max(MAX_TAGS * 2).optional(),
  authorName: nullableText,
  scheduledAt,
  ...seoFields,
}).strip();

export const scheduleSchema = z.object({ scheduledAt: z.string().datetime({ offset: true }) }).strip();

export const bulkSchema = z.object({
  action: z.enum(["publish", "unpublish", "archive", "restore", "delete"]),
  ids: z.array(z.string().min(1)).min(1).max(MAX_BULK_IDS),
}).strip();

const optionalDate = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional();

export const listQuerySchema = z.object({
  q: z.string().max(200).optional(),
  state: z.enum(["published", "draft", "scheduled", "archived", "active", "all"]).optional(),
  author: z.string().max(200).optional(),
  tag: z.string().max(100).optional(),
  blogId: z.string().max(200).optional(),
  updatedFrom: optionalDate,
  updatedTo: optionalDate,
  sort: z.enum(["updated", "created", "title", "published"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
  offset: z.coerce.number().int().min(0).max(100_000).optional(),
}).strip();

export const handleQuerySchema = z.object({
  handle: z.string().min(1).max(200),
  excludeId: z.string().max(200).optional(),
  blogId: z.string().max(200).optional(),
}).strip();

/** A date-only "to" means the end of that day (UTC). */
export function listDates(query: z.infer<typeof listQuerySchema>) {
  const from = query.updatedFrom ? new Date(query.updatedFrom) : undefined;
  const to = query.updatedTo
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(query.updatedTo) ? `${query.updatedTo}T23:59:59.999Z` : query.updatedTo)
    : undefined;
  return { updatedFrom: from, updatedTo: to };
}
