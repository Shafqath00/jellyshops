import { ApiError } from "../http/errors.js";
import type { PlanLimitChecker } from "../billing/plan-limits.js";
import type {
  ArticleRecord,
  BlogRecord,
  ContentDocument,
  ContentRepository,
  ContentResourceType,
  PageRecord,
  ScheduledPublication,
  UpdateArticleRecordInput,
  UpdateBlogRecordInput,
  UpdatePageRecordInput,
} from "./repository.js";
import {
  MAX_AUTHOR_LENGTH,
  MAX_BULK_IDS,
  MAX_EXCERPT_LENGTH,
  articlePath,
  badRequest,
  blogPath,
  checkContentSize,
  checkHandle,
  checkScheduleTime,
  contentState,
  freeHandle,
  handleTaken,
  normaliseContentPath,
  normaliseTags,
  pagePath,
  queryContent,
  requiredText,
  slugify,
  type ContentListQuery,
  type ContentListResult,
} from "./rules.js";

/** Who is making the change; the author of anything they create. */
export interface ContentActor {
  userId: string;
  name: string | null;
}

interface SeoInput {
  featuredMediaId?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  socialMediaId?: string | null;
  noindex?: boolean;
  canonicalOverride?: string | null;
}

/** How a new or saved item should be shown: as it is, published now, or published at a time. */
interface PublishingInput {
  publish?: boolean;
  /** ISO time or Date; null clears a schedule. */
  scheduledAt?: Date | string | null;
}

export interface CreatePageInput extends SeoInput, PublishingInput {
  title: string;
  /** Left out: made from the title (and made unique). */
  handle?: string;
  content?: ContentDocument;
  showInNavigation?: boolean;
  authorName?: string | null;
}

export interface UpdatePageInput extends SeoInput {
  title?: string;
  handle?: string;
  content?: ContentDocument;
  showInNavigation?: boolean;
  authorName?: string | null;
  scheduledAt?: Date | string | null;
}

export interface CreateBlogInput {
  title: string;
  handle?: string;
}

export interface UpdateBlogInput {
  title?: string;
  handle?: string;
}

export interface CreateArticleInput extends SeoInput, PublishingInput {
  blogId: string;
  title: string;
  handle?: string;
  excerpt?: string;
  content?: ContentDocument;
  tags?: string[];
  authorName?: string | null;
}

export interface UpdateArticleInput extends SeoInput {
  title?: string;
  handle?: string;
  excerpt?: string;
  content?: ContentDocument;
  tags?: string[];
  authorName?: string | null;
  /** Moves the post to another blog of the same store. */
  blogId?: string;
  scheduledAt?: Date | string | null;
}

export type BulkAction = "publish" | "unpublish" | "archive" | "restore" | "delete";

export interface BulkResult {
  done: string[];
  failed: Array<{ id: string; message: string }>;
}

export interface HandleCheck {
  handle: string;
  available: boolean;
  /** A free ending close to the one asked for. */
  suggestion: string;
}

const EMPTY_DOCUMENT: ContentDocument = { type: "doc", content: [] };

function notFound(label: string): never {
  throw new ApiError(404, "CONTENT_NOT_FOUND", `This ${label} doesn't exist any more. It may have been deleted.`);
}

function nullableText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const normalized = value.trim();
  return normalized || null;
}

function authorName(value: string | null | undefined): string | null | undefined {
  const normalized = nullableText(value);
  if (normalized && normalized.length > MAX_AUTHOR_LENGTH) badRequest("CONTENT_INVALID", `The author's name can be up to ${MAX_AUTHOR_LENGTH} characters.`);
  return normalized;
}

function scheduleDate(value: Date | string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return value instanceof Date ? value : new Date(value);
}

function seo(input: SeoInput) {
  return {
    ...(input.featuredMediaId !== undefined ? { featuredMediaId: nullableText(input.featuredMediaId) ?? null } : {}),
    ...(input.seoTitle !== undefined ? { seoTitle: nullableText(input.seoTitle) ?? null } : {}),
    ...(input.seoDescription !== undefined ? { seoDescription: nullableText(input.seoDescription) ?? null } : {}),
    ...(input.socialMediaId !== undefined ? { socialMediaId: nullableText(input.socialMediaId) ?? null } : {}),
    ...(input.noindex !== undefined ? { noindex: input.noindex } : {}),
    ...(input.canonicalOverride !== undefined ? { canonicalOverride: nullableText(input.canonicalOverride) ?? null } : {}),
  };
}

