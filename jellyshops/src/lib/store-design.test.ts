import { createDefaultStoreDesign } from "@jelly/storefront-schema";
import { createRepository, memoryStorage } from "./repository";

const storeId = "store-sweet-bakes";

function withHeroHeading(heading: string) {
  const document = createDefaultStoreDesign();
  document.pages.home.sections[0].blocks[0].settings.text = heading;
  return document;
}

it("seeds a default Store Design for every store", () => {
  const repository = createRepository(memoryStorage());

  expect(repository.getState().stores.map((store) => repository.getStoreDesign(store.id)?.storeId)).toEqual(
    repository.getState().stores.map((store) => store.id)
  );
});

it("saves a draft only at its expected revision", () => {
  const repository = createRepository(memoryStorage());
  const current = repository.getStoreDesign(storeId)!;

  const saved = repository.saveStoreDesignDraft({ storeId, expectedRevision: current.draftRevision, document: withHeroHeading("Saved draft") });
  const stale = repository.saveStoreDesignDraft({ storeId, expectedRevision: current.draftRevision, document: withHeroHeading("Stale draft") });

  expect(saved).toMatchObject({ ok: true, record: { draftRevision: current.draftRevision + 1 } });
  expect(stale).toEqual({ ok: false, code: "DRAFT_REVISION_CONFLICT", currentRevision: current.draftRevision + 1 });
});

it("publishes an immutable snapshot while keeping later draft edits private", () => {
  const repository = createRepository(memoryStorage());
  const current = repository.getStoreDesign(storeId)!;
  const saved = repository.saveStoreDesignDraft({ storeId, expectedRevision: current.draftRevision, document: withHeroHeading("LIVE") });
  if (!saved.ok) throw new Error("Draft save should succeed");

  const published = repository.publishStoreDesign(storeId, saved.record.draftRevision);
  const laterDraft = repository.saveStoreDesignDraft({ storeId, expectedRevision: saved.record.draftRevision, document: withHeroHeading("DRAFT") });

  expect(published).toMatchObject({ ok: true, publication: { document: expect.any(Object) } });
  expect(laterDraft).toMatchObject({ ok: true });
  expect(repository.getPublishedStoreDesign(storeId)?.document.pages.home.sections[0].blocks[0].settings.text).toBe("LIVE");
  expect(repository.getStoreDesign(storeId)?.publications).toHaveLength(1);
});

it("keeps both published revisions immutable and advances the active pointer", () => {
  const repository = createRepository(memoryStorage());
  const initial = repository.getStoreDesign(storeId)!;
  const firstDraft = repository.saveStoreDesignDraft({ storeId, expectedRevision: initial.draftRevision, document: withHeroHeading("FIRST") });
  if (!firstDraft.ok) throw new Error("First draft should save");
  const first = repository.publishStoreDesign(storeId, firstDraft.record.draftRevision);
  if (!first.ok) throw new Error("First publication should succeed");

  const secondDraft = repository.saveStoreDesignDraft({ storeId, expectedRevision: firstDraft.record.draftRevision, document: withHeroHeading("SECOND") });
  if (!secondDraft.ok) throw new Error("Second draft should save");
  const second = repository.publishStoreDesign(storeId, secondDraft.record.draftRevision);
  if (!second.ok) throw new Error("Second publication should succeed");

  const record = repository.getStoreDesign(storeId)!;
  expect(record.currentPublicationId).toBe(second.publication.id);
  expect(record.publications).toHaveLength(2);
  expect(record.publications[0]?.document.pages.home.sections[0].blocks[0].settings.text).toBe("FIRST");
  expect(record.publications[1]?.document.pages.home.sections[0].blocks[0].settings.text).toBe("SECOND");
  expect(repository.getPublishedStoreDesign(storeId)?.id).toBe(second.publication.id);
});

it("rejects stale publish attempts without changing the active publication", () => {
  const repository = createRepository(memoryStorage());
  const current = repository.getStoreDesign(storeId)!;
  const draft = repository.saveStoreDesignDraft({ storeId, expectedRevision: current.draftRevision, document: withHeroHeading("DRAFT") });
  if (!draft.ok) throw new Error("Draft should save");
  const published = repository.publishStoreDesign(storeId, draft.record.draftRevision);
  if (!published.ok) throw new Error("Publication should succeed");
  const newerDraft = repository.saveStoreDesignDraft({ storeId, expectedRevision: draft.record.draftRevision, document: withHeroHeading("NEWER DRAFT") });
  if (!newerDraft.ok) throw new Error("Newer draft should save");
  const stale = repository.publishStoreDesign(storeId, draft.record.draftRevision);
  expect(stale).toEqual({ ok: false, code: "DRAFT_REVISION_CONFLICT", currentRevision: newerDraft.record.draftRevision });
  expect(repository.getPublishedStoreDesign(storeId)?.id).toBe(published.publication.id);
});
