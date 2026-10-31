import { normalizeRichTextDocument, richTextToPlainText } from "@jelly/storefront-schema";
import { ApiError } from "../http/errors.js";

const MAX_DOCUMENT_CHARACTERS = 200_000;
const MAX_PLAIN_TEXT_CHARACTERS = 50_000;

interface DescriptionInput { description?: string; descriptionDoc?: unknown | null }

/**
 * Makes the stored rich text trustworthy: only the supported formatting survives, and the plain-text
 * `description` (search, SEO, structured data, emails) is always derived from it so the two cannot drift.
 * Input without `descriptionDoc` is returned untouched, so plain-text clients keep working.
 */
export function resolveProductDescription<T extends DescriptionInput>(input: T, subject = "product"): T {
  if (input.descriptionDoc === undefined) return input;
  if (input.descriptionDoc === null) return input;
  if (JSON.stringify(input.descriptionDoc).length > MAX_DOCUMENT_CHARACTERS) throw new ApiError(422, "DESCRIPTION_TOO_LONG", `The ${subject} description is too long.`);
  const document = normalizeRichTextDocument(input.descriptionDoc);
  if (!document) throw new ApiError(422, "DESCRIPTION_INVALID", `The ${subject} description could not be saved. Remove unsupported content and try again.`);
  const plainText = richTextToPlainText(document);
  if (plainText.length > MAX_PLAIN_TEXT_CHARACTERS) throw new ApiError(422, "DESCRIPTION_TOO_LONG", `The ${subject} description is too long.`);
  // An empty editor clears the rich text rather than storing an empty document.
  if (!plainText && document.content.every((block) => block.type === "paragraph" && block.content.length === 0)) return { ...input, descriptionDoc: null, description: "" };
  return { ...input, descriptionDoc: document, description: plainText };
}