/** Postgres unique-index clash (two saves at the same moment picked the same handle). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

export class ContentService {
  constructor(
    private readonly repository: ContentRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly limits?: Pick<PlanLimitChecker, "check">,
  ) {}

  // ---------------------------------------------------------------- pages

  getPage(storeId: string, id: string) { return this.repository.getPage(storeId, id); }
  listPages(storeId: string) { return this.repository.listPages(storeId); }

  async browsePages(storeId: string, query: ContentListQuery = {}): Promise<ContentListResult<PageRecord>> {
    return queryContent(await this.repository.listPages(storeId), query);
  }

  async checkPageHandle(storeId: string, handle: string, excludeId?: string): Promise<HandleCheck> {
    const wanted = checkHandle(handle);
    const taken = await this.pageHandles(storeId, excludeId);
    return { handle: wanted, available: !taken.has(wanted), suggestion: freeHandle(wanted, taken) };
  }

  async createPage(storeId: string, input: CreatePageInput, actor?: ContentActor): Promise<PageRecord> {
    await this.limits?.check(storeId, "pages");
    const title = requiredText(input.title, "The page title");
    const taken = await this.pageHandles(storeId);
    const handle = this.pickHandle(input.handle, title, taken, "page");
    const publishing = this.publishing(input);
    const record = await this.guardUnique(() => this.repository.createPage({
      storeId,
      title,
      handle,
      content: checkContentSize(input.content ?? EMPTY_DOCUMENT),
      featuredMediaId: nullableText(input.featuredMediaId) ?? null,
      seoTitle: nullableText(input.seoTitle) ?? null,
      seoDescription: nullableText(input.seoDescription) ?? null,
      socialMediaId: nullableText(input.socialMediaId) ?? null,
      noindex: input.noindex ?? false,
      canonicalOverride: nullableText(input.canonicalOverride) ?? null,
      showInNavigation: input.showInNavigation ?? true,
      archivedAt: null,
      authorUserId: actor?.userId ?? null,
      authorName: authorName(input.authorName) ?? actor?.name ?? null,
      ...publishing,
    }), handle, taken, "page");
    await this.repository.removeRedirect(storeId, pagePath(record.handle));
    return record;
  }

  async updatePage(storeId: string, id: string, patch: UpdatePageInput): Promise<PageRecord> {
    const current = await this.repository.getPage(storeId, id) ?? notFound("page");
    const normalized: UpdatePageRecordInput = {
      ...(patch.title !== undefined ? { title: requiredText(patch.title, "The page title") } : {}),
      ...(patch.content !== undefined ? { content: checkContentSize(patch.content) } : {}),
      ...(patch.showInNavigation !== undefined ? { showInNavigation: patch.showInNavigation } : {}),
      ...(patch.authorName !== undefined ? { authorName: authorName(patch.authorName) ?? null } : {}),
      ...seo(patch),
      ...this.scheduleChange(current, patch.scheduledAt),
    };
    let handleChanged = false;
    if (patch.handle !== undefined) {
      const handle = checkHandle(patch.handle);
      if (handle !== current.handle) {
        const taken = await this.pageHandles(storeId, id);
        if (taken.has(handle)) handleTaken(handle, freeHandle(handle, taken), "page");
        normalized.handle = handle;
        handleChanged = true;
      }
    }
    const saved = await this.guardUnique(async () => await this.repository.updatePage(storeId, id, normalized) ?? notFound("page"),
      normalized.handle ?? current.handle, await this.pageHandles(storeId, id), "page");
    if (handleChanged) await this.moveAddress(storeId, "page", id, pagePath(current.handle), pagePath(saved.handle));
    return saved;
  }

  async publishPage(storeId: string, id: string): Promise<PageRecord> {
    return await this.repository.updatePage(storeId, id, { status: "PUBLISHED", publishedAt: this.now(), scheduledAt: null, archivedAt: null }) ?? notFound("page");
  }

  async unpublishPage(storeId: string, id: string): Promise<PageRecord> {
    return await this.repository.updatePage(storeId, id, { status: "DRAFT", publishedAt: null, scheduledAt: null }) ?? notFound("page");
  }

  async archivePage(storeId: string, id: string): Promise<PageRecord> {
    return await this.repository.updatePage(storeId, id, { status: "DRAFT", publishedAt: null, scheduledAt: null, archivedAt: this.now() }) ?? notFound("page");
  }

  async restorePage(storeId: string, id: string): Promise<PageRecord> {
    return await this.repository.updatePage(storeId, id, { archivedAt: null }) ?? notFound("page");
  }

  /** Permanent; only from the archive, so a slip of the finger can always be undone first. */
  async deletePage(storeId: string, id: string): Promise<void> {
    const current = await this.repository.getPage(storeId, id) ?? notFound("page");
    if (!current.archivedAt) throw new ApiError(409, "CONTENT_NOT_ARCHIVED", "Archive this page before deleting it for good.");
    await this.repository.deletePage(storeId, id);
  }

  async duplicatePage(storeId: string, id: string, actor?: ContentActor): Promise<PageRecord> {
    const source = await this.repository.getPage(storeId, id) ?? notFound("page");
    return this.createPage(storeId, {
      title: copyTitle(source.title),
      handle: freeHandle(`${source.handle}-copy`.slice(0, 100).replace(/-+$/, ""), await this.pageHandles(storeId)),
      content: source.content,
      featuredMediaId: source.featuredMediaId,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      socialMediaId: source.socialMediaId,
      noindex: source.noindex,
      canonicalOverride: source.canonicalOverride,
      showInNavigation: source.showInNavigation,
    }, actor);
  }

  bulkPages(storeId: string, action: BulkAction, ids: readonly string[]): Promise<BulkResult> {
    return this.bulk(ids, (id) => {
      switch (action) {
        case "publish": return this.publishPage(storeId, id);
        case "unpublish": return this.unpublishPage(storeId, id);
        case "archive": return this.archivePage(storeId, id);
        case "restore": return this.restorePage(storeId, id);
        case "delete": return this.deletePage(storeId, id);
      }
    });
  }

  // ---------------------------------------------------------------- blogs

  getBlog(storeId: string, id: string) { return this.repository.getBlog(storeId, id); }
  listBlogs(storeId: string) { return this.repository.listBlogs(storeId); }

  async createBlog(storeId: string, input: CreateBlogInput): Promise<BlogRecord> {
    const title = requiredText(input.title, "The blog name");
    const taken = await this.blogHandles(storeId);
    const handle = this.pickHandle(input.handle, title, taken, "blog");
    const record = await this.guardUnique(() => this.repository.createBlog({ storeId, title, handle }), handle, taken, "blog");
    await this.repository.removeRedirect(storeId, blogPath(record.handle));
    return record;
  }

  async updateBlog(storeId: string, id: string, patch: UpdateBlogInput): Promise<BlogRecord> {
    const current = await this.repository.getBlog(storeId, id) ?? notFound("blog");
    const normalized: UpdateBlogRecordInput = {
      ...(patch.title !== undefined ? { title: requiredText(patch.title, "The blog name") } : {}),
    };
    if (patch.handle !== undefined) {
      const handle = checkHandle(patch.handle);
      if (handle !== current.handle) {
        const taken = await this.blogHandles(storeId, id);
        if (taken.has(handle)) handleTaken(handle, freeHandle(handle, taken), "blog");
        normalized.handle = handle;
      }
    }
    const saved = await this.repository.updateBlog(storeId, id, normalized) ?? notFound("blog");
    if (normalized.handle) await this.moveAddress(storeId, "blog", id, blogPath(current.handle), blogPath(saved.handle));
    return saved;
  }

  /** Only an empty blog can be deleted, so no post is lost with it. */
  async deleteBlog(storeId: string, id: string): Promise<void> {
    await this.repository.getBlog(storeId, id) ?? notFound("blog");
    const posts = await this.repository.listArticles(storeId, id);
    if (posts.length) {
      throw new ApiError(409, "CONTENT_BLOG_NOT_EMPTY", `This blog still holds ${posts.length} post${posts.length === 1 ? "" : "s"} (archived ones too). Move or delete them first.`);
    }
    await this.repository.deleteBlog(storeId, id);
  }

  // ---------------------------------------------------------------- blog posts

  getArticle(storeId: string, id: string) { return this.repository.getArticle(storeId, id); }
  listArticles(storeId: string, blogId?: string) { return this.repository.listArticles(storeId, blogId); }

  async browseArticles(storeId: string, query: ContentListQuery = {}): Promise<ContentListResult<ArticleRecord>> {
    return queryContent(await this.repository.listArticles(storeId), query);
  }

  async checkArticleHandle(storeId: string, blogId: string, handle: string, excludeId?: string): Promise<HandleCheck> {
    const wanted = checkHandle(handle);
    const taken = await this.articleHandles(storeId, blogId, excludeId);
    return { handle: wanted, available: !taken.has(wanted), suggestion: freeHandle(wanted, taken) };
  }

  async createArticle(storeId: string, input: CreateArticleInput, actor?: ContentActor): Promise<ArticleRecord> {
    const blog = await this.repository.getBlog(storeId, requiredText(input.blogId, "The blog")) ?? notFound("blog");
    await this.limits?.check(storeId, "articles");
    const title = requiredText(input.title, "The post title");
    const taken = await this.articleHandles(storeId, blog.id);
    const handle = this.pickHandle(input.handle, title, taken, "post");
    const record = await this.guardUnique(() => this.repository.createArticle({
      storeId,
      blogId: blog.id,
      title,
      handle,
      excerpt: excerpt(input.excerpt),
      content: checkContentSize(input.content ?? EMPTY_DOCUMENT),
      featuredMediaId: nullableText(input.featuredMediaId) ?? null,
      seoTitle: nullableText(input.seoTitle) ?? null,
      seoDescription: nullableText(input.seoDescription) ?? null,
      socialMediaId: nullableText(input.socialMediaId) ?? null,
      noindex: input.noindex ?? false,
      canonicalOverride: nullableText(input.canonicalOverride) ?? null,
      tags: normaliseTags(input.tags ?? []),
      archivedAt: null,
      authorUserId: actor?.userId ?? null,
      authorName: authorName(input.authorName) ?? actor?.name ?? null,
      ...this.publishing(input),
    }), handle, taken, "post");
    await this.repository.removeRedirect(storeId, articlePath(blog.handle, record.handle));
    return record;
  }

  async updateArticle(storeId: string, id: string, patch: UpdateArticleInput): Promise<ArticleRecord> {
    const current = await this.repository.getArticle(storeId, id) ?? notFound("post");
    const currentBlog = await this.repository.getBlog(storeId, current.blogId) ?? notFound("blog");
    const targetBlog = patch.blogId && patch.blogId !== current.blogId
      ? await this.repository.getBlog(storeId, patch.blogId) ?? notFound("blog")
      : currentBlog;
    const normalized: UpdateArticleRecordInput = {
      ...(patch.title !== undefined ? { title: requiredText(patch.title, "The post title") } : {}),
      ...(patch.excerpt !== undefined ? { excerpt: excerpt(patch.excerpt) } : {}),
      ...(patch.content !== undefined ? { content: checkContentSize(patch.content) } : {}),
      ...(patch.tags !== undefined ? { tags: normaliseTags(patch.tags) } : {}),
      ...(patch.authorName !== undefined ? { authorName: authorName(patch.authorName) ?? null } : {}),
      ...(targetBlog.id !== current.blogId ? { blogId: targetBlog.id } : {}),
      ...seo(patch),
      ...this.scheduleChange(current, patch.scheduledAt),
    };
    const handle = patch.handle !== undefined ? checkHandle(patch.handle) : current.handle;
    const addressChanges = handle !== current.handle || targetBlog.id !== current.blogId;
    const taken = await this.articleHandles(storeId, targetBlog.id, id);
    if (addressChanges) {
      if (taken.has(handle)) handleTaken(handle, freeHandle(handle, taken), "post");
      if (handle !== current.handle) normalized.handle = handle;
    }
    const saved = await this.guardUnique(async () => await this.repository.updateArticle(storeId, id, normalized) ?? notFound("post"), handle, taken, "post");
    if (addressChanges) {
      await this.moveAddress(storeId, "article", id, articlePath(currentBlog.handle, current.handle), articlePath(targetBlog.handle, saved.handle));
    }
    return saved;
  }

  async publishArticle(storeId: string, id: string): Promise<ArticleRecord> {
    return await this.repository.updateArticle(storeId, id, { status: "PUBLISHED", publishedAt: this.now(), scheduledAt: null, archivedAt: null }) ?? notFound("post");
  }

  async unpublishArticle(storeId: string, id: string): Promise<ArticleRecord> {
    return await this.repository.updateArticle(storeId, id, { status: "DRAFT", publishedAt: null, scheduledAt: null }) ?? notFound("post");
  }

  async archiveArticle(storeId: string, id: string): Promise<ArticleRecord> {
    return await this.repository.updateArticle(storeId, id, { status: "DRAFT", publishedAt: null, scheduledAt: null, archivedAt: this.now() }) ?? notFound("post");
  }

  async restoreArticle(storeId: string, id: string): Promise<ArticleRecord> {
    return await this.repository.updateArticle(storeId, id, { archivedAt: null }) ?? notFound("post");
  }

  async deleteArticle(storeId: string, id: string): Promise<void> {
    const current = await this.repository.getArticle(storeId, id) ?? notFound("post");
    if (!current.archivedAt) throw new ApiError(409, "CONTENT_NOT_ARCHIVED", "Archive this post before deleting it for good.");
    await this.repository.deleteArticle(storeId, id);
  }

  async duplicateArticle(storeId: string, id: string, actor?: ContentActor): Promise<ArticleRecord> {
    const source = await this.repository.getArticle(storeId, id) ?? notFound("post");
    return this.createArticle(storeId, {
      blogId: source.blogId,
      title: copyTitle(source.title),
      handle: freeHandle(`${source.handle}-copy`.slice(0, 100).replace(/-+$/, ""), await this.articleHandles(storeId, source.blogId)),
      excerpt: source.excerpt,
      content: source.content,
      tags: source.tags,
      featuredMediaId: source.featuredMediaId,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      socialMediaId: source.socialMediaId,
      noindex: source.noindex,
      canonicalOverride: source.canonicalOverride,
    }, actor);
  }

  bulkArticles(storeId: string, action: BulkAction, ids: readonly string[]): Promise<BulkResult> {
    return this.bulk(ids, (id) => {
      switch (action) {
        case "publish": return this.publishArticle(storeId, id);
        case "unpublish": return this.unpublishArticle(storeId, id);
        case "archive": return this.archiveArticle(storeId, id);
        case "restore": return this.restoreArticle(storeId, id);
        case "delete": return this.deleteArticle(storeId, id);
      }
    });
  }

  // ---------------------------------------------------------------- old addresses and schedules

  /**
   * Where an old shopper address now lives, or null. Only published items are followed (a draft or archived item
   * shows the store's 404, as its own address would). A post under a renamed blog is found through the blog.
   */
  async resolveRedirect(storeId: string, path: string): Promise<string | null> {
    const normalized = normaliseContentPath(path);
    if (!normalized) return null;
    const exact = await this.repository.findRedirect(storeId, normalized);
    if (exact) return this.currentPath(storeId, exact.resourceType, exact.resourceId);
    const segments = normalized.split("/");
    if (segments[1] !== "blogs" || segments.length !== 4) return null;
    const blogRedirect = await this.repository.findRedirect(storeId, `/blogs/${segments[2]}`);
    if (!blogRedirect || blogRedirect.resourceType !== "blog") return null;
    const blog = await this.repository.getBlog(storeId, blogRedirect.resourceId);
    if (!blog) return null;
    const posts = await this.repository.listArticles(storeId, blog.id);
    const post = posts.find((entry) => entry.handle === segments[3]);
    if (post && contentState(post) === "published") return articlePath(blog.handle, post.handle);
    const moved = await this.repository.findRedirect(storeId, articlePath(blog.handle, segments[3]!));
    return moved ? this.currentPath(storeId, moved.resourceType, moved.resourceId) : null;
  }

  /** Called by the scheduled job: publishes every draft whose time has come. */
  publishDue(): Promise<ScheduledPublication[]> {
    return this.repository.publishDue(this.now());
  }

  // ---------------------------------------------------------------- helpers

  private async currentPath(storeId: string, type: ContentResourceType, id: string): Promise<string | null> {
    if (type === "page") {
      const page = await this.repository.getPage(storeId, id);
      return page && contentState(page) === "published" ? pagePath(page.handle) : null;
    }
    if (type === "blog") {
      const blog = await this.repository.getBlog(storeId, id);
      return blog ? blogPath(blog.handle) : null;
    }
    const post = await this.repository.getArticle(storeId, id);
    if (!post || contentState(post) !== "published") return null;
    const blog = await this.repository.getBlog(storeId, post.blogId);
    return blog ? articlePath(blog.handle, post.handle) : null;
  }

  /** The old address keeps pointing at the item; whatever pointed at the new address before is forgotten. */
  private async moveAddress(storeId: string, resourceType: ContentResourceType, resourceId: string, from: string, to: string): Promise<void> {
    if (from === to) return;
    await this.repository.removeRedirect(storeId, to);
    await this.repository.saveRedirect({ storeId, fromPath: from, resourceType, resourceId });
  }

  private publishing(input: PublishingInput) {
    const scheduledAt = scheduleDate(input.scheduledAt);
    if (input.publish && scheduledAt) badRequest("CONTENT_SCHEDULE_INVALID", "Choose either publish now or a publish time, not both.");
    if (input.publish) return { status: "PUBLISHED" as const, publishedAt: this.now(), scheduledAt: null };
    return { status: "DRAFT" as const, publishedAt: null, scheduledAt: scheduledAt ? checkScheduleTime(scheduledAt, this.now()) : null };
  }

  /** Setting a time schedules a draft (or takes a published item back to a scheduled draft); null cancels. */
  private scheduleChange(current: { scheduledAt: Date | null; archivedAt: Date | null }, value: Date | string | null | undefined) {
    const scheduledAt = scheduleDate(value);
    if (scheduledAt === undefined) return {};
    if (scheduledAt === null) return current.scheduledAt ? { scheduledAt: null } : {};
    if (current.archivedAt) badRequest("CONTENT_SCHEDULE_INVALID", "Restore this item from the archive before scheduling it.");
    return { scheduledAt: checkScheduleTime(scheduledAt, this.now()), status: "DRAFT" as const, publishedAt: null };
  }

  private pickHandle(requested: string | undefined, title: string, taken: ReadonlySet<string>, kind: "page" | "post" | "blog"): string {
    if (requested !== undefined && requested.trim()) {
      const handle = checkHandle(requested);
      if (taken.has(handle)) handleTaken(handle, freeHandle(handle, taken), kind);
      return handle;
    }
    return freeHandle(slugify(title), taken);
  }

  private async guardUnique<T>(write: () => Promise<T>, handle: string, taken: ReadonlySet<string>, kind: "page" | "post" | "blog"): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (isUniqueViolation(error)) handleTaken(handle, freeHandle(handle, new Set([...taken, handle])), kind);
      throw error;
    }
  }

  private async bulk(ids: readonly string[], run: (id: string) => Promise<unknown>): Promise<BulkResult> {
    const unique = [...new Set(ids)];
    if (!unique.length) badRequest("CONTENT_INVALID", "Choose at least one item.");
    if (unique.length > MAX_BULK_IDS) badRequest("CONTENT_INVALID", `Choose up to ${MAX_BULK_IDS} items at a time.`);
    const result: BulkResult = { done: [], failed: [] };
    for (const id of unique) {
      try {
        await run(id);
        result.done.push(id);
      } catch (error) {
        result.failed.push({ id, message: error instanceof ApiError ? error.message : "This item could not be changed. Try again." });
      }
    }
    return result;
  }

  private async pageHandles(storeId: string, excludeId?: string): Promise<Set<string>> {
    return new Set((await this.repository.listPages(storeId)).filter((page) => page.id !== excludeId).map((page) => page.handle));
  }

  private async blogHandles(storeId: string, excludeId?: string): Promise<Set<string>> {
    return new Set((await this.repository.listBlogs(storeId)).filter((blog) => blog.id !== excludeId).map((blog) => blog.handle));
  }

  private async articleHandles(storeId: string, blogId: string, excludeId?: string): Promise<Set<string>> {
    return new Set((await this.repository.listArticles(storeId, blogId)).filter((post) => post.id !== excludeId).map((post) => post.handle));
  }
}

function excerpt(value: string | undefined): string {
  const text = value?.trim() ?? "";
  if (text.length > MAX_EXCERPT_LENGTH) badRequest("CONTENT_INVALID", `The excerpt can be up to ${MAX_EXCERPT_LENGTH} characters.`);
  return text;
}

function copyTitle(title: string): string {
  return `${title} (copy)`.slice(0, 255);
}
